import { currentUserId } from "@/simulation/auth";
import { db, type Row } from "@/simulation/db";
import { demoJeepneyRoutes, forgetVehicles, userFix } from "@/simulation/engine";
import { setVehiclePosition } from "@/simulation/rpc/operator";
import { routeByCode, sid } from "@/simulation/seed/people";
import { roadPath } from "@/simulation/seed/roads";
import {
  nearestPointOnPath,
  pathLengthMeters,
  pointAtAlong,
  sliceAlong,
  type LatLngPair,
} from "@/utils/geo";

export type GeneratedVehicleType = "Jeepney" | "Tricycle";
export type OccupancyChoice = "Available" | "Moderate" | "Almost Full" | "Full";

export type GenerateVehicleInput = {
  type: GeneratedVehicleType;
  routeId?: string | null;
  dynamic: boolean;
  occupancy: OccupancyChoice;
};

export type GenerateVehicleResult =
  | { ok: true; vehicleId: string; plate: string; message: string }
  | { ok: false; message: string };

const GENERATED_NS = 0x47;
const SEATS: Record<GeneratedVehicleType, number> = { Jeepney: 22, Tricycle: 4 };
const TRICYCLE_REACH_M = 400;

let counter = 0;
let viewedRouteId: string | null = null;

export function setViewedRoute(routeId: string | null): void {
  viewedRouteId = routeId;
}

export const isGenerated = (vehicle: Row | undefined): boolean => !!vehicle?.generated;

export function generatedVehicleCount(): number {
  return db.tables.vehicle.filter(isGenerated).length;
}

const levelOf = (current: number, max: number): OccupancyChoice => {
  const ratio = current / max;
  if (ratio >= 1) return "Full";
  if (ratio >= 0.8) return "Almost Full";
  if (ratio >= 0.5) return "Moderate";
  return "Available";
};

export function loadFor(level: OccupancyChoice, seats: number): number | null {
  const fits = Array.from({ length: seats + 1 }, (_, n) => n).filter(
    (n) => levelOf(n, seats) === level,
  );
  if (!fits.length) return null;
  return fits[Math.floor((fits.length - 1) / 2)];
}

