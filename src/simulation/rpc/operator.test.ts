import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { signInAs } from "@/simulation/auth";
import { db, type Row } from "@/simulation/db";
import { handlers } from "@/simulation/rpc";
import { setVehiclePosition } from "@/simulation/rpc/operator";
import { commuterId, driverId, userId, vehicleId } from "@/simulation/seed/people";

const call = (name: string, args: unknown = {}) => handlers[name](args) as any;

const asMario = () => signInAs(userId("mario"), "mario@demo.tsuperhero");
const asPedro = () => signInAs(userId("pedro"), "pedro@demo.tsuperhero");

const route = () => db.tables.route.find((r) => r.route_code === "DEL-CON-MAG-CEN")!;
const otherRoute = () => db.tables.route.find((r) => r.route_code === "DEL-CON-PAN-CEN")!;
const point = () => (route().path as [number, number][])[5];
const vehicle = () => db.tables.vehicle.find((v) => v.vehicle_id === vehicleId("mario"))!;

const addRequest = (opts: {
  routeId: unknown;
  passengers?: number;
  at?: [number, number];
  type?: string;
  owner?: string;
}) => {
  const [lat, lng] = opts.at ?? point();
  const id = db.id();
  db.tables.request.push({
    request_id: id,
    request_type: "Pickup",
    request_status: "pending",
    is_draft: false,
    commuter_id: commuterId(opts.owner ?? "juan"),
    driver_id: null,
    arrived_at: new Date().toISOString(),
    request_date: new Date().toISOString(),
    device_latitude: lat,
    device_longitude: lng,
  });
  db.tables.pickup.push({
    request_id: id,
    number_of_passengers: opts.passengers ?? 1,
    requested_vehicle_type: opts.type ?? "Jeepney",
    route_id: opts.routeId,
    pickup_lat: lat,
    pickup_lng: lng,
    dropoff_name: "Centro",
    pickup_destination: "Centro",
    vehicle_id: null,
    boarded_at: null,
    dropped_at: null,
  });
  return id;
};

const startAt = (at: [number, number] = point()) => {
  call("start_my_trip", { p_distance_total_km: 8 });
  setVehiclePosition(vehicleId("mario"), at[0], at[1], 10, 90);
};

const requestRow = (id: string): Row => db.tables.request.find((r) => r.request_id === id)!;
const pickupRow = (id: string): Row => db.tables.pickup.find((p) => p.request_id === id)!;

beforeEach(() => {
  db.reset();
  asMario();
});

test("assignment returns role, vehicle, operator, cooperative, route", () => {
  const a = call("get_my_vehicle_assignment");
  assert.equal(a.role, "driver");
  assert.equal(a.vehicle.plate_number, "DEMO 101");
  assert.equal(a.vehicle.max_capacity, 24);
  assert.equal(a.operator.name, "Bicol Demo Transport Cooperative");
  assert.equal(a.route_id, route().route_id);
});

test("a request on another route isn't listed, a null-route one is", () => {
  startAt();
  const other = addRequest({ routeId: otherRoute().route_id });
  const same = addRequest({ routeId: route().route_id });
  const open = addRequest({ routeId: null });
  const wrongType = addRequest({ routeId: null, type: "Tricycle" });
  const rows = call("get_my_nearby_pickups");
  const ids = rows.map((r: any) => r.request_id);
  assert.ok(ids.includes(same));
  assert.ok(ids.includes(open));
  assert.ok(!ids.includes(other));
  assert.ok(!ids.includes(wrongType));
  assert.deepEqual(Object.keys(rows[0]).sort(), [
    "distance_m",
    "latitude",
    "longitude",
    "passengers",
    "request_id",
  ]);
});

