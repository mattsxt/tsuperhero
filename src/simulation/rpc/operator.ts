import { currentUserId } from "@/simulation/auth";
import { db, type Row, type TableName } from "@/simulation/db";
import { setRequestStatus } from "@/simulation/rpc/pickups";
import { COOPERATIVE_ID } from "@/simulation/seed/people";
import { getDistanceMeters } from "@/utils/geo";

const fail = (message: string, code = "22023"): never => {
  throw Object.assign(new Error(message), { code });
};

const iso = () => db.now().toISOString();
const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
const timeOf = (v: unknown) => new Date(String(v)).getTime();
const FRESH_MS = 60_000;

const myPersonnelId = () =>
  db.tables.transit_personnel.find((p) => p.user_id === currentUserId())
    ?.personnel_id;

const myDriver = () =>
  db.tables.driver.find(
    (d) => d.personnel_id === myPersonnelId() && d.vehicle_id,
  );

const myVehicleId = (): string | null =>
  (myDriver()?.vehicle_id as string | undefined) ?? null;

const requireVehicleId = (): string =>
  myVehicleId() ?? fail("You are not assigned to a vehicle.", "42501");

const vehicleOf = (id: unknown) =>
  db.tables.vehicle.find((v) => v.vehicle_id === id);
const locationOf = (id: unknown) =>
  db.tables.location_records.find((l) => l.vehicle_id === id);
const requestOf = (id: unknown) =>
  db.tables.request.find((r) => r.request_id === id);
const pickupOf = (id: unknown) =>
  db.tables.pickup.find((p) => p.request_id === id);

const emitUpdate = (table: TableName, row: Row, values: Row) => {
  Object.assign(row, values);
  db.emit({ table, type: "UPDATE", row });
};

const activeTrip = (vehicleId: unknown) =>
  db.tables.trip
    .filter((t) => t.vehicle_id === vehicleId && t.trip_status === "active")
    .sort((x, y) => timeOf(y.departure_time) - timeOf(x.departure_time))[0];

const latestTrip = (vehicleId: unknown) =>
  db.tables.trip
    .filter((t) => t.vehicle_id === vehicleId)
    .sort((x, y) => timeOf(y.departure_time) - timeOf(x.departure_time))[0];

const routeIdOf = (vehicle: Row) =>
  vehicle.route_id ?? latestTrip(vehicle.vehicle_id)?.route_id ?? null;

const liveLocation = (vehicleId: unknown) => {
  const vehicle = vehicleOf(vehicleId);
  const loc = locationOf(vehicleId);
  if (
    !vehicle ||
    !loc ||
    !["on-trip", "loading"].includes(String(vehicle.vehicle_status)) ||
    timeOf(loc.recorded_at) <= db.now().getTime() - FRESH_MS
  )
    return null;
  return loc;
};

const meters = (lat1: number, lng1: number, lat2: number, lng2: number) =>
  getDistanceMeters({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });

const pickupPoint = (request: Row, pickup: Row): [number, number] => [
  num(pickup.pickup_lat ?? request.device_latitude),
  num(pickup.pickup_lng ?? request.device_longitude),
];

export const setVehiclePosition = (
  vehicleId: string,
  lat: number,
  lng: number,
  speedKmh = 0,
  heading = 0,
): void => {
  const values = {
    records_latitude: lat,
    records_longitude: lng,
    speed_kmh: Math.max(speedKmh, 0),
    heading,
    recorded_at: iso(),
  };
  const existing = locationOf(vehicleId);
  if (existing) {
    emitUpdate("location_records", existing, values);
    return;
  }
  const row = { vehicle_id: vehicleId, ...values };
  db.tables.location_records.push(row);
  db.emit({ table: "location_records", type: "INSERT", row });
};

const dropLocation = (vehicleId: unknown) => {
  const index = db.tables.location_records.findIndex(
    (l) => l.vehicle_id === vehicleId,
  );
  if (index < 0) return;
  const [row] = db.tables.location_records.splice(index, 1);
  db.emit({ table: "location_records", type: "DELETE", row });
};

