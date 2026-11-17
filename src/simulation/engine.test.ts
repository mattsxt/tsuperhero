import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { signInAs, signOutAll } from "@/simulation/auth";
import { db, type Row } from "@/simulation/db";
import * as engine from "@/simulation/engine";
import { currentSimulatedPoint, setDeviceLocationSource, simulateWalkTo, watchSimulatedLocation } from "@/simulation/gps";
import { generateNotification } from "@/simulation/notifications-sim";
import { postRentalRequestNow } from "@/simulation/rentals-sim";
import { advance, type Mover } from "@/simulation/movement";
import { handlers } from "@/simulation/rpc";
import { acceptPickupEffect } from "@/simulation/rpc/operator";
import { commuterId, driverId, homePoints, userId, vehicleId } from "@/simulation/seed/people";
import { getDistanceMeters } from "@/utils/geo";

const call = (name: string, args: unknown = {}) => handlers[name](args) as any;

const area = (name: string) =>
  db.tables.waiting_area.find((w) => w.area_name === name)!;
const marioRoute = () =>
  db.tables.route.find((r) => r.route_code === "DEL-CON-MAG-CEN")!;
const requestOf = (id: unknown) =>
  db.tables.request.find((r) => r.request_id === id)!;
const pickupOf = (id: unknown) =>
  db.tables.pickup.find((p) => p.request_id === id)!;
const locationOf = (id: unknown) =>
  db.tables.location_records.find((l) => l.vehicle_id === id);

const asJuan = () => signInAs(userId("juan"), "juan@demo.tsuperhero");
const asMario = () => signInAs(userId("mario"), "mario@demo.tsuperhero");

const tickUntil = (done: () => boolean, max = 600) => {
  for (let i = 0; i < max; i++) {
    if (done()) return true;
    mock.timers.tick(1000);
  }
  return false;
};

const pointOf = (row: Row) => ({
  lat: Number(row.area_latitude),
  lng: Number(row.area_longitude),
});

const lastVehiclePoint = (vehicle: string) => {
  let last: { lat: number; lng: number } | null = null;
  const stop = db.subscribe((event) => {
    if (event.table === "location_records" && event.row.vehicle_id === vehicle)
      last = { lat: Number(event.row.records_latitude), lng: Number(event.row.records_longitude) };
  });
  return { get: () => last!, stop };
};

const requestPickup = (
  from: Row,
  to: Row,
  routeId: unknown = marioRoute().route_id,
  vehicleType = "Jeepney",
) => {
  const id = call("save_pickup_draft", {
    p_request_id: null,
    p_latitude: from.area_latitude,
    p_longitude: from.area_longitude,
    p_destination: String(from.area_name),
    p_passengers: 1,
    p_vehicle_type: vehicleType,
  });
  call("set_pickup_route", {
    p_request_id: id,
    p_route_id: routeId,
    p_pickup_lat: from.area_latitude,
    p_pickup_lng: from.area_longitude,
    p_dropoff_lat: to.area_latitude,
    p_dropoff_lng: to.area_longitude,
    p_dropoff_name: String(to.area_name),
    p_waiting_area_id: from.area_id,
  });
  call("publish_pickup_draft", { p_request_id: id });
  call("mark_pickup_arrived", {
    p_request_id: id,
    p_latitude: from.area_latitude,
    p_longitude: from.area_longitude,
  });
  return id;
};

beforeEach(() => {
  engine.reset();
  db.reset();
  asJuan();
  mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
});

afterEach(() => {
  engine.reset();
  mock.timers.reset();
  mock.restoreAll();
});

test("advance covers speed * seconds / 3.6 metres and arrives at the end", () => {
  let arrived = 0;
  const mover: Mover = {
    id: "m",
    path: [
      [13.62, 123.18],
      [13.62, 123.19],
    ],
    along: 0,
    speedKmh: 18,
    onArrive: () => {
      arrived += 1;
    },
  };
  const moved = advance(mover, 10);
  assert.ok(Math.abs(moved.along - 50) < 1e-9);
  assert.equal(arrived, 0);
  const done = advance(moved, 1000);
  assert.ok(done.along > 1000);
  assert.equal(arrived, 1);
  advance(done, 10);
  assert.equal(arrived, 1);
});

