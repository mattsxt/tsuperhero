import { transitRouteApi, type LatLng } from "@/api/v1/transit-routes/routes";

export type { LatLng };

export type VehicleType = "bus" | "jeep" | "tricy" | "van";

export type TransitRoute = {
  id: string;
  name: string;
  waypoints: LatLng[];
};

export type RouteVehicle = {
  id: string;
  plate: string;
  type: VehicleType;
  maxCapacity: number;
  currentCapacity: number;
  status: string;
  towards: string;
  lat: number;
  lng: number;
};

export type Terminal = {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  routeIds: string[];
};

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export const vehicleTypeLabels: Record<VehicleType, string> = {
  bus: "Bus",
  jeep: "Jeepney",
  tricy: "Tricycle",
  van: "Van",
};

export const transitRoutes: TransitRoute[] = [
  {
    id: "naga-pili",
    name: "Naga Centro – Pili",
    waypoints: [
      [13.624, 123.185],
      [13.619, 123.2],
      [13.598, 123.24],
      [13.556, 123.275],
    ],
  },
  {
    id: "naga-canaman",
    name: "Naga Centro – Canaman",
    waypoints: [
      [13.624, 123.185],
      [13.6435, 123.1715],
    ],
  },
  {
    id: "naga-camaligan",
    name: "Naga Centro – Camaligan",
    waypoints: [
      [13.624, 123.185],
      [13.6203, 123.1633],
    ],
  },
  {
    id: "naga-san-felipe",
    name: "Naga City Centro – San Felipe",
    waypoints: [
      [13.623556, 123.184694],
      [13.6296, 123.192],
      [13.6398, 123.2028],
      [13.6445, 123.2135],
      [13.649, 123.225],
    ],
  },
];

export const terminals: Terminal[] = [
  {
    id: "naga-central",
    name: "Naga City Central Terminal",
    city: "Naga City",
    lat: 13.624,
    lng: 123.185,
    routeIds: [
      "naga-pili",
      "naga-canaman",
      "naga-camaligan",
    ],
  },
  {
    id: "sm-naga",
    name: "SM City Naga Terminal",
    city: "Naga City",
    lat: 13.619,
    lng: 123.2,
    routeIds: ["naga-pili"],
  },
  {
    id: "diversion-road",
    name: "Diversion Road Stop",
    city: "Naga City",
    lat: 13.598,
    lng: 123.24,
    routeIds: ["naga-pili"],
  },
  {
    id: "pili",
    name: "Pili Terminal",
    city: "Pili",
    lat: 13.556,
    lng: 123.275,
    routeIds: ["naga-pili"],
  },
  {
    id: "canaman",
    name: "Canaman Terminal",
    city: "Canaman",
    lat: 13.6435,
    lng: 123.1715,
    routeIds: ["naga-canaman"],
  },
  {
    id: "camaligan",
    name: "Camaligan Terminal",
    city: "Camaligan",
    lat: 13.6203,
    lng: 123.1633,
    routeIds: ["naga-camaligan"],
  },
  // Stops on the Naga City Centro – San Felipe route, in travel order.
  // San Felipe Terminal: 13°37'24.8"N 123°11'04.9"E.
  {
    id: "san-felipe-terminal",
    name: "San Felipe Terminal",
    city: "Naga City",
    lat: 13.623556,
    lng: 123.184694,
    routeIds: ["naga-san-felipe"],
  },
  {
    id: "penafrancia-avenue",
    name: "Peñafrancia Avenue",
    city: "Naga City",
    lat: 13.6296,
    lng: 123.192,
    routeIds: ["naga-san-felipe"],
  },
  {
    id: "san-felipe",
    name: "San Felipe",
    city: "Naga City",
    lat: 13.6398,
    lng: 123.2028,
    routeIds: ["naga-san-felipe"],
  },
  {
    id: "lomeda",
    name: "Lomeda",
    city: "Naga City",
    lat: 13.6445,
    lng: 123.2135,
    routeIds: ["naga-san-felipe"],
  },
  {
    id: "san-felipe-pacol-boundary",
    name: "San Felipe–Pacol Boundary",
    city: "Naga City",
    lat: 13.649,
    lng: 123.225,
    routeIds: ["naga-san-felipe"],
  },
];

export function findRoute(id: string | null | undefined) {
  return transitRoutes.find((route) => route.id === id) ?? null;
}

export function findTerminal(id: string | null | undefined) {
  return terminals.find((terminal) => terminal.id === id) ?? null;
}

export function getRouteTerminals(routeId: string) {
  return terminals.filter((terminal) => terminal.routeIds.includes(routeId));
}

export type DestinationResults = {
  terminals: (Terminal & { routes: TransitRoute[] })[];
  routes: TransitRoute[];
};