export const releasePickupEffect = (requestId: string): void => {
  const request = requestOf(requestId);
  if (!request) return;
  setRequestStatus(requestId, "pending");
  emitUpdate("request", request, { driver_id: null });
  const pickup = pickupOf(requestId);
  if (pickup) emitUpdate("pickup", pickup, { vehicle_id: null });
};

const releaseVehiclePickups = (vehicleId: string) => {
  const mine = db.tables.pickup.filter((p) => p.vehicle_id === vehicleId);
  for (const pickup of mine) {
    const request = requestOf(pickup.request_id);
    if (request?.request_type !== "Pickup") continue;
    if (request.request_status === "riding") {
      emitUpdate("pickup", pickup, {
        dropped_at: pickup.dropped_at ?? iso(),
      });
      setRequestStatus(String(request.request_id), "completed");
    } else if (request.request_status === "accepted") {
      releasePickupEffect(String(request.request_id));
    }
  }
  for (const pickup of mine) {
    if (
      pickup.vehicle_id &&
      requestOf(pickup.request_id)?.request_status === "pending"
    )
      emitUpdate("pickup", pickup, { vehicle_id: null });
  }
};

const completeActiveTrips = (vehicleId: string, extra: Row = {}) => {
  for (const trip of db.tables.trip.filter(
    (t) => t.vehicle_id === vehicleId && t.trip_status === "active",
  ))
    emitUpdate("trip", trip, {
      trip_status: "completed",
      arrival_time: trip.arrival_time ?? iso(),
      ...extra,
    });
};

const getMyVehicleAssignment = () => {
  const driver = myDriver();
  const vehicle = vehicleOf(driver?.vehicle_id);
  if (!driver || !vehicle) return null;
  const operator = db.tables.operator.find(
    (o) => o.operator_id === vehicle.operator_id,
  );
  const personnel = db.tables.transit_personnel.find(
    (p) => p.personnel_id === operator?.personnel_id,
  );
  const profile = db.tables.profile.find((p) => p.user_id === personnel?.user_id);
  return {
    role: "driver",
    vehicle: {
      vehicle_id: vehicle.vehicle_id,
      plate_number: vehicle.plate_number,
      vehicle_type: vehicle.vehicle_type,
      vehicle_status: vehicle.vehicle_status,
      max_capacity: vehicle.max_capacity,
      current_capacity: vehicle.current_capacity ?? 0,
      is_full: vehicle.is_full ?? false,
      is_modern: vehicle.is_modern,
      documents_checked: vehicle.documents_checked ?? null,
      verified_at: vehicle.verified_at ?? null,
    },
    operator: operator
      ? {
          operator_type: operator.operator_type,
          name: [profile?.first_name, profile?.last_name]
            .filter(Boolean)
            .join(" "),
        }
      : null,
    cooperative:
      vehicle.cooperative_id === COOPERATIVE_ID
        ? {
            cooperative_id: COOPERATIVE_ID,
            cooperative_name: "Bicol Demo Transport Cooperative",
            cooperative_address: "Magsaysay Avenue, Naga City, Camarines Sur",
            date_registered: "2019-06-12",
            registration_no: "DEMO-COOP-0001",
          }
        : null,
    route_id: routeIdOf(vehicle),
  };
};

const manilaStamp = (date: Date) => {
  const shifted = new Date(date.getTime() + 8 * 3_600_000)
    .toISOString()
    .replace(/[-:]/g, "");
  return { day: shifted.slice(0, 8), time: shifted.slice(9, 15) };
};