test("commuter counterpart accepts within 5 s, boards at A and completes at B", () => {
  const id = requestPickup(area("SAFE Gas"), area("E-Mall"));
  const mario = lastVehiclePoint(vehicleId("mario"));
  assert.ok(requestOf(id).arrived_at);
  engine.setSpeed(1);
  engine.start();
  mock.timers.tick(4000);
  assert.equal(requestOf(id).request_status, "pending");
  mock.timers.tick(1000);
  assert.equal(requestOf(id).request_status, "accepted");
  assert.equal(pickupOf(id).vehicle_id, vehicleId("mario"));
  assert.ok(locationOf(vehicleId("mario")));
  engine.setSpeed(10);
  assert.ok(tickUntil(() => requestOf(id).request_status === "riding"));
  assert.ok(pickupOf(id).boarded_at);
  assert.ok(getDistanceMeters(mario.get(), pointOf(area("SAFE Gas"))) < 5);
  const here = currentSimulatedPoint();
  const loc = locationOf(vehicleId("mario"))!;
  assert.ok(
    getDistanceMeters(here, {
      lat: Number(loc.records_latitude),
      lng: Number(loc.records_longitude),
    }) < 1,
  );
  assert.ok(tickUntil(() => requestOf(id).request_status === "completed"));
  assert.ok(pickupOf(id).dropped_at);
  assert.ok(getDistanceMeters(mario.get(), pointOf(area("E-Mall"))) < 5);
  assert.ok(getDistanceMeters(currentSimulatedPoint(), pointOf(area("E-Mall"))) < 5);
  mario.stop();
  const types = db.tables.notification
    .filter((n) => n.user_id === userId("juan"))
    .map((n) => n.notification_type);
  assert.deepEqual(
    ["pickup_accepted", "pickup_boarded", "pickup_completed"].filter((t) =>
      types.includes(t),
    ),
    ["pickup_accepted", "pickup_boarded", "pickup_completed"],
  );
});

test("with a road router, a tricycle drives the routed road path to the pickup and to the drop-off", async () => {
  const from = area("SAFE Gas");
  const to = area("E-Mall");
  const pickup: [number, number] = [Number(from.area_latitude), Number(from.area_longitude)];
  const dropoff: [number, number] = [Number(to.area_latitude), Number(to.area_longitude)];
  const calls: [number, number][][] = [];
  engine.setRoadRouter(async (a, b) => {
    calls.push([a, b]);
    return [a, [a[0], b[1]], b];
  });
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
  try {
    const id = requestPickup(from, to, null, "Tricycle");
    const trike = lastVehiclePoint(vehicleId("pedro"));
    engine.setSpeed(1);
    engine.start();
    assert.ok(tickUntil(() => requestOf(id).request_status === "accepted", 20));
    assert.equal(pickupOf(id).vehicle_id, vehicleId("pedro"));
    await flush();
    assert.equal(calls.length, 1, "approach leg asks the router");
    assert.deepEqual(calls[0][1], pickup);
    const corner = { lat: calls[0][0][0], lng: pickup[1] };
    let passedCorner = false;
    engine.setSpeed(10);
    assert.ok(
      tickUntil(() => {
        if (getDistanceMeters(trike.get(), corner) < 30) passedCorner = true;
        return requestOf(id).request_status === "riding";
      }),
    );
    assert.ok(passedCorner, "tricycle followed the routed road, not a straight line");
    await flush();
    assert.equal(calls.length, 2, "drop-off leg asks the router");
    assert.deepEqual(calls[1], [pickup, dropoff], "same query the ride screen draws");
    assert.ok(tickUntil(() => requestOf(id).request_status === "completed"));
    assert.ok(getDistanceMeters(trike.get(), pointOf(to)) < 5);
    trike.stop();
  } finally {
    engine.setRoadRouter(null);
  }
});

test("a failed road route falls back to the built-in path", async () => {
  engine.setRoadRouter(async () => null);
  try {
    const id = requestPickup(area("SAFE Gas"), area("E-Mall"), null, "Tricycle");
    engine.setSpeed(1);
    engine.start();
    assert.ok(tickUntil(() => requestOf(id).request_status === "accepted", 20));
    const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
    await flush();
    engine.setSpeed(10);
    assert.ok(tickUntil(() => requestOf(id).request_status === "riding"));
    await flush();
    assert.ok(tickUntil(() => requestOf(id).request_status === "completed"));
    assert.ok(getDistanceMeters(currentSimulatedPoint(), pointOf(area("E-Mall"))) < 5);
  } finally {
    engine.setRoadRouter(null);
  }
});

test("switching to the driver mid-job keeps the counterpart job running to completion", () => {
  const id = requestPickup(area("SAFE Gas"), area("E-Mall"));
  const mario = lastVehiclePoint(vehicleId("mario"));
  const marioTrip = () =>
    db.tables.trip.find(
      (t) => t.vehicle_id === vehicleId("mario") && t.trip_status === "active",
    );
  engine.setSpeed(1);
  engine.start();
  mock.timers.tick(5000);
  assert.equal(requestOf(id).request_status, "accepted");
  assert.equal(pickupOf(id).vehicle_id, vehicleId("mario"));
  assert.ok(marioTrip());
  asMario();
  engine.setSpeed(10);
  assert.ok(tickUntil(() => requestOf(id).request_status === "riding"));
  assert.ok(getDistanceMeters(mario.get(), pointOf(area("SAFE Gas"))) < 5);
  assert.ok(tickUntil(() => requestOf(id).request_status === "completed"));
  assert.ok(pickupOf(id).dropped_at);
  assert.ok(getDistanceMeters(mario.get(), pointOf(area("E-Mall"))) < 5);
  assert.equal(marioTrip(), undefined);
  mario.stop();
});

