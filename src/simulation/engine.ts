import { currentUserId } from "@/simulation/auth";
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
  setVehiclePosition,
  startTripEffect,
} from "@/simulation/rpc/operator";
import {
  acceptCompanionInvite,
  companionDisplayName,
  companionPresenceEffect,
  completeRideEffect,
  routeFitsPoints,
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
export type EngineState = { running: boolean; speed: Speed };
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
const COMPANION_DELAY_S = 3;
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
let clock = 0;
let lastSpawn = -Infinity;
let riderTurn = 0;
const listeners = new Set<(state: EngineState) => void>();
const drives = new Map<string, Drive>();
const walks = new Map<string, Mover>();
const points = new Map<string, LatLngPair>();
const vehiclePoints = new Map<string, LatLngPair>();
const jobs = new Map<string, Job>();
const invites = new Map<string, number>();
const companionWalks = new Map<string, Mover>();
const spawned = new Set<string>();
const skipped = new Set<string>();

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
  const path = route?.path;
  return Array.isArray(path) && path.length > 1 ? (path as LatLngPair[]) : null;
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

const startCruise = (vehicleId: string) => {
  const vehicle = vehicleOf(vehicleId);
  const path =
    routePath(activeTrip(vehicleId)?.route_id ?? vehicle?.route_id) ??
    vehicleCircuit(vehicleId);
  const here = vehiclePoint(vehicleId);
  const mover: Mover = path
    ? cruiseMover(vehicleId, path, nearestPointOnPath(toPoint(here), path).alongMeters)
    : { id: vehicleId, path: [here], along: 0, speedKmh: VEHICLE_KMH };
  drives.set(vehicleId, { mode: "cruise", mover, dwell: 0, stopped: !path });
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
) => {
  drives.set(vehicleId, {
    mode: "job",
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
  sendDrive(vehicleId, legPath(from, to, routeId), (end) => completeJob(job, end));
};

const completeJob = (job: Job, at: MoverPosition) => {
  const request = requestOf(job.requestId);
  if (job.vehicleId) placeVehicle(job.vehicleId, at, 0);
  if (request) for (const user of ridersOf(request)) points.set(user, [at.lat, at.lng]);
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
  sendDrive(vehicleId, legPath(vehiclePoint(vehicleId), target, routeId), (end) =>
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

const runCompanions = (user: string | null, seconds: number) => {
  const mine = user ? commuterIdOf(user) : undefined;
  for (const companion of db.tables.pickup_companion) {
    const request = requestOf(companion.request_id);
    if (
      !mine ||
      !request ||
      request.commuter_id !== mine ||
      request.request_status !== "pending"
    )
      continue;
    const key = companionKey(companion);
    if (companion.companion_status === "pending") {
      const due = invites.get(key);
      if (due === undefined) invites.set(key, clock + COMPANION_DELAY_S);
      else if (clock + seconds >= due) {
        invites.delete(key);
        acceptCompanionInvite(companion, companionDisplayName(companion.commuter_id));
      }
      continue;
    }
    if (companion.companion_status !== "accepted" || companion.arrived_at) continue;
    const pickup = pickupOf(request.request_id);
    if (!pickup || pickup.pickup_lat == null || pickup.pickup_lng == null) continue;
    const target = pickupPointOf(request, pickup);
    const existing = companionWalks.get(key);
    if (!existing || metersBetween(existing.path[existing.path.length - 1], target) > 1) {
      const from = existing
        ? ([positionOf(existing).lat, positionOf(existing).lng] as LatLngPair)
        : homeOf(commuterUserId(companion.commuter_id));
      companionWalks.set(key, {
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
      });
    }
  }
};

const moveCompanions = (seconds: number) => {
  for (const [key, mover] of [...companionWalks]) {
    const next = advance(mover, seconds);
    if (companionWalks.get(key) === mover) companionWalks.set(key, next);
  }
};

const moveWalks = (seconds: number) => {
  for (const [user, mover] of [...walks]) {
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
  const path = routePath(routeId);
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
  for (const vehicle of db.tables.vehicle) {
    const id = String(vehicle.vehicle_id);
    if (id === driven) continue;
    const drive = drives.get(id);
    if (drive?.mode === "trip") {
      drives.delete(id);
      continue;
    }
    if (drive?.mode === "job") {
      moveDrive(id, seconds);
      if (drives.get(id)) syncDrive(id);
      continue;
    }
    if (!isLive(vehicle) || id === personnelVehicle(currentUserId())) {
      if (drive) drives.delete(id);
      continue;
    }
    if (!drive) startCruise(id);
    moveDrive(id, seconds);
    syncDrive(id);
  }
};

const trackRiders = () => {
  for (const request of db.tables.request) {
    if (request.request_type !== "Pickup" || request.request_status !== "riding") continue;
    const pickup = pickupOf(request.request_id);
    if (!pickup?.vehicle_id || !locationOf(pickup.vehicle_id)) continue;
    const at = vehiclePoint(pickup.vehicle_id);
    for (const user of ridersOf(request)) points.set(user, at);
  }
};

const openSpawned = () =>
  [...spawned].filter((id) =>
    ["pending", "accepted"].includes(String(requestOf(id)?.request_status)),
  );

const spawnRequest = (vehicleId: string): boolean => {
  const drive = drives.get(vehicleId);
  const trip = activeTrip(vehicleId);
  const vehicle = vehicleOf(vehicleId);
  if (drive?.mode !== "trip" || !trip || !vehicle || drive.mover.path.length < 2)
    return false;
  const open = openSpawned();
  if (open.length >= MAX_OPEN) return false;
  const used = new Set(open.map((id) => pickupOf(id)?.waiting_area_id));
  const path = drive.mover.path;
  const areas = db.tables.waiting_area
    .filter((w) => w.is_active)
    .map((w) => {
      const point: LatLngPair = [num(w.area_latitude), num(w.area_longitude)];
      return { area: w, point, distance: distanceToPath(toPoint(point), path), along: nearestPointOnPath(toPoint(point), path).alongMeters };
    })
    .filter((a) => a.distance <= ON_ROUTE_M)
    .sort((x, y) => x.along - y.along);
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
  if (!rider) return false;
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
    if (!routeFitsPoints(trip.route_id, from.point, to.point, 25)) continue;
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

const update = (seconds: number) => {
  const user = currentUserId();
  discoverRequests(user);
  runCompanions(user, seconds);
  clock += seconds;
  checkJobs();
  moveWalks(seconds);
  moveCompanions(seconds);
  const driven = runDriver(user, seconds);
  runVehicles(driven, seconds);
  trackRiders();
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
    points.set(user, [fix.lat, fix.lng]);
    return fix;
  }
  const walk = walks.get(user);
  if (walk) {
    const position = positionOf(walk);
    return { ...position, speedMps: (WALK_KMH * speed) / 3.6 };
  }
  const [lat, lng] = points.get(user) ?? homeOf(user);
  return { lat, lng, heading: 0, speedMps: 0 };
};

export const walkTo = (
  target: { lat: number; lng: number } | null,
  route: LatLngPair[] | null = null,
): void => {
  const user = currentUserId();
  if (!user || personnelVehicle(user) || ridingVehicle(user)) return;
  const here = userFix(user);
  const from: LatLngPair = [here.lat, here.lng];
  if (!target) {
    if (walks.delete(user)) points.set(user, from);
    return;
  }
  const to: LatLngPair = [target.lat, target.lng];
  const current = walks.get(user);
  const routed = route && route.length > 1 ? route : null;
  if (!routed && current && metersBetween(current.path[current.path.length - 1], to) < 1)
    return;
  if (metersBetween(from, to) < 1) {
    walks.delete(user);
    points.set(user, to);
    return;
  }
  walks.set(user, {
    id: user,
    path: routed ? [from, ...routed, to] : [from, to],
    along: 0,
    speedKmh: WALK_KMH,
    onArrive: () => {
      walks.delete(user);
      points.set(user, to);
    },
  });
};

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
    if (requestOf(key.split(":")[0])?.commuter_id !== mine) continue;
    advance(mover, Infinity);
    done = true;
  }
  if (!done) {
    for (const job of jobs.values()) {
      const request = requestOf(job.requestId);
      if (!job.vehicleId || request?.commuter_id !== mine) continue;
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

export function sendPickupRequest(): boolean {
  const vehicleId = personnelVehicle(currentUserId());
  if (!vehicleId || drives.get(vehicleId)?.mode !== "trip") return false;
  return spawnRequest(vehicleId);
}

function getState(): EngineState {
  return { running: timer !== null, speed };
}

export function start(): void {
  if (timer) return;
  timer = setInterval(tick, TICK_MS);
  (timer as { unref?: () => void }).unref?.();
  emitState();
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

export function reset(): void {
  if (timer) clearInterval(timer);
  timer = null;
  speed = DEFAULT_SPEED;
  clock = 0;
  lastSpawn = -Infinity;
  riderTurn = 0;
  drives.clear();
  walks.clear();
  points.clear();
  vehiclePoints.clear();
  jobs.clear();
  invites.clear();
  companionWalks.clear();
  spawned.clear();
  skipped.clear();
  emitState();
}

export function subscribe(fn: (state: EngineState) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