export const startTripEffect = (
  target: string,
  driverIdValue: unknown,
  routeId: unknown,
  distanceTotalKm: number,
): unknown => {
  const vehicle = vehicleOf(target)!;
  const route = db.tables.route.find((r) => r.route_id === routeId);
  completeActiveTrips(target);
  const now = db.now();
  const stamp = manilaStamp(now);
  const trip: Row = {
    trip_id: db.id(),
    driver_id: driverIdValue,
    vehicle_id: target,
    route_id: routeId,
    trip_date: now.toISOString().slice(0, 10),
    trip_status: "active",
    trip_destination: route?.route_name ?? "",
    departure_time: now.toISOString(),
    arrival_time: null,
    trip_code: `TRP-${stamp.day}-${stamp.time}-${Math.random()
      .toString(16)
      .slice(2, 6)
      .toUpperCase()}`,
    distance_done_km: 0,
    distance_total_km: Math.max(distanceTotalKm || 0, 0),
  };
  db.tables.trip.push(trip);
  db.emit({ table: "trip", type: "INSERT", row: trip });
  emitUpdate("vehicle", vehicle, {
    vehicle_status: "on-trip",
    current_capacity: 0,
  });
  return trip.trip_id;
};

const startMyTrip = (a: any) => {
  const target = requireVehicleId();
  const routeId = routeIdOf(vehicleOf(target)!);
  if (!routeId) fail("Your vehicle has no route yet.");
  const driver = myDriver();
  if (!driver) fail("Your vehicle has no driver assigned.");
  return startTripEffect(
    target,
    driver!.driver_id,
    routeId,
    num(a?.p_distance_total_km ?? 0),
  );
};

const setMyVehicleTripState = (a: any) => {
  const target = requireVehicleId();
  const vehicle = vehicleOf(target)!;
  const capacity = num(vehicle.max_capacity);
  const count = num(a.p_current_capacity);
  if (count < 0 || count > capacity)
    fail(`Passenger count must be between 0 and ${capacity}.`);
  const stopped = a.p_status === "idle" || a.p_status === "offline";
  const values: Row = {
    vehicle_status: a.p_status,
    current_capacity: count,
  };
  if (a.p_is_full !== undefined)
    values.is_full = stopped ? false : a.p_is_full === true || count >= capacity;
  emitUpdate("vehicle", vehicle, values);
  if (stopped) {
    dropLocation(target);
    completeActiveTrips(target);
    releaseVehiclePickups(target);
  }
  return null;
};

const shareMyVehicleLocation = (a: any) => {
  const target = requireVehicleId();
  const lat = num(a.p_latitude);
  const lng = num(a.p_longitude);
  if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180))
    fail("Invalid coordinates.");
  const vehicle = vehicleOf(target);
  if (!vehicle || !["on-trip", "loading"].includes(String(vehicle.vehicle_status)))
    fail("Start a trip before sharing your location.", "42501");
  setVehiclePosition(target, lat, lng, num(a.p_speed_kmh ?? 0) || 0, num(a.p_heading ?? 0) || 0);
  return null;
};

const recordVehicleTrail = (a: any) => {
  requireVehicleId();
  const points = a.p_points;
  if (!Array.isArray(points) || points.length > 500) fail("Invalid trail.");
  const limit = db.now().getTime() + 5 * 60_000;
  return (points as Row[]).filter((p) => {
    const lat = num(p.latitude);
    const lng = num(p.longitude);
    return (
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      timeOf(p.recorded_at) <= limit
    );
  }).length;
};

const getMyNearbyPickups = () => {
  const target = myVehicleId();
  const loc = target ? liveLocation(target) : null;
  if (!target || !loc) return [];
  const vehicle = vehicleOf(target)!;
  const tripRoute = activeTrip(target)?.route_id ?? null;
  const here: [number, number] = [num(loc.records_latitude), num(loc.records_longitude)];
  const out: {
    request_id: unknown;
    latitude: number;
    longitude: number;
    passengers: unknown;
    distance_m: number;
  }[] = [];
  for (const request of db.tables.request) {
    if (
      request.request_type !== "Pickup" ||
      request.request_status !== "pending" ||
      request.is_draft !== false ||
      !request.arrived_at
    )
      continue;
    const pickup = pickupOf(request.request_id);
    if (
      !pickup ||
      pickup.vehicle_id ||
      pickup.requested_vehicle_type !== vehicle.vehicle_type ||
      (pickup.route_id && pickup.route_id !== tripRoute)
    )
      continue;
    const [lat, lng] = pickupPoint(request, pickup);
    const distance = meters(lat, lng, here[0], here[1]);
    if (distance <= 300)
      out.push({
        request_id: request.request_id,
        latitude: lat,
        longitude: lng,
        passengers: pickup.number_of_passengers,
        distance_m: distance,
      });
  }
  return out.sort((x, y) => x.distance_m - y.distance_m);
};