test("start() twice creates one interval", () => {
  const spy = mock.method(globalThis, "setInterval");
  engine.start();
  engine.start();
  assert.equal(spy.mock.callCount(), 1);
  engine.stop();
  engine.start();
  assert.equal(spy.mock.callCount(), 2);
});

test("arriveNow() with nothing moving returns false", () => {
  assert.equal(engine.arriveNow(), false);
  signOutAll();
  assert.equal(engine.arriveNow(), false);
});

test("simulated walk reaches the target and arriveNow finishes it", () => {
  const home = homePoints.juan;
  const start = currentSimulatedPoint();
  assert.ok(getDistanceMeters(start, { lat: home[0], lng: home[1] }) < 1);
  const target = area("SAFE Gas");
  const point = { lat: Number(target.area_latitude), lng: Number(target.area_longitude) };
  simulateWalkTo(point);
  engine.start();
  mock.timers.tick(1000);
  const after = currentSimulatedPoint();
  const walked = getDistanceMeters(start, after);
  assert.ok(Math.abs(walked - 5 / 3.6) < 0.5);
  assert.equal(engine.arriveNow(), true);
  assert.ok(getDistanceMeters(currentSimulatedPoint(), point) < 1);
  assert.equal(engine.arriveNow(), false);
});

test("a simulated walk with a walking route follows the route, not a straight line", () => {
  engine.start();
  const here = currentSimulatedPoint();
  const corner: [number, number] = [here.lat + 0.0015, here.lng];
  const target = { lat: here.lat + 0.0015, lng: here.lng + 0.0015 };
  simulateWalkTo(target, [[here.lat, here.lng], corner, [target.lat, target.lng]]);
  let closest = Infinity;
  for (let i = 0; i < 600; i++) {
    mock.timers.tick(1000);
    const now = currentSimulatedPoint();
    closest = Math.min(closest, getDistanceMeters(now, { lat: corner[0], lng: corner[1] }));
    if (getDistanceMeters(now, target) < 1) break;
  }
  assert.ok(closest < 5, String(closest));
  assert.ok(getDistanceMeters(currentSimulatedPoint(), target) < 1);
});

test("watchSimulatedLocation emits LocationObject-shaped fixes every second", () => {
  const fixes: { coords: { latitude: number; longitude: number }; timestamp: number }[] = [];
  const sub = watchSimulatedLocation((fix) => fixes.push(fix));
  mock.timers.tick(0);
  mock.timers.tick(2000);
  sub.remove();
  mock.timers.tick(2000);
  assert.equal(fixes.length, 3);
  assert.equal(typeof fixes[0].coords.latitude, "number");
  assert.equal(typeof fixes[0].timestamp, "number");
});

test("background vehicles stay fresh and move along their routes", () => {
  const bg = vehicleId("bg1");
  const before = { ...locationOf(bg)! };
  locationOf(bg)!.recorded_at = new Date(Date.now() - 20 * 60_000).toISOString();
  engine.start();
  mock.timers.tick(3000);
  const after = locationOf(bg)!;
  assert.ok(Date.now() - new Date(String(after.recorded_at)).getTime() < 5_000);
  assert.ok(
    getDistanceMeters(
      { lat: Number(before.records_latitude), lng: Number(before.records_longitude) },
      { lat: Number(after.records_latitude), lng: Number(after.records_longitude) },
    ) > 10,
  );
  assert.ok(call("get_live_vehicles_with_full").some((v: Row) => v.vehicle_id === bg));
});

test("the demo starts at 1x and background traffic follows the demo speed", () => {
  assert.equal(engine.getSpeed(), 1);
  const bg = vehicleId("j7");
  const was = { ...locationOf(bg)! };
  engine.start();
  mock.timers.tick(10_000);
  const now = locationOf(bg)!;
  const moved = getDistanceMeters(
    { lat: Number(was.records_latitude), lng: Number(was.records_longitude) },
    { lat: Number(now.records_latitude), lng: Number(now.records_longitude) },
  );
  assert.ok(moved > 30 && moved < 70, String(moved));
  assert.equal(Number(now.speed_kmh), 18);
  engine.setSpeed(10);
  const before = { ...locationOf(bg)! };
  mock.timers.tick(2_000);
  const after = locationOf(bg)!;
  const fast = getDistanceMeters(
    { lat: Number(before.records_latitude), lng: Number(before.records_longitude) },
    { lat: Number(after.records_latitude), lng: Number(after.records_longitude) },
  );
  assert.ok(fast > 80 && fast < 120, String(fast));
  assert.equal(Number(after.speed_kmh), 180);
});

