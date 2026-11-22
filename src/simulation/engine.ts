import { currentUserId } from "@/simulation/auth";
import { companionBusyTrip, type BusyTrip } from "@/simulation/companion-busy";
import { db, type Row } from "@/simulation/db";
import {
  advance,
  bearing,
  positionOf,
  type Mover,
  type MoverPosition,
} from "@/simulation/movement";
import {
  acceptPickupEffect,
  boardPickupEffect,
  endTripEffect,
  releasePickupEffect,
  setEngineDrivenCheck,
  setVehicleLoadEffect,
  setVehiclePosition,
  setVehicleStatusEffect,
  startTripEffect,
} from "@/simulation/rpc/operator";
import {
  acceptCompanionInvite,
  declineCompanionInvite,
  companionDisplayName,
  companionPresenceEffect,
  completeRideEffect,
  routeFitsPoints,
  shareRideLocationEffect,
  tryBroadcastPickup,
} from "@/simulation/rpc/pickups";
import {
  commuterId as seedCommuterId,
  homePoints,
  people,
  userId as seedUserId,
  vehicleCircuit,
  vehicleId as seedVehicleId,
  vehicleSpecs,
} from "@/simulation/seed/people";
import { roadPath } from "@/simulation/seed/roads";
import { resetRentals, runRentals } from "@/simulation/rentals-sim";
import {
  distanceToPath,
  getDistanceMeters,
  nearestPointOnPath,
  pathLengthMeters,
  pointAtAlong,
  sliceAlong,
  type LatLngPair,
} from "@/utils/geo";

export type Speed = 1 | 4 | 10;
export type EngineState = { running: boolean; paused: boolean; speed: Speed };
export type Fix = {
  lat: number;
  lng: number;
  heading: number;
  speedMps: number;
};

const TICK_MS = 1_000;
const VEHICLE_KMH = 18;
const WALK_KMH = 5;
const ACCEPT_DELAY_S = 5;
const COMPANION_START_M = 200;
const SPAWN_GAP_S = 30;
const MAX_OPEN = 3;
const APPROACH_M = 600;
const SNAP_M = 60;
const STOP_AHEAD_M = 150;
const DROP_GAP_M = 400;
const DROP_TARGET_M = 1_200;
const ON_ROUTE_M = 20;
const DROP_REACH_M = 15;
const DWELL_LIMIT_S = 20;
const PASSED_M = 100;
const NEAR_AHEAD_M = 200;
const DEVICE_RESUME_M = 25;
const OCCUPANCY_EVERY_S = 12;
const OCCUPANCY_STAGGER_S = 3;
const LOAD_FIRST_S = 15;
const LOAD_STAGGER_S = 7;
const LOAD_EVERY_S = 50;
const LOAD_DWELL_S = 12;
const MOCK_RIDERS = [
  ...people
    .filter((p) => p.kind === "commuter" && p.key !== "juan" && p.key !== "ana")
    .map((p) => p.key),
  "ana",
];
const CENTRO: LatLngPair = [13.6229, 123.1859];

type Drive = {
  mode: "cruise" | "job" | "trip";
  mover: Mover;
  dwell: number;
  stopped: boolean;
};

type Job = {
  requestId: string;
  acceptAt: number;
  vehicleId: string | null;
  endTrip: boolean;
};

let timer: ReturnType<typeof setInterval> | null = null;
const DEFAULT_SPEED: Speed = 1;
let speed: Speed = DEFAULT_SPEED;
let pickupWalkScreenActive = false;
let paused = false;
let clock = 0;
let lastSpawn = -Infinity;
let riderTurn = 0;
const listeners = new Set<(state: EngineState) => void>();
const drives = new Map<string, Drive>();
setEngineDrivenCheck((vehicleId) => drives.has(vehicleId) && !!timer);
const walks = new Map<string, Mover>();
const points = new Map<string, LatLngPair>();
const vehiclePoints = new Map<string, LatLngPair>();
const jobs = new Map<string, Job>();
const companionStarts = new Map<string, LatLngPair>();
const companionWalks = new Map<string, Mover>();
const spawned = new Set<string>();
const skipped = new Set<string>();
const occupancy = new Map<string, { next: number; trend: 1 | -1 }>();
const loadingStops = new Map<string, { nextAt: number; until: number }>();
const devicePoints = new Map<string, LatLngPair>();
const simAnchors = new Map<string, LatLngPair>();