export const acceptPickupEffect = (
  requestId: string,
  target: string,
  driverIdValue: unknown,
): void => {
  const request = requestOf(requestId)!;
  const pickup = pickupOf(requestId)!;
  const vehicle = vehicleOf(target)!;
  request.driver_id = driverIdValue;
  setRequestStatus(requestId, "accepted");
  emitUpdate("pickup", pickup, { vehicle_id: target });
  emitUpdate("vehicle", vehicle, {
    current_capacity:
      num(vehicle.current_capacity ?? 0) + num(pickup.number_of_passengers),
  });
};

const acceptPickupRequest = (a: any) => {
  const target = requireVehicleId();
  const loc = liveLocation(target);
  if (!loc) fail("Start a trip before accepting pickups.", "42501");
  const request = requestOf(a.p_request_id);
  if (
    !request ||
    request.request_type !== "Pickup" ||
    request.request_status !== "pending"
  )
    fail("This request is no longer available.");
  const pickup = pickupOf(a.p_request_id);
  if (!pickup || pickup.vehicle_id)
    fail("This request is no longer available.");
  if (pickup!.route_id && activeTrip(target)?.route_id !== pickup!.route_id)
    fail("This pickup is on a different route.");
  const vehicle = vehicleOf(target)!;
  if (
    !pickup!.requested_vehicle_type ||
    pickup!.requested_vehicle_type !== vehicle.vehicle_type
  )
    fail("This request is for a different vehicle type.");
  const [lat, lng] = pickupPoint(request!, pickup!);
  if (meters(lat, lng, num(loc!.records_latitude), num(loc!.records_longitude)) > 400)
    fail("This request is too far away.");
  const passengers = num(pickup!.number_of_passengers);
  const current = num(vehicle.current_capacity ?? 0);
  if (current + passengers > num(vehicle.max_capacity))
    fail("Not enough seats for this request.");
  acceptPickupEffect(String(a.p_request_id), target, myDriver()?.driver_id ?? null);
  return passengers;
};

export const boardPickupEffect = (requestId: string, target: string): number => {
  const request = requestOf(requestId)!;
  const pickup = pickupOf(requestId)!;
  const trip = activeTrip(target);
  const driver = request.driver_id ?? trip?.driver_id ?? null;
  setRequestStatus(requestId, "riding");
  emitUpdate("pickup", pickup, { boarded_at: iso() });
  if (trip && driver) {
    const history = {
      history_id: db.id(),
      commuter_id: request.commuter_id,
      driver_id: driver,
      trip_id: trip.trip_id,
      boarded_at: iso(),
    };
    db.tables.trip_history.push(history);
    db.emit({ table: "trip_history", type: "INSERT", row: history });
  }
  const vehicle = vehicleOf(target)!;
  const passengers = num(pickup.number_of_passengers);
  emitUpdate("vehicle", vehicle, {
    current_capacity: Math.min(
      num(vehicle.max_capacity),
      num(vehicle.current_capacity ?? 0) + passengers,
    ),
  });
  return passengers;
};