test("tricycles drive their town circuits and show as live vehicles", () => {
  const tricycles = db.tables.vehicle
    .filter((v) => v.vehicle_type === "Tricycle" && v.vehicle_status === "on-trip")
    .map((v) => String(v.vehicle_id));
  assert.ok(tricycles.length >= 5);
  const before = new Map(tricycles.map((id) => [id, { ...locationOf(id)! }]));
  engine.start();
  mock.timers.tick(5000);
  for (const id of tricycles) {
    const was = before.get(id)!;
    const now = locationOf(id)!;
    assert.ok(
      getDistanceMeters(
        { lat: Number(was.records_latitude), lng: Number(was.records_longitude) },
        { lat: Number(now.records_latitude), lng: Number(now.records_longitude) },
      ) > 10,
      String(id),
    );
  }
  const live = call("get_live_vehicles_with_last_seen") as Row[];
  for (const id of tricycles) assert.ok(live.some((v) => v.vehicle_id === id), String(id));
  assert.ok(live.filter((v) => v.vehicle_type === "Jeepney").length >= 10);
});

test("mock pickup requests for the driver rotate through many commuters", () => {
  withClock();
  asMario();
  call("start_my_trip", { p_distance_total_km: 8 });
  engine.setSpeed(10);
  engine.start();
  mock.timers.tick(1000);
  const riders = new Set<unknown>();
  for (let i = 0; i < 6; i++) {
    for (const request of db.tables.request)
      if (request.request_type === "Pickup" && request.request_status === "pending") {
        riders.add(request.commuter_id);
        request.request_status = "cancelled";
      }
    engine.sendPickupRequest();
    mock.timers.setTime(Date.now() + 4_000);
  }
  assert.ok(riders.size >= 5, String(riders.size));
});

test("driver trip spawns mock pickups ahead that the driver can accept, board and drop off", () => {
  asMario();
  call("start_my_trip", { p_distance_total_km: 8 });
  engine.setSpeed(10);
  engine.start();
  mock.timers.tick(1000);
  const spawned = () =>
    db.tables.request.filter(
      (r) =>
        r.request_type === "Pickup" &&
        ["pending", "accepted"].includes(String(r.request_status)),
    );
  assert.ok(spawned().length >= 1);
  const first = spawned()[0];
  assert.ok(first.arrived_at);
  assert.equal(first.is_draft, false);
  assert.equal(pickupOf(first.request_id).route_id, marioRoute().route_id);
  assert.equal(engine.sendPickupRequest(), true);
  assert.equal(engine.sendPickupRequest(), true);
  assert.equal(engine.sendPickupRequest(), true);
  assert.equal(engine.sendPickupRequest(), false, "a fourth send within 10 seconds is rate limited");
  let nearby: Row[] = [];
  assert.ok(
    tickUntil(() => {
      nearby = call("get_my_nearby_pickups");
      return nearby.length > 0;
    }),
  );
  const target = nearby[0].request_id;
  call("accept_pickup_request", { p_request_id: target });
  assert.ok(
    tickUntil(() => {
      try {
        call("board_pickup", { p_request_id: target });
      } catch {
        return false;
      }
      return true;
    }),
  );
  assert.equal(requestOf(target).request_status, "riding");
  assert.ok(tickUntil(() => requestOf(target).request_status === "completed", 2000));
  assert.ok(pickupOf(target).dropped_at);
});

test("an invited companion waits for the presenter, then walks to the pickup point", () => {
  const from = area("SAFE Gas");
  const to = area("E-Mall");
  const id = call("save_pickup_draft", {
    p_request_id: null,
    p_latitude: from.area_latitude,
    p_longitude: from.area_longitude,
    p_destination: String(from.area_name),
    p_passengers: 2,
    p_vehicle_type: "Jeepney",
  });
  call("add_pickup_companions", { p_request_id: id, p_user_ids: [userId("ana")] });
  const companion = () => db.tables.pickup_companion.find((c) => c.request_id === id)!;
  engine.setSpeed(1);
  engine.start();
  mock.timers.tick(5000);
  assert.equal(companion().companion_status, "pending");
  assert.equal(engine.answerCompanionInvite(engine.pendingCompanionInvites()[0].key, true), true);
  assert.equal(companion().companion_status, "accepted");
  call("set_pickup_route", {
    p_request_id: id,
    p_route_id: marioRoute().route_id,
    p_pickup_lat: from.area_latitude,
    p_pickup_lng: from.area_longitude,
    p_dropoff_lat: to.area_latitude,
    p_dropoff_lng: to.area_longitude,
    p_dropoff_name: String(to.area_name),
    p_waiting_area_id: from.area_id,
  });
  mock.timers.tick(1000);
  assert.equal(companion().arrived_at, null);
  assert.equal(engine.arriveNow(), true);
  assert.ok(companion().arrived_at);
});