test("nearby needs a started trip and ignores far or unarrived requests", () => {
  const id = addRequest({ routeId: route().route_id });
  assert.equal(call("get_my_nearby_pickups").length, 0);
  startAt();
  assert.equal(call("get_my_nearby_pickups").length, 1);
  requestRow(id).arrived_at = null;
  assert.equal(call("get_my_nearby_pickups").length, 0);
  requestRow(id).arrived_at = new Date().toISOString();
  setVehiclePosition(vehicleId("mario"), point()[0] + 0.01, point()[1]);
  assert.equal(call("get_my_nearby_pickups").length, 0);
});

test("accept needs a started trip", () => {
  const id = addRequest({ routeId: route().route_id });
  assert.throws(
    () => call("accept_pickup_request", { p_request_id: id }),
    /Start a trip before accepting pickups\./,
  );
});

test("accept rejects other route, other vehicle type, far, and no seats", () => {
  startAt();
  const other = addRequest({ routeId: otherRoute().route_id });
  assert.throws(
    () => call("accept_pickup_request", { p_request_id: other }),
    /This pickup is on a different route\./,
  );
  const trike = addRequest({ routeId: null, type: "Tricycle" });
  assert.throws(
    () => call("accept_pickup_request", { p_request_id: trike }),
    /This request is for a different vehicle type\./,
  );
  const far = addRequest({ routeId: null, at: [point()[0] + 0.01, point()[1]] });
  assert.throws(
    () => call("accept_pickup_request", { p_request_id: far }),
    /This request is too far away\./,
  );
  const big = addRequest({ routeId: route().route_id, passengers: 25 });
  assert.throws(
    () => call("accept_pickup_request", { p_request_id: big }),
    /Not enough seats for this request\./,
  );
});

test("accept then board then end_my_trip completes with dropped_at", () => {
  startAt();
  const id = addRequest({ routeId: route().route_id, passengers: 2 });
  assert.equal(call("accept_pickup_request", { p_request_id: id }), 2);
  assert.equal(requestRow(id).request_status, "accepted");
  assert.equal(requestRow(id).driver_id, driverId("mario"));
  assert.equal(pickupRow(id).vehicle_id, vehicleId("mario"));
  assert.equal(vehicle().current_capacity, 2);
  assert.equal(call("board_pickup", { p_request_id: id }), 2);
  assert.equal(requestRow(id).request_status, "riding");
  assert.ok(pickupRow(id).boarded_at);
  const riders = call("get_my_vehicle_riders");
  assert.equal(riders.length, 1);
  assert.equal(riders[0].request_id, id);
  assert.equal(riders[0].passengers, 2);
  assert.equal(riders[0].dropoff_name, "Centro");
  const trip = db.tables.trip.find(
    (t) => t.vehicle_id === vehicleId("mario") && t.trip_status === "active",
  )!;
  assert.ok(
    db.tables.trip_history.some(
      (h) => h.trip_id === trip.trip_id && h.commuter_id === commuterId("juan"),
    ),
  );
  call("end_my_trip", { p_distance_done_km: 7.5 });
  assert.equal(requestRow(id).request_status, "completed");
  assert.ok(pickupRow(id).dropped_at);
  assert.equal(vehicle().vehicle_status, "idle");
  assert.equal(vehicle().current_capacity, 0);
  assert.ok(!db.tables.location_records.some((l) => l.vehicle_id === vehicleId("mario")));
  assert.equal(trip.trip_status, "completed");
  assert.equal(trip.distance_done_km, 7.5);
  const types = db.tables.notification.map((n) => n.notification_type);
  assert.ok(types.includes("pickup_completed"));
});

test("board requires being near the pickup point", () => {
  startAt();
  const id = addRequest({ routeId: route().route_id });
  call("accept_pickup_request", { p_request_id: id });
  setVehiclePosition(vehicleId("mario"), point()[0] + 0.01, point()[1]);
  assert.throws(
    () => call("board_pickup", { p_request_id: id }),
    /You haven't reached the pickup point yet\./,
  );
});

test("end_my_trip returns accepted pickups to pending", () => {
  startAt();
  const id = addRequest({ routeId: route().route_id });
  call("accept_pickup_request", { p_request_id: id });
  call("end_my_trip", { p_distance_done_km: 1 });
  assert.equal(requestRow(id).request_status, "pending");
  assert.equal(requestRow(id).driver_id, null);
  assert.equal(pickupRow(id).vehicle_id, null);
});