const boardPickup = (a: any) => {
  const target = requireVehicleId();
  const loc = liveLocation(target);
  if (!loc) fail("Start a trip before picking up passengers.", "42501");
  const request = requestOf(a.p_request_id);
  if (!request || request.request_status !== "accepted")
    fail("This pickup is no longer waiting.");
  const pickup = pickupOf(a.p_request_id);
  if (!pickup || pickup.vehicle_id !== target)
    fail("This pickup belongs to another vehicle.", "42501");
  const [lat, lng] = pickupPoint(request!, pickup!);
  if (meters(lat, lng, num(loc!.records_latitude), num(loc!.records_longitude)) > 100)
    fail("You haven't reached the pickup point yet.");
  return boardPickupEffect(String(a.p_request_id), target);
};

const getMyVehicleRiders = () => {
  const target = myVehicleId();
  if (!target) return [];
  return db.tables.pickup
    .filter((p) => {
      const r = requestOf(p.request_id);
      return (
        p.vehicle_id === target &&
        r?.request_type === "Pickup" &&
        r.request_status === "riding"
      );
    })
    .map((p) => ({
      request_id: p.request_id,
      passengers: p.number_of_passengers,
      dropoff_name: p.dropoff_name ?? p.pickup_destination ?? null,
      dropoff_lat: p.dropoff_lat ?? null,
      dropoff_lng: p.dropoff_lng ?? null,
    }));
};

const endMyTrip = (a: any) => {
  endTripEffect(requireVehicleId(), num(a?.p_distance_done_km ?? 0));
  return null;
};

export const endTripEffect = (target: string, distanceDoneKm: number): void => {
  const done = Math.max(distanceDoneKm || 0, 0);
  for (const trip of db.tables.trip.filter(
    (t) => t.vehicle_id === target && t.trip_status === "active",
  ))
    emitUpdate("trip", trip, {
      trip_status: "completed",
      arrival_time: iso(),
      distance_done_km: done,
      distance_total_km: Math.max(num(trip.distance_total_km ?? 0) || 0, done),
    });
  releaseVehiclePickups(target);
  const vehicle = vehicleOf(target);
  if (vehicle)
    emitUpdate("vehicle", vehicle, {
      vehicle_status: "idle",
      current_capacity: 0,
    });
  dropLocation(target);
};

const getMyTrips = () => {
  const target = myVehicleId();
  const personnel = myPersonnelId();
  const mine = new Set(
    db.tables.driver
      .filter((d) => d.personnel_id === personnel)
      .map((d) => d.driver_id),
  );
  return db.tables.trip
    .filter(
      (t) =>
        ["active", "completed"].includes(String(t.trip_status)) &&
        (mine.has(t.driver_id) || (target !== null && t.vehicle_id === target)),
    )
    .sort((x, y) => timeOf(y.departure_time) - timeOf(x.departure_time))
    .map((t) => {
      const vehicle = vehicleOf(t.vehicle_id);
      return {
        trip_id: t.trip_id,
        trip_code: t.trip_code,
        trip_status: t.trip_status,
        departure_time: t.departure_time ?? null,
        arrival_time: t.arrival_time ?? null,
        distance_done_km: t.distance_done_km ?? null,
        distance_total_km: t.distance_total_km ?? null,
        route_name:
          db.tables.route.find((r) => r.route_id === t.route_id)?.route_name ??
          null,
        plate_number: vehicle?.plate_number ?? null,
        vehicle_type: vehicle?.vehicle_type ?? null,
        pickups: db.tables.trip_history.filter((h) => h.trip_id === t.trip_id)
          .length,
      };
    });
};

export const operatorHandlers: Record<string, (args: any) => unknown> = {
  get_my_vehicle_assignment: getMyVehicleAssignment,
  start_my_trip: startMyTrip,
  set_my_vehicle_trip_state: setMyVehicleTripState,
  share_my_vehicle_location: shareMyVehicleLocation,
  record_vehicle_trail: recordVehicleTrail,
  get_my_nearby_pickups: getMyNearbyPickups,
  accept_pickup_request: acceptPickupRequest,
  board_pickup: boardPickup,
  get_my_vehicle_riders: getMyVehicleRiders,
  end_my_trip: endMyTrip,
  get_my_trips: getMyTrips,
};