test("arriveNow() finishes each counterpart leg at its real end point", () => {
  const id = requestPickup(area("SAFE Gas"), area("E-Mall"));
  const mario = lastVehiclePoint(vehicleId("mario"));
  engine.setSpeed(1);
  engine.start();
  mock.timers.tick(5000);
  assert.equal(requestOf(id).request_status, "accepted");
  assert.equal(engine.arriveNow(), true);
  assert.equal(requestOf(id).request_status, "riding");
  assert.ok(getDistanceMeters(mario.get(), pointOf(area("SAFE Gas"))) < 5);
  assert.ok(getDistanceMeters(currentSimulatedPoint(), pointOf(area("SAFE Gas"))) < 5);
  assert.equal(engine.arriveNow(), true);
  assert.equal(requestOf(id).request_status, "completed");
  assert.ok(getDistanceMeters(mario.get(), pointOf(area("E-Mall"))) < 5);
  assert.ok(getDistanceMeters(currentSimulatedPoint(), pointOf(area("E-Mall"))) < 5);
  mario.stop();
});

test("a pickup on another route is served by a vehicle on that route, never by Mario", () => {
  const pan = db.tables.route.find((r) => r.route_code === "DEL-CON-PAN-CEN")!;
  const id = requestPickup(area("Gaisano"), area("Isarog"), pan.route_id);
  engine.setSpeed(1);
  engine.start();
  mock.timers.tick(5000);
  assert.equal(requestOf(id).request_status, "accepted");
  const served = pickupOf(id).vehicle_id;
  assert.notEqual(served, vehicleId("mario"));
  assert.equal(
    db.tables.vehicle.find((v) => v.vehicle_id === served)!.route_id,
    pan.route_id,
  );
  assert.ok(
    !db.tables.trip.some(
      (t) => t.vehicle_id === vehicleId("mario") && t.trip_status === "active",
    ),
  );
  engine.setSpeed(10);
  assert.ok(tickUntil(() => requestOf(id).request_status === "completed"));
});

test("spawned pickups the driver passes expire so spawning resumes and the trip keeps going", () => {
  withClock();
  asMario();
  call("start_my_trip", { p_distance_total_km: 8 });
  engine.setSpeed(10);
  engine.start();
  mock.timers.tick(1000);
  engine.sendPickupRequest();
  engine.sendPickupRequest();
  engine.sendPickupRequest();
  assert.equal(engine.sendPickupRequest(), false, "rate limited after 3 sends");
  const firstBatch = db.tables.request
    .filter((r) => r.request_type === "Pickup" && r.request_status === "pending")
    .map((r) => r.request_id);
  assert.equal(firstBatch.length, 4);
  assert.ok(
    tickUntil(() => firstBatch.every((id) => !db.tables.request.some((r) => r.request_id === id))),
  );
  assert.ok(
    tickUntil(() =>
      db.tables.request.some(
        (r) =>
          r.request_type === "Pickup" &&
          r.request_status === "pending" &&
          !firstBatch.includes(r.request_id),
      ),
    ),
  );
  assert.ok(
    tickUntil(() => {
      const open = db.tables.request.filter(
        (r) => r.request_type === "Pickup" && r.request_status === "pending",
      ).length;
      return open < 3 ? engine.sendPickupRequest() : false;
    }),
  );
  const before = { ...locationOf(vehicleId("mario"))! };
  const at = { lat: Number(before.records_latitude), lng: Number(before.records_longitude) };
  mock.timers.tick(30_000);
  const after = locationOf(vehicleId("mario"))!;
  assert.ok(
    getDistanceMeters(at, {
      lat: Number(after.records_latitude),
      lng: Number(after.records_longitude),
    }) > 100,
  );
  mock.timers.tick(400_000);
  const late = { ...locationOf(vehicleId("mario"))! };
  mock.timers.tick(10_000);
  const later = locationOf(vehicleId("mario"))!;
  assert.ok(Number(later.speed_kmh) > 0);
  assert.ok(
    getDistanceMeters(
      { lat: Number(late.records_latitude), lng: Number(late.records_longitude) },
      { lat: Number(later.records_latitude), lng: Number(later.records_longitude) },
    ) > 100,
  );
  assert.ok(
    tickUntil(
      () =>
        db.tables.request.filter(
          (r) => r.request_type === "Pickup" && r.request_status === "pending",
        ).length >= 1,
      120,
    ),
  );
});