test("companion trip_history is inserted when the shared pickup boards", () => {
  startAt();
  const id = addRequest({ routeId: route().route_id });
  db.tables.pickup_companion.push({
    request_id: id,
    commuter_id: commuterId("ana"),
    companion_status: "accepted",
  });
  call("accept_pickup_request", { p_request_id: id });
  call("board_pickup", { p_request_id: id });
  const trip = db.tables.trip.find(
    (t) => t.vehicle_id === vehicleId("mario") && t.trip_status === "active",
  )!;
  const rows = db.tables.trip_history.filter((h) => h.trip_id === trip.trip_id);
  assert.deepEqual(
    rows.map((h) => h.commuter_id).sort(),
    [commuterId("ana"), commuterId("juan")].sort(),
  );
  assert.ok(rows.every((h) => h.driver_id === driverId("mario")));
});

test("trip state, location sharing, trail and trips", () => {
  assert.throws(
    () =>
      call("share_my_vehicle_location", {
        p_latitude: 13.6,
        p_longitude: 123.1,
        p_speed_kmh: 0,
        p_heading: 0,
      }),
    /Start a trip before sharing your location\./,
  );
  const tripId = call("start_my_trip", { p_distance_total_km: 8 });
  assert.equal(vehicle().vehicle_status, "on-trip");
  call("share_my_vehicle_location", {
    p_latitude: 13.6,
    p_longitude: 123.1,
    p_speed_kmh: 12,
    p_heading: 45,
  });
  const loc = db.tables.location_records.find((l) => l.vehicle_id === vehicleId("mario"))!;
  assert.equal(loc.records_latitude, 13.6);
  assert.throws(
    () =>
      call("share_my_vehicle_location", {
        p_latitude: 95,
        p_longitude: 0,
        p_speed_kmh: 0,
        p_heading: 0,
      }),
    /Invalid coordinates\./,
  );
  assert.throws(
    () =>
      call("set_my_vehicle_trip_state", {
        p_status: "on-trip",
        p_current_capacity: 99,
        p_is_full: false,
      }),
    /Passenger count must be between 0 and 24\./,
  );
  call("set_my_vehicle_trip_state", {
    p_status: "loading",
    p_current_capacity: 24,
    p_is_full: false,
  });
  assert.equal(vehicle().is_full, true);
  const now = new Date().toISOString();
  assert.equal(
    call("record_vehicle_trail", {
      p_points: [
        { latitude: 13.6, longitude: 123.1, speed_kmh: 5, heading: 0, recorded_at: now },
        { latitude: 99, longitude: 123.1, speed_kmh: 5, heading: 0, recorded_at: now },
      ],
    }),
    1,
  );
  const trips = call("get_my_trips");
  assert.equal(trips.length, 5);
  assert.equal(trips[0].trip_id, tripId);
  assert.equal(trips[0].trip_status, "active");
  assert.equal(trips[0].plate_number, "DEMO 101");
  assert.equal(trips[0].pickups, 0);
  assert.equal(trips[0].route_name, route().route_name);
  call("set_my_vehicle_trip_state", {
    p_status: "idle",
    p_current_capacity: 0,
    p_is_full: false,
  });
  assert.equal(call("get_my_trips")[0].trip_status, "completed");
  assert.ok(!db.tables.location_records.some((l) => l.vehicle_id === vehicleId("mario")));
});

test("tricycle driver can start a trip and users without a vehicle fail", () => {
  asPedro();
  assert.ok(call("start_my_trip", { p_distance_total_km: 3 }));
  signInAs(userId("juan"), "juan@demo.tsuperhero");
  assert.throws(
    () => call("end_my_trip", { p_distance_done_km: 0 }),
    /You are not assigned to a vehicle\./,
  );
  assert.equal(call("get_my_vehicle_assignment"), null);
});