export function searchDestinations(query: string): DestinationResults {
  const needle = query.trim().toLowerCase();
  const matches = (value: string) => value.toLowerCase().includes(needle);

  const matchingTerminals = terminals
    .filter((terminal) => !needle || matches(terminal.name) || matches(terminal.city))
    .map((terminal) => ({
      ...terminal,
      routes: transitRoutes.filter((route) =>
        terminal.routeIds.includes(route.id),
      ),
    }));

  return {
    terminals: matchingTerminals,
    routes: needle ? transitRoutes.filter((route) => matches(route.name)) : [],
  };
}

export function isInBounds(
  { lat, lng }: { lat: number; lng: number },
  bounds: MapBounds | null,
) {
  if (!bounds) return true;
  const withinLng =
    bounds.west <= bounds.east
      ? lng >= bounds.west && lng <= bounds.east
      : lng >= bounds.west || lng <= bounds.east;
  return lat >= bounds.south && lat <= bounds.north && withinLng;
}

export const vehicleMaxCapacity: Record<VehicleType, number> = {
  bus: 50,
  jeep: 24,
  tricy: 6,
  van: 14,
};

const platePrefix: Record<VehicleType, string> = {
  bus: "BUS",
  jeep: "JPA",
  tricy: "TRC",
  van: "VAN",
};

const statuses = [
  "In Transit",
  "In Transit",
  "In Transit",
  "Boarding",
  "Stopped",
];

const fleetTemplate: [VehicleType, number][] = [
  ["bus", 0.04],
  ["jeep", 0.12],
  ["jeep", 0.2],
  ["tricy", 0.28],
  ["van", 0.33],
  ["jeep", 0.36],
  ["bus", 0.39],
  ["jeep", 0.5],
  ["tricy", 0.6],
  ["van", 0.68],
  ["jeep", 0.75],
  ["bus", 0.82],
  ["tricy", 0.9],
  ["jeep", 0.96],
];

export function getOccupancyLevel(current: number, max: number) {
  const ratio = current / max;
  if (ratio >= 1) return "Full";
  if (ratio >= 0.8) return "Almost Full";
  if (ratio >= 0.5) return "Moderate";
  return "Available";
}

export async function loadRouteGeometry(
  route: TransitRoute,
): Promise<LatLng[]> {
  try {
    const response = await transitRouteApi.drivingRoute(route.waypoints);
    const coordinates =
      response.routes?.[0]?.polyline?.geoJsonLinestring?.coordinates;
    if (!coordinates?.length) throw new Error(response.error?.message);
    return coordinates.map(([lng, lat]) => [lat, lng]);
  } catch {
    return route.waypoints;
  }
}

export function pointAlong(path: LatLng[], fraction: number): LatLng {
  const lengths = path.slice(1).map(([lat, lng], index) => {
    const [prevLat, prevLng] = path[index];
    const x = (lng - prevLng) * Math.cos((lat * Math.PI) / 180);
    return Math.hypot(x, lat - prevLat);
  });
  let remaining = lengths.reduce((sum, length) => sum + length, 0) * fraction;

  for (let index = 0; index < lengths.length; index++) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      const t = lengths[index] ? Math.min(remaining / lengths[index], 1) : 0;
      const [startLat, startLng] = path[index];
      const [endLat, endLng] = path[index + 1];
      return [
        startLat + (endLat - startLat) * t,
        startLng + (endLng - startLng) * t,
      ];
    }
    remaining -= lengths[index];
  }
  return path[0];
}

const tripSeconds: Record<VehicleType, number> = {
  bus: 420,
  jeep: 480,
  tricy: 600,
  van: 380,
};

export const vehicleTickMs = 3000;

export function getRouteVehicles(
  route: TransitRoute,
  path: LatLng[],
  nowMs: number,
) {
  if (path.length < 2) return [];
  const counters: Record<VehicleType, number> = {
    bus: 0,
    jeep: 0,
    tricy: 0,
    van: 0,
  };
  const routeNumber = transitRoutes.indexOf(route) + 1;
  const [origin, destination = origin] = route.name.split(" – ");

  return fleetTemplate.map(([type, fraction], index): RouteVehicle => {
    counters[type] += 1;
    const status = statuses[(index + routeNumber) % statuses.length];
    const startPhase = index % 2 === 0 ? fraction : 2 - fraction;
    const travelled =
      status === "In Transit" ? (nowMs / 1000 / tripSeconds[type]) * 2 : 0;
    const phase = (startPhase + travelled) % 2;
    const [lat, lng] = pointAlong(path, phase <= 1 ? phase : 2 - phase);
    const max = vehicleMaxCapacity[type];
    return {
      id: `${route.id}-${index}`,
      plate: `${platePrefix[type]}-${routeNumber}${String(counters[type]).padStart(2, "0")}`,
      type,
      maxCapacity: max,
      currentCapacity: Math.round(
        (max * ((index * 37 + routeNumber * 11) % 100)) / 100,
      ),
      status,
      towards: phase < 1 ? destination : origin,
      lat,
      lng,
    };
  });
}