test("the dwell fallback at one stop never skips accepted pickups further ahead", () => {
  asMario();
  call("start_my_trip", { p_distance_total_km: 8 });
  engine.setSpeed(10);
  engine.start();
  mock.timers.tick(1000);
  engine.sendPickupRequest();
  const here = () => {
    const l = locationOf(vehicleId("mario"))!;
    return { lat: Number(l.records_latitude), lng: Number(l.records_longitude) };
  };
  const [first, second] = db.tables.request
    .filter((r) => r.request_type === "Pickup" && r.request_status === "pending")
    .map((r) => r.request_id)
    .sort(
      (x, y) =>
        getDistanceMeters(here(), {
          lat: Number(pickupOf(x).pickup_lat),
          lng: Number(pickupOf(x).pickup_lng),
        }) -
        getDistanceMeters(here(), {
          lat: Number(pickupOf(y).pickup_lat),
          lng: Number(pickupOf(y).pickup_lng),
        }),
    );
  acceptPickupEffect(String(first), vehicleId("mario"), driverId("mario"));
  acceptPickupEffect(String(second), vehicleId("mario"), driverId("mario"));
  assert.ok(tickUntil(() => requestOf(first).request_status === "riding"));
  assert.equal(requestOf(second).request_status, "accepted");
  assert.ok(tickUntil(() => requestOf(second)?.request_status === "riding"));
  const point = { lat: Number(pickupOf(second).pickup_lat), lng: Number(pickupOf(second).pickup_lng) };
  assert.ok(getDistanceMeters(here(), point) <= 100);
});

test("send pickup request works on every jeepney route", () => {
  const failures: string[] = [];
  for (const route of engine.demoJeepneyRoutes()) {
    engine.reset();
    db.reset();
    asMario();
    assert.equal(engine.chooseDemoRoute(route.routeId), true);
    call("start_my_trip", { p_distance_total_km: 5 });
    engine.start();
    for (let i = 0; i < 5; i++) mock.timers.tick(1000);
    const before = new Set(db.tables.request.map((r) => r.request_id));
    if (!tickUntil(() => engine.sendPickupRequest(), 60)) {
      failures.push(`${route.code}: send returned false (${engine.sendPickupRequestReason()})`);
      continue;
    }
    const created = db.tables.request.filter((r) => !before.has(r.request_id)).map((r) => r.request_id);
    const seen = tickUntil(
      () => (call("get_my_nearby_pickups") as Row[]).some((p) => created.includes(p.request_id)),
      10,
    );
    if (!seen) failures.push(`${route.code}: sent request not visible to the driver within 10 s`);
  }
  assert.deepEqual(failures, []);
});

test("send pickup request explains why it can't send", () => {
  asMario();
  assert.equal(engine.sendPickupRequest(), false);
  assert.equal(engine.sendPickupRequestReason(), "Start a trip first");
  call("start_my_trip", { p_distance_total_km: 5 });
  engine.start();
  mock.timers.tick(1000);
  assert.equal(engine.sendPickupRequestReason(), null);
});

const withClock = () => {
  mock.timers.reset();
  mock.timers.enable({ apis: ["setInterval", "setTimeout", "Date"], now: Date.now() });
};

const openDemoRequests = () =>
  db.tables.request.filter(
    (r) => r.request_type === "Pickup" && r.request_status === "pending" && r.commuter_id !== commuterId("juan"),
  );

const startMarioTrip = () => {
  asMario();
  call("start_my_trip", { p_distance_total_km: 5 });
  engine.start();
  mock.timers.tick(1000);
};

test("sending pickup requests is limited to 3 every 10 seconds", () => {
  withClock();
  startMarioTrip();
  for (let i = 0; i < 3; i++) assert.equal(engine.sendPickupRequest(), true, `send ${i + 1}`);
  assert.equal(engine.sendPickupRequest(), false);
  assert.match(engine.sendPickupRequestReason()!, /^Max 3 per 10s · wait \d+s$/);
  mock.timers.tick(10_000);
  assert.equal(engine.sendPickupRequest(), true, "the window reopens after 10 seconds");
});

test("at most 5 pickup requests can be open at once", () => {
  withClock();
  startMarioTrip();
  let sent = 0;
  for (let round = 0; round < 4 && sent < 10; round++) {
    while (engine.sendPickupRequest()) sent++;
    mock.timers.tick(10_000);
  }
  assert.equal(openDemoRequests().length, 5);
  assert.equal(
    engine.sendPickupRequestReason(),
    "5 requests open · accept or skip one",
  );
});

test("skipping or accepting a request frees a slot to send another", () => {
  withClock();
  startMarioTrip();
  for (let round = 0; round < 4; round++) {
    while (engine.sendPickupRequest());
    mock.timers.tick(10_000);
  }
  assert.equal(engine.sendPickupRequest(), false, "5 are open");

  const [skip] = openDemoRequests();
  assert.equal(engine.dismissPickupRequest(String(skip.request_id)), true);
  assert.ok(!db.tables.request.some((r) => r.request_id === skip.request_id), "a skipped request is closed");
  assert.equal(engine.sendPickupRequest(), true, "skipping frees a slot");
  mock.timers.tick(10_000);

  const accept = openDemoRequests().find((r) => {
    const nearby = call("get_my_nearby_pickups") as Row[];
    return nearby.some((p) => p.request_id === r.request_id);
  });
  assert.ok(accept, "one request is near enough to accept");
  call("accept_pickup_request", { p_request_id: accept!.request_id });
  assert.equal(engine.sendPickupRequest(), true, "accepting frees a slot");
  assert.equal(engine.dismissPickupRequest(String(accept!.request_id)), false, "accepted requests aren't closed by a skip");
});