const placeUser = (user: string, point: LatLngPair) => {
  points.set(user, point);
  const device = devicePoints.get(user);
  if (device) simAnchors.set(user, device);
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
const iso = () => db.now().toISOString();
const timeOf = (v: unknown) => new Date(String(v)).getTime();
const toPoint = ([lat, lng]: LatLngPair) => ({ lat, lng });
const metersBetween = (a: LatLngPair, b: LatLngPair) =>
  getDistanceMeters(toPoint(a), toPoint(b));

const requestOf = (id: unknown) =>
  db.tables.request.find((r) => r.request_id === id);
const pickupOf = (id: unknown) =>
  db.tables.pickup.find((p) => p.request_id === id);
const vehicleOf = (id: unknown) =>
  db.tables.vehicle.find((v) => v.vehicle_id === id);
const locationOf = (id: unknown) =>
  db.tables.location_records.find((l) => l.vehicle_id === id);
const driverOfVehicle = (id: unknown) =>
  db.tables.driver.find((d) => d.vehicle_id === id);
const commuterUserId = (commuterId: unknown) =>
  db.tables.commuter.find((c) => c.commuter_id === commuterId)?.user_id;
const commuterIdOf = (user: unknown) =>
  db.tables.commuter.find((c) => c.user_id === user)?.commuter_id;

const activeTrip = (vehicleId: unknown) =>
  db.tables.trip
    .filter((t) => t.vehicle_id === vehicleId && t.trip_status === "active")
    .sort((x, y) => timeOf(y.departure_time) - timeOf(x.departure_time))[0];

const isLive = (vehicle: Row | undefined) =>
  !!vehicle && ["on-trip", "loading"].includes(String(vehicle.vehicle_status));

const routePath = (routeId: unknown): LatLngPair[] | null => {
  const route = db.tables.route.find((r) => r.route_id === routeId);
  return route ? roadPath(route.route_id) : null;
};

const pickupPointOf = (request: Row, pickup: Row): LatLngPair => [
  num(pickup.pickup_lat ?? request.device_latitude),
  num(pickup.pickup_lng ?? request.device_longitude),
];

const dropoffOf = (pickup: Row): LatLngPair | null =>
  pickup.dropoff_lat == null || pickup.dropoff_lng == null
    ? null
    : [num(pickup.dropoff_lat), num(pickup.dropoff_lng)];

const personnelVehicle = (user: unknown): string | null => {
  const personnel = db.tables.transit_personnel.find((p) => p.user_id === user);
  if (!personnel) return null;
  const driver = db.tables.driver.find(
    (d) => d.personnel_id === personnel.personnel_id && d.vehicle_id,
  );
  return driver ? String(driver.vehicle_id) : null;
};

const isCommuter = (user: unknown) =>
  !!commuterIdOf(user) &&
  !db.tables.transit_personnel.some((p) => p.user_id === user);

const homeOf = (user: unknown): LatLngPair => {
  for (const [key, point] of Object.entries(homePoints))
    if (seedUserId(key) === user) return point;
  return homePoints.juan;
};

const specPoint = (vehicleId: unknown): LatLngPair | null => {
  const spec = vehicleSpecs.find((v) => seedVehicleId(v.key) === vehicleId);
  return spec ? [spec.lat, spec.lng] : null;
};

const vehiclePoint = (vehicleId: unknown): LatLngPair => {
  const loc = locationOf(vehicleId);
  if (loc) return [num(loc.records_latitude), num(loc.records_longitude)];
  return (
    vehiclePoints.get(String(vehicleId)) ?? specPoint(vehicleId) ?? CENTRO
  );
};

const emitState = () => {
  const state = getState();
  for (const fn of [...listeners]) fn(state);
};

const placeVehicle = (vehicleId: string, position: MoverPosition, kmh: number) => {
  vehiclePoints.set(vehicleId, [position.lat, position.lng]);
  setVehiclePosition(vehicleId, position.lat, position.lng, kmh, position.heading);
};

const legPath = (
  from: LatLngPair,
  to: LatLngPair,
  routeId: unknown,
): LatLngPair[] => {
  const path = routePath(routeId);
  if (!path) return [from, to];
  const a = nearestPointOnPath(toPoint(from), path);
  const b = nearestPointOnPath(toPoint(to), path);
  if (a.distanceMeters > SNAP_M || b.distanceMeters > SNAP_M) return [from, to];
  return [from, ...sliceAlong(path, a.alongMeters, b.alongMeters), to];
};

const approachPoint = (target: LatLngPair, routeId: unknown): LatLngPair => {
  const path = routePath(routeId);
  if (path) {
    const snap = nearestPointOnPath(toPoint(target), path);
    if (snap.distanceMeters <= SNAP_M)
      return pointAtAlong(path, Math.max(0, snap.alongMeters - APPROACH_M));
  }
  return [target[0] + APPROACH_M / 111_320, target[1]];
};

const moveDrive = (vehicleId: string, seconds: number) => {
  const drive = drives.get(vehicleId);
  if (!drive) return;
  const next = advance(drive.mover, seconds);
  if (drives.get(vehicleId) === drive) drive.mover = next;
};

const syncDrive = (vehicleId: string) => {
  const drive = drives.get(vehicleId);
  if (!drive) return;
  const moving = !drive.stopped && drive.mover.along < pathLengthMeters(drive.mover.path);
  placeVehicle(vehicleId, positionOf(drive.mover), moving ? VEHICLE_KMH * speed : 0);
};

const cruiseMover = (
  vehicleId: string,
  path: LatLngPair[],
  along: number,
): Mover => ({
  id: vehicleId,
  path,
  along,
  speedKmh: VEHICLE_KMH,
  onArrive: () => {
    const drive = drives.get(vehicleId);
    if (drive?.mode !== "cruise") return;
    drives.set(vehicleId, {
      mode: "cruise",
      mover: cruiseMover(vehicleId, [...path].reverse(), 0),
      dwell: 0,
      stopped: false,
    });
  },
});

const generatedCircuit = (vehicle: Row | undefined): LatLngPair[] | null => {
  const path = vehicle?.generated_path;
  return Array.isArray(path) && path.length > 1 ? (path as LatLngPair[]) : null;
};

const cruisePathOf = (vehicleId: string): LatLngPair[] | null => {
  const vehicle = vehicleOf(vehicleId);
  return (
    routePath(activeTrip(vehicleId)?.route_id ?? vehicle?.route_id) ??
    generatedCircuit(vehicle) ??
    vehicleCircuit(vehicleId)
  );
};

const startCruise = (vehicleId: string) => {
  const path = cruisePathOf(vehicleId);
  const here = vehiclePoint(vehicleId);
  if (!path) {
    drives.set(vehicleId, {
      mode: "cruise",
      mover: { id: vehicleId, path: [here], along: 0, speedKmh: VEHICLE_KMH },
      dwell: 0,
      stopped: true,
    });
    return;
  }
  const snap = nearestPointOnPath(toPoint(here), path);
  if (snap.distanceMeters <= SNAP_M) {
    drives.set(vehicleId, {
      mode: "cruise",
      mover: cruiseMover(vehicleId, path, snap.alongMeters),
      dwell: 0,
      stopped: false,
    });
    return;
  }
  const back = pointAtAlong(path, snap.alongMeters);
  sendRoutedDrive(
    vehicleId,
    here,
    back,
    [here, back],
    () => {
      drives.set(vehicleId, {
        mode: "cruise",
        mover: cruiseMover(vehicleId, path, snap.alongMeters),
        dwell: 0,
        stopped: false,
      });
    },
    "cruise",
  );
};

const endOf = (path: LatLngPair[]): MoverPosition => {
  const [lat, lng] = path[path.length - 1];
  const heading =
    path.length > 1 ? bearing(path[path.length - 2], path[path.length - 1]) : 0;
  return { lat, lng, heading };
};

const sendDrive = (
  vehicleId: string,
  path: LatLngPair[],
  onArrive: (end: MoverPosition) => void,
  mode: "job" | "cruise" = "job",
) => {
  drives.set(vehicleId, {
    mode,
    mover: {
      id: vehicleId,
      path,
      along: 0,
      speedKmh: VEHICLE_KMH,
      onArrive: () => onArrive(endOf(path)),
    },
    dwell: 0,
    stopped: false,
  });
};

export type RoadRouter = (from: LatLngPair, to: LatLngPair) => Promise<LatLngPair[] | null>;

let roadRouter: RoadRouter | null = null;

export function setRoadRouter(router: RoadRouter | null): void {
  roadRouter = router;
}

let walkRouter: RoadRouter | null = null;
const routingWalks = new WeakSet<Mover>();

export function setWalkRouter(router: RoadRouter | null): void {
  walkRouter = router;
}

const sendRoutedDrive = (
  vehicleId: string,
  from: LatLngPair,
  to: LatLngPair,
  fallback: LatLngPair[],
  onArrive: (end: MoverPosition) => void,
  mode: "job" | "cruise" = "job",
) => {
  if (!roadRouter) {
    sendDrive(vehicleId, fallback, onArrive, mode);
    return;
  }
  const waiting: Drive = {
    mode,
    mover: { id: vehicleId, path: [from], along: 0, speedKmh: VEHICLE_KMH },
    dwell: 0,
    stopped: true,
  };
  drives.set(vehicleId, waiting);
  roadRouter(from, to)
    .catch(() => null)
    .then((road) => {
      if (drives.get(vehicleId) !== waiting) return;
      const routed = road && road.length > 1 ? road : null;
      const path = routed ?? fallback;
      if (routed)
        placeVehicle(
          vehicleId,
          { lat: routed[0][0], lng: routed[0][1], heading: bearing(routed[0], routed[1]) },
          0,
        );
      sendDrive(vehicleId, path, onArrive, mode);
      emitState();
    });
};

export function remainingDrivePath(plateNumber: string): LatLngPair[] | null {
  const vehicle = db.tables.vehicle.find((v) => v.plate_number === plateNumber);
  if (!vehicle) return null;
  const drive = drives.get(String(vehicle.vehicle_id));
  if (!drive || drive.mode !== "job" || drive.mover.path.length < 2) return null;
  const { path, along } = drive.mover;
  const total = pathLengthMeters(path);
  return along >= total ? null : sliceAlong(path, along, total);
}

const releaseVehicle = (job: Job) => {
  jobs.delete(job.requestId);
  if (!job.vehicleId) return;
  const vehicleId = job.vehicleId;
  if (drives.get(vehicleId)?.mode === "job") drives.delete(vehicleId);
  if (job.endTrip && activeTrip(vehicleId)) {
    vehiclePoints.set(vehicleId, vehiclePoint(vehicleId));
    endTripEffect(vehicleId, 0);
  }
};

const servesPickup = (vehicleId: string, pickup: Row): boolean => {
  const vehicle = vehicleOf(vehicleId);
  if (!vehicle || vehicle.vehicle_type !== pickup.requested_vehicle_type) return false;
  if (!driverOfVehicle(vehicleId)) return false;
  if (vehicleId === personnelVehicle(currentUserId())) return false;
  if (drives.get(vehicleId)?.mode === "job" || drives.get(vehicleId)?.mode === "trip")
    return false;
  if ([...jobs.values()].some((j) => j.vehicleId === vehicleId)) return false;
  const routeId = activeTrip(vehicleId)?.route_id ?? vehicle.route_id ?? null;
  if (pickup.route_id && pickup.route_id !== routeId) return false;
  const seats = num(vehicle.max_capacity);
  const used = activeTrip(vehicleId) ? num(vehicle.current_capacity ?? 0) : 0;
  return used + num(pickup.number_of_passengers) <= seats;
};

const counterpartFor = (pickup: Row): string | null => {
  const preferred =
    pickup.requested_vehicle_type === "Tricycle"
      ? seedVehicleId("pedro")
      : seedVehicleId("mario");
  const others = db.tables.vehicle
    .filter((v) => v.vehicle_id !== preferred)
    .sort((x, y) => Number(isLive(y)) - Number(isLive(x)))
    .map((v) => String(v.vehicle_id));
  return [preferred, ...others].find((id) => servesPickup(id, pickup)) ?? null;
};

const ridersOf = (request: Row): string[] =>
  [
    request.commuter_id,
    ...db.tables.pickup_companion
      .filter(
        (c) =>
          c.request_id === request.request_id && c.companion_status === "accepted",
      )
      .map((c) => c.commuter_id),
  ].flatMap((rider) => {
    const user = commuterUserId(rider);
    return user ? [String(user)] : [];
  });

const boardJob = (job: Job, at: MoverPosition) => {
  const request = requestOf(job.requestId);
  const pickup = pickupOf(job.requestId);
  const vehicleId = job.vehicleId!;
  if (
    !request ||
    !pickup ||
    request.request_status !== "accepted" ||
    pickup.vehicle_id !== vehicleId
  ) {
    releaseVehicle(job);
    return;
  }
  placeVehicle(vehicleId, at, 0);
  boardPickupEffect(job.requestId, vehicleId);
  const from: LatLngPair = [at.lat, at.lng];
  const to = dropoffOf(pickup) ?? from;
  const routeId = pickup.route_id ?? activeTrip(vehicleId)?.route_id;
  const onArrive = (end: MoverPosition) => completeJob(job, end);
  if (routePath(routeId)) sendDrive(vehicleId, legPath(from, to, routeId), onArrive);
  else sendRoutedDrive(vehicleId, from, to, legPath(from, to, routeId), onArrive);
};

const completeJob = (job: Job, at: MoverPosition) => {
  const request = requestOf(job.requestId);
  if (job.vehicleId) placeVehicle(job.vehicleId, at, 0);
  if (request) for (const user of ridersOf(request)) placeUser(user, [at.lat, at.lng]);
  if (request?.request_status === "riding") completeRideEffect(job.requestId);
  releaseVehicle(job);
};

const acceptJob = (job: Job) => {
  const request = requestOf(job.requestId);
  const pickup = pickupOf(job.requestId);
  if (
    !request ||
    !pickup ||
    request.request_status !== "pending" ||
    request.is_draft !== false ||
    pickup.vehicle_id
  ) {
    jobs.delete(job.requestId);
    return;
  }
  if (!request.arrived_at) {
    job.acceptAt = clock + ACCEPT_DELAY_S;
    return;
  }
  const vehicleId = counterpartFor(pickup);
  if (!vehicleId) {
    job.acceptAt = clock + ACCEPT_DELAY_S;
    return;
  }
  const target = pickupPointOf(request, pickup);
  const vehicle = vehicleOf(vehicleId)!;
  const driver = driverOfVehicle(vehicleId)!;
  job.vehicleId = vehicleId;
  if (!activeTrip(vehicleId)) {
    job.endTrip = !isLive(vehicle);
    const routeId = vehicle.route_id;
    const start = job.endTrip ? approachPoint(target, routeId) : vehiclePoint(vehicleId);
    startTripEffect(vehicleId, driver.driver_id, routeId, 0);
    placeVehicle(vehicleId, { lat: start[0], lng: start[1], heading: 0 }, 0);
  }
  acceptPickupEffect(job.requestId, vehicleId, driver.driver_id);
  const routeId = pickup.route_id ?? activeTrip(vehicleId)?.route_id;
  const from = vehiclePoint(vehicleId);
  sendRoutedDrive(vehicleId, from, target, legPath(from, target, routeId), (end) =>
    boardJob(job, end),
  );
};

const checkJobs = () => {
  for (const job of [...jobs.values()]) {
    if (!job.vehicleId) {
      if (clock >= job.acceptAt) acceptJob(job);
      continue;
    }
    const status = requestOf(job.requestId)?.request_status;
    if (status !== "accepted" && status !== "riding") releaseVehicle(job);
  }
};

const discoverRequests = (user: string | null) => {
  if (!user || !isCommuter(user)) return;
  const mine = commuterIdOf(user);
  for (const request of db.tables.request) {
    const id = String(request.request_id);
    if (
      jobs.has(id) ||
      spawned.has(id) ||
      request.commuter_id !== mine ||
      request.request_type !== "Pickup" ||
      request.request_status !== "pending" ||
      request.is_draft !== false ||
      !request.arrived_at
    )
      continue;
    const pickup = pickupOf(id);
    if (!pickup || pickup.vehicle_id) continue;
    jobs.set(id, {
      requestId: id,
      acceptAt: clock + ACCEPT_DELAY_S,
      vehicleId: null,
      endTrip: false,
    });
  }
};

const companionKey = (companion: Row) =>
  `${companion.request_id}:${companion.commuter_id}`;

const companionStartNear = (user: string | null, target: LatLngPair): LatLngPair => {
  const here = userFix(user);
  const origin: LatLngPair = [here.lat, here.lng];
  const away =
    metersBetween(origin, target) < 1 ? 0 : ((bearing(target, origin) % 360) * Math.PI) / 180;
  const dLat = (COMPANION_START_M * Math.cos(away)) / 111_320;
  const dLng = (COMPANION_START_M * Math.sin(away)) / (111_320 * Math.cos((origin[0] * Math.PI) / 180));
  return [origin[0] + dLat, origin[1] + dLng];
};

export type CompanionInvite = {
  key: string;
  requestId: string;
  commuterId: string;
  name: string;
  avatar: string | null;
  busy: BusyTrip | null;
  hosted: boolean;
};

const isMemberOf = (request: Row | undefined, mine: unknown): boolean =>
  !!request &&
  !!mine &&
  (request.commuter_id === mine ||
    db.tables.pickup_companion.some(
      (c) =>
        c.request_id === request.request_id &&
        c.commuter_id === mine &&
        ["pending", "accepted"].includes(String(c.companion_status)),
    ));

export function pendingCompanionInvites(): CompanionInvite[] {
  const mine = commuterIdOf(currentUserId());
  if (!mine) return [];
  return db.tables.pickup_companion
    .filter((c) => {
      const request = requestOf(c.request_id);
      return (
        c.companion_status === "pending" &&
        c.commuter_id !== mine &&
        isMemberOf(request, mine) &&
        request?.request_status === "pending"
      );
    })
    .map((c) => {
      const profile = db.tables.profile.find((p) => p.user_id === commuterUserId(c.commuter_id));
      return {
        key: companionKey(c),
        requestId: String(c.request_id),
        commuterId: String(c.commuter_id),
        name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "A rider",
        avatar: (profile?.profile_picture as string | undefined) ?? null,
        busy: companionBusyTrip(c.commuter_id),
        hosted: requestOf(c.request_id)?.commuter_id === mine,
      };
    });
}

export function answerCompanionInvite(key: string, accept: boolean): boolean {
  const companion = db.tables.pickup_companion.find((c) => companionKey(c) === key);
  if (!companion || companion.companion_status !== "pending") return false;
  if (!pendingCompanionInvites().some((invite) => invite.key === key)) return false;
  if (accept && companionBusyTrip(companion.commuter_id)) return false;
  const name = companionDisplayName(companion.commuter_id);
  if (accept) acceptCompanionInvite(companion, name);
  else declineCompanionInvite(companion, name);
  return true;
}

export function companionWalkStart(key: string): LatLngPair | null {
  return companionStarts.get(key) ?? null;
}

const routeCompanionWalk = (
  movers: Map<string, Mover>,
  moverKey: string,
  startKey: string,
  waiting: Mover,
  target: LatLngPair,
) => {
  if (!walkRouter) return;
  const from = waiting.path[0];
  routingWalks.add(waiting);
  walkRouter(from, target)
    .catch(() => null)
    .then((road) => {
      routingWalks.delete(waiting);
      if (movers.get(moverKey) !== waiting || !road || road.length < 2) return;
      const path =
        metersBetween(road[road.length - 1], target) > 1 ? [...road, target] : road;
      if (companionStarts.get(startKey) === from) companionStarts.set(startKey, path[0]);
      movers.set(moverKey, { ...waiting, path, along: 0 });
      emitState();
    });
};

const runCompanions = (user: string | null, seconds: number) => {
  const mine = user ? commuterIdOf(user) : undefined;
  for (const companion of db.tables.pickup_companion) {
    const request = requestOf(companion.request_id);
    const isSelf = !!mine && companion.commuter_id === mine;
    if (!mine || !request || !isMemberOf(request, mine) || request.request_status !== "pending")
      continue;
    const key = companionKey(companion);
    if (companion.companion_status !== "accepted" || companion.arrived_at) continue;
    const pickup = pickupOf(request.request_id);
    if (!pickup) continue;
    const target = pickupPointOf(request, pickup).map((coordinate, index) =>
      coordinate === 0
        ? num(index === 0 ? request.device_latitude : request.device_longitude)
        : coordinate,
    ) as LatLngPair;
    if (isSelf) {
      const existingWalk = walks.get(user!);
      if (!existingWalk || metersBetween(existingWalk.path[existingWalk.path.length - 1], target) > 1) {
        const here = userFix(user);
        const from: LatLngPair = [here.lat, here.lng];
        companionStarts.set(key, from);
        const walk: Mover = {
          id: user!,
          path: [from, target],
          along: 0,
          speedKmh: WALK_KMH,
          onArrive: () => {
            walks.delete(user!);
            placeUser(user!, target);
            const row = db.tables.pickup_companion.find((item) => companionKey(item) === key);
            const live = requestOf(request.request_id);
            if (row && live && row.companion_status === "accepted")
              companionPresenceEffect(live, row, target[0], target[1]);
          },
        };
        walks.set(user!, walk);
        routeCompanionWalk(walks, user!, key, walk, target);
      }
      continue;
    }
    const existing = companionWalks.get(key);
    if (!existing || metersBetween(existing.path[existing.path.length - 1], target) > 1) {
      const from = existing
        ? ([positionOf(existing).lat, positionOf(existing).lng] as LatLngPair)
        : companionStartNear(user, target);
      if (!existing) companionStarts.set(key, from);
      const walk: Mover = {
        id: key,
        path: [from, target],
        along: 0,
        speedKmh: WALK_KMH,
        onArrive: () => {
          companionWalks.delete(key);
          const row = db.tables.pickup_companion.find((c) => companionKey(c) === key);
          const live = requestOf(request.request_id);
          if (row && live && row.companion_status === "accepted")
            companionPresenceEffect(live, row, target[0], target[1]);
        },
      };
      companionWalks.set(key, walk);
      routeCompanionWalk(companionWalks, key, key, walk, target);
    }
  }
};

const moveCompanions = (seconds: number) => {
  for (const [key, mover] of [...companionWalks]) {
    if (routingWalks.has(mover)) continue;
    const next = advance(mover, seconds);
    if (companionWalks.get(key) === mover) companionWalks.set(key, next);
  }
};

const moveWalks = (seconds: number) => {
  for (const [user, mover] of [...walks]) {
    if (routingWalks.has(mover)) continue;
    const next = advance(mover, seconds);
    if (walks.get(user) === mover) walks.set(user, next);
  }
};

const nextStopAlong = (vehicleId: string, drive: Drive) => {
  let stop = Infinity;
  for (const pickup of db.tables.pickup) {
    if (pickup.vehicle_id !== vehicleId) continue;
    const request = requestOf(pickup.request_id);
    if (request?.request_status !== "accepted" || skipped.has(String(pickup.request_id)))
      continue;
    const snap = nearestPointOnPath(
      toPoint(pickupPointOf(request, pickup)),
      drive.mover.path,
    );
    if (snap.alongMeters >= drive.mover.along - 5) stop = Math.min(stop, snap.alongMeters);
  }
  return stop;
};

const nextDropAlong = (vehicleId: string, drive: Drive) => {
  let stop = Infinity;
  for (const pickup of db.tables.pickup) {
    const dropoff = dropoffOf(pickup);
    if (pickup.vehicle_id !== vehicleId || !dropoff) continue;
    if (requestOf(pickup.request_id)?.request_status !== "riding") continue;
    const along = nearestPointOnPath(toPoint(dropoff), drive.mover.path).alongMeters;
    if (along > drive.mover.along) stop = Math.min(stop, along);
  }
  return stop;
};

const dropRiders = (vehicleId: string, drive: Drive) => {
  const here = positionOf(drive.mover);
  for (const pickup of db.tables.pickup) {
    const dropoff = dropoffOf(pickup);
    if (pickup.vehicle_id !== vehicleId || !dropoff) continue;
    const id = String(pickup.request_id);
    if (!spawned.has(id) || requestOf(id)?.request_status !== "riding") continue;
    const along = nearestPointOnPath(toPoint(dropoff), drive.mover.path).alongMeters;
    if (
      drive.mover.along >= along - DROP_REACH_M ||
      metersBetween([here.lat, here.lng], dropoff) <= DROP_REACH_M * 2
    )
      completeRideEffect(id);
  }
};

const startDriverTrip = (vehicleId: string, routeId: unknown) => {
  const path = routePath(routeId) ?? vehicleCircuit(vehicleId);
  const here = vehiclePoint(vehicleId);
  if (!path) {
    drives.set(vehicleId, {
      mode: "trip",
      mover: { id: vehicleId, path: [here], along: 0, speedKmh: VEHICLE_KMH },
      dwell: 0,
      stopped: true,
    });
    return;
  }
  const total = pathLengthMeters(path);
  const snap = nearestPointOnPath(toPoint(here), path);
  const reversed = snap.alongMeters > total / 2;
  const travel = reversed ? [...path].reverse() : path;
  drives.set(vehicleId, {
    mode: "trip",
    mover: {
      id: vehicleId,
      path: travel,
      along: reversed ? total - snap.alongMeters : snap.alongMeters,
      speedKmh: VEHICLE_KMH,
    },
    dwell: 0,
    stopped: false,
  });
};

const driveTrip = (vehicleId: string, seconds: number) => {
  const drive = drives.get(vehicleId)!;
  const stop = nextStopAlong(vehicleId, drive);
  const step = (VEHICLE_KMH * seconds) / 3.6;
  if (drive.mover.along + step >= stop) {
    drive.mover = { ...drive.mover, along: Math.max(drive.mover.along, stop) };
    drive.stopped = true;
    drive.dwell += seconds;
    if (drive.dwell >= DWELL_LIMIT_S) boardWaitingAt(vehicleId, drive);
  } else {
    drive.dwell = 0;
    drive.stopped = false;
    drive.mover = advance(drive.mover, seconds);
    if (drive.mover.along >= pathLengthMeters(drive.mover.path))
      drive.mover = { ...drive.mover, path: [...drive.mover.path].reverse(), along: 0 };
  }
  dropRiders(vehicleId, drive);
  expirePassed(vehicleId, drive);
};

const cancelSpawned = (id: string) => {
  spawned.delete(id);
  skipped.delete(id);
  if (requestOf(id)?.request_status === "accepted") releasePickupEffect(id);
  for (const table of ["request", "pickup"] as const) {
    const rows = db.tables[table];
    const index = rows.findIndex((r) => r.request_id === id);
    if (index < 0) continue;
    const [row] = rows.splice(index, 1);
    db.emit({ table, type: "DELETE", row });
  }
};

const expirePassed = (vehicleId: string, drive: Drive) => {
  for (const id of [...spawned]) {
    const request = requestOf(id);
    const pickup = pickupOf(id);
    if (!request || !pickup) {
      spawned.delete(id);
      continue;
    }
    if (!["pending", "accepted"].includes(String(request.request_status))) continue;
    if (request.request_status === "accepted" && pickup.vehicle_id !== vehicleId) continue;
    const along = nearestPointOnPath(
      toPoint(pickupPointOf(request, pickup)),
      drive.mover.path,
    ).alongMeters;
    if (along < drive.mover.along - PASSED_M) cancelSpawned(id);
  }
};

const boardWaitingAt = (vehicleId: string, drive: Drive) => {
  const here = positionOf(drive.mover);
  for (const pickup of db.tables.pickup) {
    if (pickup.vehicle_id !== vehicleId) continue;
    const request = requestOf(pickup.request_id);
    if (request?.request_status !== "accepted") continue;
    const id = String(pickup.request_id);
    if (skipped.has(id)) continue;
    const point = pickupPointOf(request, pickup);
    const along = nearestPointOnPath(toPoint(point), drive.mover.path).alongMeters;
    if (along > drive.mover.along + 5) continue;
    if (metersBetween([here.lat, here.lng], point) <= 100)
      boardPickupEffect(id, vehicleId);
    else skipped.add(id);
  }
  drive.dwell = 0;
};

const runDriver = (user: string | null, seconds: number): string | null => {
  const vehicleId = personnelVehicle(user);
  if (!vehicleId) return null;
  const trip = activeTrip(vehicleId);
  const drive = drives.get(vehicleId);
  if (!trip) {
    if (drive) {
      vehiclePoints.set(vehicleId, [positionOf(drive.mover).lat, positionOf(drive.mover).lng]);
      drives.delete(vehicleId);
    }
    return null;
  }
  if (drive?.mode === "job") {
    moveDrive(vehicleId, seconds);
    if (drives.get(vehicleId)) syncDrive(vehicleId);
    return vehicleId;
  }
  if (drive?.mode !== "trip") startDriverTrip(vehicleId, trip.route_id);
  driveTrip(vehicleId, seconds);
  syncDrive(vehicleId);
  if (clock - lastSpawn >= SPAWN_GAP_S) spawnRequest(vehicleId);
  return vehicleId;
};

const runVehicles = (driven: string | null, seconds: number) => {
  for (const [index, vehicle] of db.tables.vehicle.entries()) {
    const id = String(vehicle.vehicle_id);
    if (id === driven) continue;
    const drive = drives.get(id);
    if (drive?.mode === "trip") {
      drives.delete(id);
      continue;
    }
    if (drive?.mode === "job") {
      endLoadingStop(id);
      moveDrive(id, seconds);
      if (drives.get(id)) syncDrive(id);
      continue;
    }
    if (!isLive(vehicle) || id === personnelVehicle(currentUserId())) {
      if (drive) drives.delete(id);
      endLoadingStop(id);
      continue;
    }
    if (!drive) startCruise(id);
    const dynamic = !vehicle.generated_static;
    if (vehicle.generated_hold) {
      loadingStops.delete(id);
      holdVehicle(id);
      if (dynamic) stepOccupancy(vehicle, index);
      continue;
    }
    if (dynamic && atLoadingStop(vehicle, index)) {
      holdVehicle(id);
      continue;
    }
    moveDrive(id, seconds);
    syncDrive(id);
    if (dynamic) stepOccupancy(vehicle, index);
  }
};

const holdVehicle = (vehicleId: string) => {
  const drive = drives.get(vehicleId);
  if (drive) placeVehicle(vehicleId, positionOf(drive.mover), 0);
};

const endLoadingStop = (vehicleId: string) => {
  const stop = loadingStops.get(vehicleId);
  if (!stop) return;
  loadingStops.delete(vehicleId);
  if (stop.until >= 0 && vehicleOf(vehicleId)?.vehicle_status === "loading")
    setVehicleStatusEffect(vehicleId, "on-trip");
};

const atLoadingStop = (vehicle: Row, index: number): boolean => {
  const id = String(vehicle.vehicle_id);
  const drive = drives.get(id);
  if (!drive || drive.stopped || drive.mover.path.length < 2) return false;
  const stop = loadingStops.get(id) ?? {
    nextAt: clock + LOAD_FIRST_S + index * LOAD_STAGGER_S,
    until: -1,
  };
  loadingStops.set(id, stop);
  if (stop.until >= 0) {
    if (clock < stop.until) return true;
    stop.until = -1;
    stop.nextAt = clock + LOAD_EVERY_S;
    setVehicleStatusEffect(id, "on-trip");
    return false;
  }
  if (clock < stop.nextAt) return false;
  stop.until = clock + LOAD_DWELL_S;
  setVehicleStatusEffect(id, "loading");
  stepLoad(vehicle);
  return true;
};

const stepOccupancy = (vehicle: Row, index: number) => {
  const id = String(vehicle.vehicle_id);
  if (!num(vehicle.max_capacity)) return;
  const state = occupancyOf(id, index);
  if (clock < state.next) return;
  state.next = clock + OCCUPANCY_EVERY_S;
  stepLoad(vehicle);
};

const occupancyOf = (id: string, index = 0) => {
  const state = occupancy.get(id) ?? {
    next: clock + index * OCCUPANCY_STAGGER_S,
    trend: 1 as 1 | -1,
  };
  occupancy.set(id, state);
  return state;
};

const loadBand = (vehicle: Row, max: number): [number, number] => {
  const band = vehicle.occupancy_band;
  if (!Array.isArray(band)) return [0, max];
  const lo = Math.max(0, Math.round(num(band[0]) * max));
  return [lo, Math.max(lo + 1, Math.min(max, Math.floor(num(band[1]) * max)))];
};

const stepLoad = (vehicle: Row) => {
  const id = String(vehicle.vehicle_id);
  const max = num(vehicle.max_capacity);
  if (!max) return;
  const state = occupancyOf(id);
  const [lo, hi] = loadBand(vehicle, max);
  const current = num(vehicle.current_capacity ?? 0);
  if (current >= hi) state.trend = -1;
  else if (current <= lo) state.trend = 1;
  const step = Array.isArray(vehicle.occupancy_band)
    ? Math.max(1, Math.round((hi - lo) / 3))
    : Math.max(1, Math.ceil(max * 0.2));
  const next = Math.min(hi, Math.max(lo, current + state.trend * step));
  setVehicleLoadEffect(id, next);
};

const trackRiders = () => {
  for (const request of db.tables.request) {
    if (request.request_type !== "Pickup" || request.request_status !== "riding") continue;
    const pickup = pickupOf(request.request_id);
    if (!pickup?.vehicle_id || !locationOf(pickup.vehicle_id)) continue;
    const at = vehiclePoint(pickup.vehicle_id);
    for (const user of ridersOf(request)) placeUser(user, at);
  }
};

const openSpawned = () =>
  [...spawned].filter((id) => requestOf(id)?.request_status === "pending");

const liveSpawned = () =>
  [...spawned].filter((id) =>
    ["pending", "accepted"].includes(String(requestOf(id)?.request_status)),
  );

type SpawnContext = { drive: Drive; trip: Row; vehicle: Row; rider: string };

const spawnContext = (
  vehicleId: string | null,
  maxOpen = MAX_OPEN,
): SpawnContext | string => {
  const drive = vehicleId ? drives.get(vehicleId) : undefined;
  const trip = activeTrip(vehicleId);
  const vehicle = vehicleOf(vehicleId);
  if (drive?.mode !== "trip" || !trip || !vehicle || drive.mover.path.length < 2)
    return "Start a trip first";
  if (openSpawned().length >= maxOpen)
    return `${maxOpen} requests open · accept or skip one`;
  const turn = riderTurn % MOCK_RIDERS.length;
  const rider = [...MOCK_RIDERS.slice(turn), ...MOCK_RIDERS.slice(0, turn)]
    .map((key) => seedCommuterId(key))
    .find(
      (id) =>
        commuterUserId(id) !== currentUserId() &&
        !db.tables.request.some(
          (r) =>
            r.commuter_id === id &&
            r.request_type === "Pickup" &&
            ["pending", "accepted", "riding"].includes(String(r.request_status)),
        ),
    );
  if (!rider) return "All riders busy";
  return { drive, trip, vehicle, rider: String(rider) };
};

const routeAreas = (path: LatLngPair[]) =>
  db.tables.waiting_area
    .filter((w) => w.is_active)
    .map((w) => {
      const point: LatLngPair = [num(w.area_latitude), num(w.area_longitude)];
      return { area: w, point, distance: distanceToPath(toPoint(point), path), along: nearestPointOnPath(toPoint(point), path).alongMeters };
    })
    .filter((a) => a.distance <= ON_ROUTE_M)
    .sort((x, y) => x.along - y.along);

const nearestAreaName = (point: LatLngPair): string => {
  let best: Row | null = null;
  let bestMeters = Infinity;
  for (const w of db.tables.waiting_area) {
    const meters = metersBetween(point, [num(w.area_latitude), num(w.area_longitude)]);
    if (meters < bestMeters) {
      best = w;
      bestMeters = meters;
    }
  }
  return best ? String(best.area_name) : "Along the route";
};

const pointArea = (point: LatLngPair): Row => ({
  area_id: null,
  area_name: nearestAreaName(point),
  area_latitude: point[0],
  area_longitude: point[1],
});

const nearbySpawnPlan = (context: SpawnContext): { from: Row; to: Row } | string => {
  const path = context.drive.mover.path;
  const total = pathLengthMeters(path);
  const pickAlong = context.drive.mover.along + NEAR_AHEAD_M;
  if (pickAlong + DROP_GAP_M > total)
    return "Route almost done · try later";
  const pick = pointAtAlong(path, pickAlong);
  const drops = routeAreas(path).filter((a) => a.along >= pickAlong + DROP_GAP_M);
  const to = drops.length
    ? drops.reduce((best, a) =>
        Math.abs(a.along - pickAlong - DROP_TARGET_M) < Math.abs(best.along - pickAlong - DROP_TARGET_M)
          ? a
          : best,
      ).area
    : pointArea(pointAtAlong(path, Math.min(total, pickAlong + DROP_TARGET_M)));
  return { from: pointArea(pick), to };
};

const spawnNearbyRequest = (vehicleId: string | null, maxOpen = MAX_OPEN): string | null => {
  const context = spawnContext(vehicleId, maxOpen);
  if (typeof context === "string") return context;
  const plan = nearbySpawnPlan(context);
  if (typeof plan === "string") return plan;
  insertMockRequest(context.rider, context.vehicle, context.trip.route_id, plan.from, plan.to);
  lastSpawn = clock;
  riderTurn += 1;
  return null;
};

const spawnRequest = (vehicleId: string): boolean => {
  const context = spawnContext(vehicleId);
  if (typeof context === "string") return false;
  const { drive, trip, vehicle, rider } = context;
  const used = new Set(liveSpawned().map((id) => pickupOf(id)?.waiting_area_id));
  const areas = routeAreas(drive.mover.path);
  for (const from of areas) {
    if (from.along < drive.mover.along + STOP_AHEAD_M || used.has(from.area.area_id))
      continue;
    const drops = areas.filter((a) => a.along >= from.along + DROP_GAP_M);
    if (!drops.length) continue;
    const to = drops.reduce((best, a) =>
      Math.abs(a.along - from.along - DROP_TARGET_M) <
      Math.abs(best.along - from.along - DROP_TARGET_M)
        ? a
        : best,
    );
    if (routePath(trip.route_id) && !routeFitsPoints(trip.route_id, from.point, to.point, 25))
      continue;
    insertMockRequest(rider, vehicle, trip.route_id, from.area, to.area);
    lastSpawn = clock;
    riderTurn += 1;
    return true;
  }
  return false;
};

const insertMockRequest = (
  commuterId: string,
  vehicle: Row,
  routeId: unknown,
  from: Row,
  to: Row,
) => {
  const id = db.id();
  const passengers = vehicle.vehicle_type === "Tricycle" ? 1 : 1 + (spawned.size % 2);
  const request: Row = {
    request_id: id,
    commuter_id: commuterId,
    driver_id: null,
    request_type: "Pickup",
    request_status: "pending",
    request_date: iso(),
    device_latitude: from.area_latitude,
    device_longitude: from.area_longitude,
    is_draft: false,
    arrived_at: null,
    owner_present_at: iso(),
  };
  const pickup: Row = {
    pickup_id: db.id(),
    request_id: id,
    vehicle_id: null,
    pickup_destination: String(from.area_name),
    pickup_date: iso(),
    number_of_passengers: passengers,
    requested_vehicle_type: vehicle.vehicle_type,
    route_id: routeId,
    pickup_lat: from.area_latitude,
    pickup_lng: from.area_longitude,
    dropoff_name: String(to.area_name),
    dropoff_lat: to.area_latitude,
    dropoff_lng: to.area_longitude,
    boarded_at: null,
    dropped_at: null,
    waiting_area_id: from.area_id,
  };
  spawned.add(id);
  db.tables.request.push(request);
  db.emit({ table: "request", type: "INSERT", row: request });
  db.tables.pickup.push(pickup);
  db.emit({ table: "pickup", type: "INSERT", row: pickup });
  tryBroadcastPickup(id);
};

const simulatedCompanionPoint = (request: Row, companion: Row): LatLngPair | null => {
  const key = companionKey(companion);
  const walking = companionWalks.get(key);
  if (walking) {
    const { lat, lng } = positionOf(walking);
    return [lat, lng];
  }
  if (companion.arrived_at) return pickupPointOf(request, pickupOf(request.request_id) ?? {});
  return companionStarts.get(key) ?? null;
};

const publishPartyLocations = (user: string | null) => {
  for (const request of db.tables.request) {
    if (
      request.request_type !== "Pickup" ||
      !["pending", "accepted"].includes(String(request.request_status))
    )
      continue;
    const companions = db.tables.pickup_companion.filter(
      (c) => c.request_id === request.request_id && c.companion_status === "accepted",
    );
    if (!companions.length) continue;
    const owner = commuterUserId(request.commuter_id);
    if (owner && owner !== user) {
      const fix = userFix(String(owner));
      shareRideLocationEffect(request, request.commuter_id, fix.lat, fix.lng);
    }
    for (const companion of companions) {
      if (commuterUserId(companion.commuter_id) === user) continue;
      const point = simulatedCompanionPoint(request, companion);
      if (point) shareRideLocationEffect(request, companion.commuter_id, point[0], point[1]);
    }
  }
};

const update = (seconds: number) => {
  const user = currentUserId();
  discoverRequests(user);
  runCompanions(user, seconds);
  clock += seconds;
  checkJobs();
  moveWalks(seconds);
  moveCompanions(seconds);
  publishPartyLocations(user);
  const driven = runDriver(user, seconds);
  runVehicles(driven, seconds);
  trackRiders();
  runRentals(clock, seconds);
};

const tick = () => {
  try {
    update(speed);
  } catch (error) {
    if (typeof __DEV__ !== "undefined" && __DEV__)
      console.warn("[Tsuperhero] Simulation tick failed:", error);
  }
};

const ridingVehicle = (user: string): string | null => {
  const mine = commuterIdOf(user);
  if (!mine) return null;
  const ride = db.tables.request.find(
    (r) =>
      r.request_type === "Pickup" &&
      r.request_status === "riding" &&
      (r.commuter_id === mine ||
        db.tables.pickup_companion.some(
          (c) =>
            c.request_id === r.request_id &&
            c.commuter_id === mine &&
            c.companion_status === "accepted",
        )),
  );
  const vehicleId = ride ? pickupOf(ride.request_id)?.vehicle_id : null;
  return vehicleId && locationOf(vehicleId) ? String(vehicleId) : null;
};

const vehicleFix = (vehicleId: string): Fix => {
  const loc = locationOf(vehicleId);
  const [lat, lng] = vehiclePoint(vehicleId);
  return {
    lat,
    lng,
    heading: loc ? num(loc.heading) || 0 : 0,
    speedMps: loc ? num(loc.speed_kmh) / 3.6 || 0 : 0,
  };
};

export const userFix = (user: string | null): Fix => {
  if (!user) return { lat: CENTRO[0], lng: CENTRO[1], heading: 0, speedMps: 0 };
  const vehicleId = personnelVehicle(user);
  if (vehicleId) return vehicleFix(vehicleId);
  const riding = ridingVehicle(user);
  if (riding) {
    const fix = vehicleFix(riding);
    placeUser(user, [fix.lat, fix.lng]);
    return fix;
  }
  const walk = walks.get(user);
  if (walk) {
    const position = positionOf(walk);
    return { ...position, speedMps: (WALK_KMH * speed) / 3.6 };
  }
  const device = devicePoints.get(user);
  const placed = points.get(user);
  const [lat, lng] =
    device && !(placed && simAnchors.has(user)) ? device : placed ?? homeOf(user);
  return { lat, lng, heading: 0, speedMps: 0 };
};

export function setDeviceFix(
  user: string | null,
  fix: { lat: number; lng: number } | null,
): void {
  if (!user || !isCommuter(user)) return;
  if (!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) {
    devicePoints.delete(user);
    return;
  }
  const point: LatLngPair = [fix.lat, fix.lng];
  devicePoints.set(user, point);
  const anchor = simAnchors.get(user);
  if (anchor && metersBetween(anchor, point) > DEVICE_RESUME_M) {
    simAnchors.delete(user);
    points.delete(user);
  }
}

export const walkTo = (
  target: { lat: number; lng: number } | null,
  route: LatLngPair[] | null = null,
): void => {
  const user = currentUserId();
  if (!user || personnelVehicle(user) || ridingVehicle(user)) return;
  const here = userFix(user);
  const from: LatLngPair = [here.lat, here.lng];
  if (!target) {
    if (walks.delete(user)) placeUser(user, from);
    return;
  }
  const to: LatLngPair = [target.lat, target.lng];
  const current = walks.get(user);
  const routed = route && route.length > 1 ? route : null;
  if (!routed && current && metersBetween(current.path[current.path.length - 1], to) < 1)
    return;
  if (metersBetween(from, to) < 1) {
    walks.delete(user);
    placeUser(user, to);
    return;
  }
  walks.set(user, {
    id: user,
    path: routed ? [from, ...routed, to] : [from, to],
    along: 0,
    speedKmh: WALK_KMH,
    onArrive: () => {
      walks.delete(user);
      placeUser(user, to);
    },
  });
};

export type DemoRoute = { routeId: string; name: string; code: string };

export function demoJeepneyRoutes(): DemoRoute[] {
  return db.tables.route
    .filter((r) => roadPath(r.route_id))
    .map((r) => ({ routeId: String(r.route_id), name: String(r.route_name), code: String(r.route_code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function chooseDemoRoute(routeId: string): boolean {
  const vehicleId = personnelVehicle(currentUserId());
  const vehicle = vehicleOf(vehicleId);
  const path = routePath(routeId);
  if (!vehicleId || !vehicle || !path || vehicle.vehicle_type !== "Jeepney" || activeTrip(vehicleId))
    return false;
  vehicle.route_id = routeId;
  db.emit({ table: "vehicle", type: "UPDATE", row: vehicle });
  drives.delete(vehicleId);
  const heading = path.length > 1 ? bearing(path[0], path[1]) : 0;
  placeVehicle(vehicleId, { lat: path[0][0], lng: path[0][1], heading }, 0);
  return true;
}

const finishDriverLeg = (vehicleId: string): boolean => {
  const drive = drives.get(vehicleId);
  if (drive?.mode !== "trip" || drive.mover.path.length < 2) return false;
  const total = pathLengthMeters(drive.mover.path);
  const target = Math.min(
    nextStopAlong(vehicleId, drive),
    nextDropAlong(vehicleId, drive),
    total,
  );
  if (target <= drive.mover.along + 1) return false;
  drive.mover = { ...drive.mover, along: target };
  return true;
};

const sharedRideOf = (user: string | null): Row | null => {
  const mine = user ? commuterIdOf(user) : undefined;
  if (!mine) return null;
  const companion = db.tables.pickup_companion
    .filter((c) => {
      const request = requestOf(c.request_id);
      return (
        c.commuter_id === mine &&
        c.companion_status === "accepted" &&
        request?.request_type === "Pickup" &&
        ["pending", "accepted", "riding"].includes(String(request.request_status))
      );
    })
    .sort((x, y) => timeOf(y.responded_at) - timeOf(x.responded_at))[0];
  return companion ? (requestOf(companion.request_id) ?? null) : null;
};

export function hasLiveSharedRide(): boolean {
  return sharedRideOf(currentUserId()) !== null;
}

export type SharedJourney = { routeId: string; from: Row; to: Row };

export function planSharedJourney(near: LatLngPair): SharedJourney | null {
  const preferred = seedVehicleId("mario");
  const routeIds = new Set<string>();
  db.tables.vehicle
    .filter((v) => v.vehicle_type === "Jeepney" && driverOfVehicle(v.vehicle_id))
    .sort((x, y) => Number(y.vehicle_id === preferred) - Number(x.vehicle_id === preferred))
    .forEach((vehicle) => {
      const routeId = activeTrip(vehicle.vehicle_id)?.route_id ?? vehicle.route_id;
      if (routeId) routeIds.add(String(routeId));
    });
  let best: (SharedJourney & { meters: number }) | null = null;
  for (const routeId of routeIds) {
    const path = routePath(routeId);
    if (!path || path.length < 2) continue;
    const total = pathLengthMeters(path);
    const areas = routeAreas(path);
    const snappedAlong = nearestPointOnPath(toPoint(near), path).alongMeters;
    const snapped = pointAtAlong(path, snappedAlong);
    const starts = [
      ...areas.map((a) => ({ along: a.along, area: a.area, point: a.point })),
      { along: snappedAlong, area: pointArea(snapped), point: snapped },
    ];
    for (const from of starts) {
      if (from.along + DROP_GAP_M > total) continue;
      const meters = metersBetween(near, from.point);
      if (best && meters >= best.meters) continue;
      const drops = areas.filter((a) => a.along >= from.along + DROP_GAP_M);
      const to = drops.length
        ? drops.reduce((pick, a) =>
            Math.abs(a.along - from.along - DROP_TARGET_M) <
            Math.abs(pick.along - from.along - DROP_TARGET_M)
              ? a
              : pick,
          ).area
        : pointArea(pointAtAlong(path, Math.min(total, from.along + DROP_TARGET_M)));
      best = { routeId, from: from.area, to, meters };
    }
  }
  return best ? { routeId: best.routeId, from: best.from, to: best.to } : null;
}

const patchRow = (table: "request" | "pickup" | "pickup_companion", row: Row, values: Row) => {
  Object.assign(row, values);
  db.emit({ table, type: "UPDATE", row });
};

export type GenerateRideResult = { ok: boolean; message: string };

const rideListeners = new Set<() => void>();

export function subscribeDemoRides(fn: () => void): () => void {
  rideListeners.add(fn);
  return () => {
    rideListeners.delete(fn);
  };
}

const hostedPickupOf = (user: string | null): Row | null => {
  const mine = user ? commuterIdOf(user) : undefined;
  if (!mine) return null;
  return (
    db.tables.request
      .filter(
        (r) =>
          r.commuter_id === mine &&
          r.request_type === "Pickup" &&
          ["pending", "accepted", "riding"].includes(String(r.request_status)) &&
          pickupOf(r.request_id),
      )
      .sort((x, y) => timeOf(y.request_date) - timeOf(x.request_date))[0] ?? null
  );
};

export function hostedPickupId(): string | null {
  const request = hostedPickupOf(currentUserId());
  return request ? String(request.request_id) : null;
}

export function sharedRideId(): string | null {
  const request = sharedRideOf(currentUserId());
  return request ? String(request.request_id) : null;
}

export function fastForwardPickup(requestId: string): GenerateRideResult {
  const request = requestOf(requestId);
  const pickup = pickupOf(requestId);
  if (!request || !pickup || request.request_type !== "Pickup")
    return { ok: false, message: "This pickup is no longer available." };
  const id = String(request.request_id);
  if (request.request_status === "riding")
    return { ok: false, message: "Already on board" };
  if (request.request_status === "accepted" || jobs.get(id)?.vehicleId)
    return { ok: false, message: "Driver already coming" };
  if (request.request_status !== "pending")
    return { ok: false, message: "This pickup is no longer available." };
  if (!pickup.route_id || pickup.dropoff_lat == null || pickup.dropoff_lng == null) {
    const plan = planSharedJourney(pickupPointOf(request, pickup));
    if (!plan) return { ok: false, message: "No route here" };
    patchRow("pickup", pickup, {
      route_id: plan.routeId,
      requested_vehicle_type: "Jeepney",
      pickup_destination: String(plan.from.area_name),
      pickup_lat: plan.from.area_latitude,
      pickup_lng: plan.from.area_longitude,
      waiting_area_id: plan.from.area_id ?? null,
      dropoff_name: String(plan.to.area_name),
      dropoff_lat: plan.to.area_latitude,
      dropoff_lng: plan.to.area_longitude,
    });
  }
  for (const companion of db.tables.pickup_companion.filter(
    (c) => c.request_id === id && c.companion_status === "pending",
  )) {
    const name = companionDisplayName(companion.commuter_id);
    if (companionBusyTrip(companion.commuter_id)) declineCompanionInvite(companion, name);
    else acceptCompanionInvite(companion, name);
  }
  const target = pickupPointOf(request, pickup);
  for (const companion of db.tables.pickup_companion.filter(
    (c) => c.request_id === id && c.companion_status === "accepted",
  )) {
    companionWalks.delete(companionKey(companion));
    if (!companion.arrived_at) patchRow("pickup_companion", companion, { arrived_at: iso() });
  }
  const user = currentUserId();
  if (user && ridersOf(request).includes(user)) {
    walks.delete(user);
    placeUser(user, target);
  }
  patchRow("request", request, {
    is_draft: false,
    owner_present_at: request.owner_present_at ?? iso(),
  });
  tryBroadcastPickup(id);
  const job = jobs.get(id);
  if (job) job.acceptAt = clock;
  else jobs.set(id, { requestId: id, acceptAt: clock, vehicleId: null, endTrip: false });
  start();
  for (const fn of rideListeners) fn();
  return { ok: true, message: "Ride ready" };
}

export function generateSharedRide(): GenerateRideResult {
  const id = sharedRideId();
  return id ? fastForwardPickup(id) : { ok: false, message: "Join a shared ride first" };
}

export function arriveNow(): boolean {
  const user = currentUserId();
  if (!user) return false;
  let done = false;
  const walk = walks.get(user);
  if (walk) {
    advance(walk, Infinity);
    done = true;
  }
  const mine = commuterIdOf(user);
  for (const [key, mover] of [...companionWalks]) {
    if (!isMemberOf(requestOf(key.split(":")[0]), mine)) continue;
    advance(mover, Infinity);
    done = true;
  }
  if (!done) {
    for (const job of jobs.values()) {
      const request = requestOf(job.requestId);
      if (!job.vehicleId || !request || !ridersOf(request).includes(user)) continue;
      const drive = drives.get(job.vehicleId);
      if (drive?.mode !== "job") continue;
      moveDrive(job.vehicleId, Infinity);
      done = true;
    }
  }
  const vehicleId = personnelVehicle(user);
  if (!done && vehicleId) done = finishDriverLeg(vehicleId);
  if (done) update(0);
  return done;
}

const MAX_OPEN_MANUAL = 5;
const SEND_BURST = 3;
const SEND_WINDOW_MS = 10_000;
let manualSends: number[] = [];

const sendRateReason = (): string | null => {
  const now = Date.now();
  manualSends = manualSends.filter((at) => now - at < SEND_WINDOW_MS);
  if (manualSends.length < SEND_BURST) return null;
  const wait = Math.max(1, Math.ceil((SEND_WINDOW_MS - (now - manualSends[0])) / 1000));
  return `Max ${SEND_BURST} per ${SEND_WINDOW_MS / 1000}s · wait ${wait}s`;
};

export function sendPickupRequest(): boolean {
  if (sendRateReason()) return false;
  const sent = spawnNearbyRequest(personnelVehicle(currentUserId()), MAX_OPEN_MANUAL) === null;
  if (sent) manualSends.push(Date.now());
  return sent;
}

export function sendPickupRequestReason(): string | null {
  const rate = sendRateReason();
  if (rate) return rate;
  const context = spawnContext(personnelVehicle(currentUserId()), MAX_OPEN_MANUAL);
  if (typeof context === "string") return context;
  const plan = nearbySpawnPlan(context);
  return typeof plan === "string" ? plan : null;
}

export function dismissPickupRequest(requestId: string): boolean {
  if (!spawned.has(requestId) || requestOf(requestId)?.request_status !== "pending")
    return false;
  cancelSpawned(requestId);
  return true;
}

function getState(): EngineState {
  return { running: timer !== null, paused, speed };
}

export function start(): void {
  if (timer || paused) return;
  timer = setInterval(tick, TICK_MS);
  (timer as { unref?: () => void }).unref?.();
  emitState();
}

export function pause(): void {
  paused = true;
  stop();
  emitState();
}

export function resume(): void {
  paused = false;
  start();
}

export function isPaused(): boolean {
  return paused;
}

export function stop(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  emitState();
}

export function setSpeed(next: Speed): void {
  if (speed === next) return;
  speed = next;
  emitState();
}

export function getSpeed(): Speed {
  return speed;
}

export function setPickupWalkScreenActive(active: boolean): void {
  pickupWalkScreenActive = active;
}

export function isPickupWalkScreenActive(): boolean {
  return pickupWalkScreenActive;
}

export function forgetVehicles(ids: Iterable<string>): void {
  for (const id of ids) {
    drives.delete(id);
    vehiclePoints.delete(id);
    occupancy.delete(id);
    loadingStops.delete(id);
  }
  emitState();
}

export function reset(): void {
  if (timer) clearInterval(timer);
  timer = null;
  speed = DEFAULT_SPEED;
  pickupWalkScreenActive = false;
  paused = false;
  clock = 0;
  lastSpawn = -Infinity;
  riderTurn = 0;
  drives.clear();
  walks.clear();
  points.clear();
  vehiclePoints.clear();
  jobs.clear();
  companionStarts.clear();
  companionWalks.clear();
  spawned.clear();
  skipped.clear();
  manualSends = [];
  occupancy.clear();
  loadingStops.clear();
  devicePoints.clear();
  simAnchors.clear();
  resetRentals();
  emitState();
}

export function subscribe(fn: (state: EngineState) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