export function occupancyChoices(type: GeneratedVehicleType): OccupancyChoice[] {
  const all: OccupancyChoice[] = ["Available", "Moderate", "Almost Full", "Full"];
  return all.filter((level) => loadFor(level, SEATS[type]) !== null);
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

const userPoint = (): LatLngPair => {
  const fix = userFix(currentUserId());
  return [fix.lat, fix.lng];
};

const tricycleCircuit = (): LatLngPair[] | null => {
  const here = userPoint();
  const point = { lat: here[0], lng: here[1] };
  const candidates = (
    viewedRouteId && roadPath(viewedRouteId)
      ? [viewedRouteId]
      : demoJeepneyRoutes().map((r) => r.routeId)
  ).flatMap((routeId) => {
    const path = roadPath(routeId);
    return path ? [{ path, snap: nearestPointOnPath(point, path) }] : [];
  });
  const best = candidates.sort((a, b) => a.snap.distanceMeters - b.snap.distanceMeters)[0];
  if (!best) return null;
  const length = pathLengthMeters(best.path);
  const center = Math.min(
    length,
    Math.max(0, best.snap.alongMeters + random(-TRICYCLE_REACH_M / 2, TRICYCLE_REACH_M / 2)),
  );
  const from = Math.max(0, center - TRICYCLE_REACH_M);
  const to = Math.min(length, center + TRICYCLE_REACH_M);
  const circuit = sliceAlong(best.path, from, to);
  return circuit.length > 1 ? circuit : null;
};

export function generateVehicle(input: GenerateVehicleInput): GenerateVehicleResult {
  const seats = SEATS[input.type];
  const load = loadFor(input.occupancy, seats);
  if (load === null)
    return { ok: false, message: `A ${input.type.toLowerCase()} can't be ${input.occupancy}` };

  let routeId: string;
  let path: LatLngPair[] | null;
  let start: LatLngPair;
  if (input.type === "Jeepney") {
    if (!input.routeId) return { ok: false, message: "Choose a route" };
    path = roadPath(input.routeId);
    if (!path) return { ok: false, message: "That route has no road to drive" };
    routeId = input.routeId;
    start = pointAtAlong(path, pathLengthMeters(path) * random(0.05, 0.95));
  } else {
    path = tricycleCircuit();
    if (!path) return { ok: false, message: "No road nearby for a tricycle" };
    routeId = routeByCode("NAGA-CITY");
    start = pointAtAlong(path, pathLengthMeters(path) * random(0, 1));
  }

  counter += 1;
  const vehicleId = sid(GENERATED_NS, counter);
  const plate = `${input.type === "Jeepney" ? "GEN" : "GTR"} ${String(counter).padStart(3, "0")}`;
  const vehicle: Row = {
    vehicle_id: vehicleId,
    plate_number: plate,
    vehicle_type: input.type,
    vehicle_status: "on-trip",
    max_capacity: seats,
    current_capacity: load,
    occupancy_level: 0,
    is_modern: false,
    documents_checked: [],
    route_id: routeId,
    is_full: load >= seats,
    occupancy_band: null,
    generated: true,
    generated_static: !input.dynamic,
    generated_path: input.type === "Tricycle" ? path : null,
  };
  db.tables.vehicle.push(vehicle);
  db.emit({ table: "vehicle", type: "INSERT", row: vehicle });
  setVehiclePosition(vehicleId, start[0], start[1]);
  return {
    ok: true,
    vehicleId,
    plate,
    message: `${plate} added · ${input.dynamic ? "dynamic" : "static"} occupancy`,
  };
}

export function clearGeneratedVehicles(): number {
  const ids = new Set(db.tables.vehicle.filter(isGenerated).map((v) => String(v.vehicle_id)));
  if (!ids.size) return 0;
  for (const table of ["location_records", "trip", "vehicle"] as const) {
    const rows = db.tables[table];
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      if (!ids.has(String(row.vehicle_id))) continue;
      rows.splice(i, 1);
      db.emit({ table, type: "DELETE", row });
    }
  }
  forgetVehicles(ids);
  return ids.size;
}

export type GeneratedVehicleStatus = "on-trip" | "loading";

export type GeneratedVehicleSettings = {
  status: GeneratedVehicleStatus;
  dynamic: boolean;
  occupancy: OccupancyChoice;
};

export function generatedVehicleSettings(
  vehicleId: string,
): (GeneratedVehicleSettings & { type: GeneratedVehicleType; plate: string }) | null {
  const vehicle = db.tables.vehicle.find((v) => v.vehicle_id === vehicleId);
  if (!isGenerated(vehicle)) return null;
  const max = Number(vehicle!.max_capacity);
  return {
    type: vehicle!.vehicle_type as GeneratedVehicleType,
    plate: String(vehicle!.plate_number),
    status: vehicle!.generated_hold ? "loading" : "on-trip",
    dynamic: !vehicle!.generated_static,
    occupancy: levelOf(Number(vehicle!.current_capacity ?? 0), max),
  };
}

export function updateGeneratedVehicle(
  vehicleId: string,
  settings: GeneratedVehicleSettings,
): { ok: boolean; message: string } {
  const vehicle = db.tables.vehicle.find((v) => v.vehicle_id === vehicleId);
  if (!vehicle || !isGenerated(vehicle))
    return { ok: false, message: "That vehicle is no longer in the demo" };
  const seats = Number(vehicle.max_capacity);
  const current = Number(vehicle.current_capacity ?? 0);
  const load =
    levelOf(current, seats) === settings.occupancy ? current : loadFor(settings.occupancy, seats);
  if (load === null)
    return { ok: false, message: `A ${String(vehicle.vehicle_type).toLowerCase()} can't be ${settings.occupancy}` };
  Object.assign(vehicle, {
    vehicle_status: settings.status,
    generated_hold: settings.status === "loading",
    generated_static: !settings.dynamic,
    current_capacity: load,
    is_full: load >= seats,
  });
  db.emit({ table: "vehicle", type: "UPDATE", row: vehicle });
  return { ok: true, message: `${vehicle.plate_number} updated` };
}