const near = (a: { lat: number; lng: number }, b: { lat: number; lng: number }, m = 1) =>
  getDistanceMeters(a, b) < m;

test("device fix becomes the commuter position", () => {
  engine.setDeviceFix(userId("juan"), { lat: 13.625, lng: 123.19 });
  assert.ok(near(currentSimulatedPoint(), { lat: 13.625, lng: 123.19 }));
});

test("device fix anywhere, even outside Naga, becomes the commuter position", () => {
  engine.setDeviceFix(userId("juan"), { lat: 14.6, lng: 121.0 });
  assert.ok(near(currentSimulatedPoint(), { lat: 14.6, lng: 121.0 }));
});

test("losing the device fix falls back to the home point", () => {
  const home = { lat: homePoints.juan[0], lng: homePoints.juan[1] };
  engine.setDeviceFix(userId("juan"), { lat: 13.625, lng: 123.19 });
  engine.setDeviceFix(userId("juan"), null);
  assert.ok(near(currentSimulatedPoint(), home));
  engine.setDeviceFix(userId("juan"), { lat: Number.NaN, lng: 123.19 });
  assert.ok(near(currentSimulatedPoint(), home));
});

test("walking overrides the device fix until the phone really moves", () => {
  const device = { lat: 13.625, lng: 123.19 };
  engine.setDeviceFix(userId("juan"), device);
  const target = pointOf(area("E-Mall"));
  simulateWalkTo(target);
  engine.start();
  mock.timers.tick(1000);
  assert.ok(!near(currentSimulatedPoint(), device, 0.5), "walk moved away from the device fix");
  assert.equal(engine.arriveNow(), true);
  assert.ok(near(currentSimulatedPoint(), target));
  engine.setDeviceFix(userId("juan"), { lat: device.lat + 0.00005, lng: device.lng });
  assert.ok(near(currentSimulatedPoint(), target), "GPS jitter keeps the commuter at the pickup point");
  const moved = { lat: device.lat + 0.0005, lng: device.lng };
  engine.setDeviceFix(userId("juan"), moved);
  assert.ok(near(currentSimulatedPoint(), moved), "a real move hands control back to GPS");
});

test("drivers ignore device fixes", () => {
  asMario();
  const before = currentSimulatedPoint();
  engine.setDeviceFix(userId("mario"), { lat: 13.625, lng: 123.19 });
  assert.ok(near(currentSimulatedPoint(), before));
});

test("watchSimulatedLocation forwards source fixes for commuters", () => {
  let push: (p: { lat: number; lng: number }) => void = () => {};
  let unsubscribed = false;
  setDeviceLocationSource((onFix) => {
    push = onFix;
    return () => {
      unsubscribed = true;
    };
  });
  const fixes: { coords: { latitude: number; longitude: number } }[] = [];
  const sub = watchSimulatedLocation((fix) => fixes.push(fix));
  push({ lat: 13.625, lng: 123.19 });
  mock.timers.tick(1000);
  const last = fixes[fixes.length - 1].coords;
  assert.ok(near({ lat: last.latitude, lng: last.longitude }, { lat: 13.625, lng: 123.19 }));
  sub.remove();
  assert.equal(unsubscribed, false, "device GPS keeps running without a map watcher");
  setDeviceLocationSource(null);
  assert.equal(unsubscribed, true);
});

test("device GPS feeds one-shot location reads without any watcher", () => {
  let push: (p: { lat: number; lng: number }) => void = () => {};
  setDeviceLocationSource((onFix) => {
    push = onFix;
    return () => {};
  });
  push({ lat: 14.6, lng: 121.0 });
  assert.ok(near(currentSimulatedPoint(), { lat: 14.6, lng: 121.0 }));
  setDeviceLocationSource(null);
});

test("a device fix received before login applies once a commuter signs in", () => {
  let push: (p: { lat: number; lng: number }) => void = () => {};
  setDeviceLocationSource((onFix) => {
    push = onFix;
    return () => {};
  });
  asMario();
  push({ lat: 13.625, lng: 123.19 });
  asJuan();
  assert.ok(near(currentSimulatedPoint(), { lat: 13.625, lng: 123.19 }));
  setDeviceLocationSource(null);
});

test("reset demo clears all new simulated state", () => {
  const counts = {
    charter_rental: db.tables.charter_rental.length,
    pickup_companion: db.tables.pickup_companion.length,
    request: db.tables.request.length,
  };
  const mario = db.tables.vehicle.find((v) => v.vehicle_id === vehicleId("mario"))!;
  const seededRoute = mario.route_id;
  const bus = db.tables.vehicle.find((v) => v.plate_number === "DEMO 103")!;
  const seededCapacity = bus.current_capacity;

  asMario();
  assert.ok(postRentalRequestNow());
  asJuan();
  assert.deepEqual(generateNotification(), { ok: true, type: "pickup_shared" });
  engine.setDeviceFix(userId("juan"), { lat: 13.625, lng: 123.19 });

  asMario();
  const route = db.tables.route.find((r) => r.route_code === "SFE-FRA-CEN")!;
  assert.equal(engine.chooseDemoRoute(String(route.route_id)), true);
  engine.start();
  mock.timers.tick(60_000);
  assert.notEqual(bus.current_capacity, seededCapacity);

  db.reset();
  engine.reset();
  asJuan();
  assert.equal(db.tables.charter_rental.length, counts.charter_rental);
  assert.equal(db.tables.pickup_companion.length, counts.pickup_companion);
  assert.equal(db.tables.request.length, counts.request);
  assert.equal(db.tables.vehicle.find((v) => v.vehicle_id === vehicleId("mario"))!.route_id, seededRoute);
  assert.equal(db.tables.vehicle.find((v) => v.plate_number === "DEMO 103")!.current_capacity, seededCapacity);
  assert.ok(near(currentSimulatedPoint(), { lat: homePoints.juan[0], lng: homePoints.juan[1] }));
  assert.equal(engine.getSpeed(), 1);
});

test("pause freezes the simulation until resume, even if a screen calls start", () => {
  engine.start();
  const target = pointOf(area("SAFE Gas"));
  simulateWalkTo(target);
  mock.timers.tick(1000);
  engine.pause();
  assert.equal(engine.isPaused(), true);
  const frozen = currentSimulatedPoint();
  engine.start();
  mock.timers.tick(5000);
  assert.ok(near(currentSimulatedPoint(), frozen, 0.01), "nothing moves while paused");
  engine.resume();
  mock.timers.tick(5000);
  assert.ok(!near(currentSimulatedPoint(), frozen, 1), "the walk continues after resume");
  engine.pause();
  engine.reset();
  assert.equal(engine.isPaused(), false, "reset clears the pause");
});

const asPedro = () => signInAs(userId("pedro"), "pedro@demo.tsuperhero");

test("a tricycle driver's demo trip drives, gets requests, accepts, boards and drops off", () => {
  withClock();
  asPedro();
  call("start_my_trip", { p_distance_total_km: 3 });
  engine.start();
  mock.timers.tick(1000);
  const start = { ...locationOf(vehicleId("pedro"))! };
  mock.timers.tick(10_000);
  const moved = locationOf(vehicleId("pedro"))!;
  assert.ok(
    getDistanceMeters(
      { lat: Number(start.records_latitude), lng: Number(start.records_longitude) },
      { lat: Number(moved.records_latitude), lng: Number(moved.records_longitude) },
    ) > 20,
    "the tricycle drives its circuit",
  );

  assert.equal(engine.sendPickupRequestReason(), null);
  assert.equal(engine.sendPickupRequest(), true);
  const sent = db.tables.request.filter(
    (r) => r.request_type === "Pickup" && r.request_status === "pending",
  );
  assert.ok(sent.length >= 1);
  assert.ok(
    sent.every((r) => pickupOf(r.request_id)?.requested_vehicle_type === "Tricycle"),
    "requests are for a tricycle",
  );

  let nearby: Row[] = [];
  assert.ok(
    tickUntil(() => {
      nearby = call("get_my_nearby_pickups");
      return nearby.length > 0;
    }),
  );
  const target = nearby[0].request_id;
  call("accept_pickup_request", { p_request_id: target });
  assert.ok(
    tickUntil(() => {
      try {
        call("board_pickup", { p_request_id: target });
      } catch {
        return false;
      }
      return true;
    }),
  );
  assert.equal(requestOf(target).request_status, "riding");
  assert.ok(tickUntil(() => requestOf(target).request_status === "completed", 2000));
  assert.equal(engine.arriveNow(), true, "arrive now skips to the next stop");
});

test("a tricycle trip also spawns requests on its own", () => {
  asPedro();
  call("start_my_trip", { p_distance_total_km: 3 });
  engine.start();
  assert.ok(
    tickUntil(
      () =>
        db.tables.request.some(
          (r) =>
            r.request_type === "Pickup" &&
            r.request_status === "pending" &&
            pickupOf(r.request_id)?.requested_vehicle_type === "Tricycle",
        ),
      120,
    ),
  );
});
