import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, mock, test } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { signOutAll } from "@/simulation/auth";
import { createMockClient } from "@/simulation/client";
import { db, type Row } from "@/simulation/db";
import * as engine from "@/simulation/engine";
import { currentSimulatedPoint, simulateWalkTo } from "@/simulation/gps";
import { homePoints, userId } from "@/simulation/seed/people";
import { getDistanceMeters, matchRoutes, type LatLngPair } from "@/utils/geo";

type Result = { data: any; error: { message: string; code: string } | null };

let client: SupabaseClient;

const ok = async (request: PromiseLike<Result>) => {
  const { data, error } = await request;
  assert.equal(error, null, error?.message);
  return data;
};

const rpc = (name: string, args?: Record<string, unknown>) =>
  ok(client.rpc(name, args) as unknown as PromiseLike<Result>);

const tickUntil = (done: () => boolean, max = 900) => {
  for (let i = 0; i < max; i++) {
    if (done()) return true;
    mock.timers.tick(1000);
  }
  return done();
};

const requestOf = (id: unknown) =>
  db.tables.request.find((r) => r.request_id === id)!;

const area = (name: string) =>
  db.tables.waiting_area.find((w) => w.area_name === name)!;

const pointOf = (row: Row) => ({
  lat: Number(row.area_latitude),
  lng: Number(row.area_longitude),
});

const signIn = async (email: string) => {
  const res = await client.auth.signInWithPassword({ email, password: "demo1234" });
  assert.equal(res.error, null);
  return res.data.user!.id;
};

const findCommuter = async (user: string) =>
  (await ok(
    client.from("commuter").select("commuter_id").eq("user_id", user).maybeSingle(),
  )).commuter_id as string;

const findActiveRequest = (commuterId: string) =>
  ok(
    client
      .from("request")
      .select(
        "*, pickup(pickup_id, pickup_destination, number_of_passengers, requested_vehicle_type, route_id, pickup_lat, pickup_lng, dropoff_name, dropoff_lat, dropoff_lng)",
      )
      .eq("commuter_id", commuterId)
      .eq("request_type", "Pickup")
      .eq("is_draft", false)
      .in("request_status", ["pending", "accepted", "riding"])
      .order("request_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );

const parsePath = (path: unknown): LatLngPair[] =>
  Array.isArray(path) ? (path as LatLngPair[]) : [];

const requestPickupLikeTheApp = async (
  pin: { lat: number; lng: number; name: string },
  dropoffArea: Row,
  passengers = 1,
  routeCode = "DEL-CON-MAG-CEN",
) => {
  const routes: Row[] = await ok(client.from("route").select("*").order("route_name"));
  const route = routes.find((r) => r.route_code === routeCode)!;
  const dropoff = { ...pointOf(dropoffArea), name: String(dropoffArea.area_name) };
  const [match] = matchRoutes(pin, dropoff, [
    {
      routeId: String(route.route_id),
      paths: [parsePath(route.path), parsePath(route.alternative_paths)].filter(
        (p) => p.length > 1,
      ),
    },
  ]);
  assert.ok(match, "the pin matches the route");
  const point = match.walkMeters <= 5 ? pin : { ...pin, ...match.pickup.point };
  const drop = { ...dropoff, ...match.dropoff.point };
  const requestId: string = await rpc("save_pickup_draft", {
    p_request_id: null,
    p_latitude: pin.lat,
    p_longitude: pin.lng,
    p_destination: pin.name,
    p_passengers: passengers,
    p_vehicle_type: "Jeepney",
  });
  await rpc("set_pickup_route", {
    p_request_id: requestId,
    p_route_id: match.routeId,
    p_pickup_lat: point.lat,
    p_pickup_lng: point.lng,
    p_dropoff_name: drop.name,
    p_dropoff_lat: drop.lat,
    p_dropoff_lng: drop.lng,
    p_waiting_area_id: null,
  });
  return { requestId, point, walkMeters: match.walkMeters };
};

beforeEach(() => {
  signOutAll();
  engine.reset();
  db.reset();
  mock.timers.enable({ apis: ["setInterval"] });
  client = createMockClient();
});

afterEach(() => {
  engine.reset();
  signOutAll();
  mock.timers.reset();
});

test("commuter scenario: off-route pin, walk, I AM HERE, accepted, boarded, arrived, bookings, SOS", async () => {
  const juan = await signIn("juan@demo.tsuperhero");
  const profile = await ok(
    client.from("profile").select("user_type, first_name").eq("user_id", juan).maybeSingle(),
  );
  assert.deepEqual(profile, { user_type: "commuter", first_name: "Juan" });
  const commuterId = await findCommuter(juan);
  const areas: Row[] = await ok(client.from("waiting_area").select("*").eq("is_active", true));
  assert.ok(areas.length > 10);
  assert.ok(areas.every((a) => a.request_radius_m === 100 && a.area_name && a.area_type));
  const live: Row[] = await rpc("get_live_vehicles_with_last_seen");
  assert.ok(live.length >= 3);
  assert.ok(live.every((v) => typeof v.latitude === "number" && v.recorded_at));

  const home = homePoints.juan;
  const pin = { lat: home[0], lng: home[1], name: "Pinned location" };
  const { requestId, point, walkMeters } = await requestPickupLikeTheApp(pin, area("E-Mall"));
  assert.ok(walkMeters > 5, "the pin is off the route");
  await rpc("publish_pickup_draft", { p_request_id: requestId });

  const pending = await findActiveRequest(commuterId);
  assert.equal(pending.request_id, requestId);
  assert.equal(pending.request_status, "pending");
  assert.equal(pending.arrived_at, null);
  assert.equal(pending.pickup[0].pickup_lat, point.lat);
  assert.equal(pending.pickup[0].dropoff_name, "E-Mall");

  const early = await client.rpc("mark_pickup_arrived", {
    p_request_id: requestId,
    p_latitude: home[0],
    p_longitude: home[1],
  });
  assert.match(String(early.error?.message), /Go to the pickup point first/);

  simulateWalkTo(point);
  mock.timers.tick(1000);
  assert.ok(getDistanceMeters(currentSimulatedPoint(), point) > 1);
  assert.equal(engine.arriveNow(), true);
  const here = currentSimulatedPoint();
  assert.ok(getDistanceMeters(here, point) < 1);

  const visibleSince = await rpc("mark_pickup_arrived", {
    p_request_id: requestId,
    p_latitude: here.lat,
    p_longitude: here.lng,
  });
  assert.ok(visibleSince);
  assert.ok((await findActiveRequest(commuterId)).arrived_at);

  engine.setSpeed(1);
  assert.ok(tickUntil(() => requestOf(requestId).request_status === "accepted", 10));
  const driver = await rpc("get_my_pickup_driver");
  assert.equal(driver.request_id, requestId);
  assert.equal(driver.plate_number, "DEMO 101");
  assert.equal(typeof driver.location.latitude, "number");
  assert.equal((await findActiveRequest(commuterId)).request_status, "accepted");

  engine.setSpeed(10);
  assert.ok(tickUntil(() => requestOf(requestId).request_status === "riding"));
  const [progress] = await rpc("get_my_ride_progress");
  assert.equal(progress.request_id, requestId);
  assert.equal(progress.plate_number, "DEMO 101");
  assert.equal(progress.driver_name, "Mario Santos");
  assert.equal(typeof progress.vehicle_lat, "number");
  assert.ok(progress.vehicle_recorded_at);

  const before = db.tables.ride_emergency.length;
  await rpc("report_ride_emergency", {
    p_request_id: requestId,
    p_latitude: here.lat,
    p_longitude: here.lng,
  });
  assert.equal(db.tables.ride_emergency.length, before + 1);

  assert.ok(tickUntil(() => requestOf(requestId).request_status === "completed"));
  assert.equal(await findActiveRequest(commuterId), null);
  const status = await ok(
    client.from("request").select("request_status").eq("request_id", requestId).maybeSingle(),
  );
  assert.equal(status.request_status, "completed");
  assert.equal(await rpc("complete_my_ride", { p_request_id: requestId }), "already_completed");

  const bookings: Row[] = await rpc("get_my_bookings");
  const latest = bookings[0];
  assert.equal(latest.request_id, requestId);
  assert.equal(latest.request_type, "Pickup");
  assert.ok(latest.boarded_at && latest.dropped_at);
  assert.equal(latest.dropoff_name, "E-Mall");
  assert.equal(latest.plate_number, "DEMO 101");
  assert.equal((latest.riders as Row[])[0].is_me, true);
  assert.ok(bookings.filter((b) => b.request_type === "Pickup").length >= 4);
  assert.ok(bookings.some((b) => b.request_type === "Charter_Rental"));

  const pickupRating = await client.rpc("rate_request", {
    p_request_id: requestId,
    p_score: 5,
    p_feedback: "Great",
  });
  assert.equal(pickupRating.error?.message, "Only rentals can be rated.");
  const rental = bookings.find((b) => b.request_type === "Charter_Rental")!;
  assert.equal((rental.drivers as Row[])[0].plate_number, "DEMO 101");
  assert.equal(rental.drivers_total, 1);

  const notices: Row[] = await ok(
    client
      .from("notification")
      .select("notification_id, user_id, notification_type, title, body, data, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(50),
  );
  const types = notices.map((n) => n.notification_type);
  for (const t of ["pickup_accepted", "pickup_boarded", "pickup_completed"]) {
    assert.ok(types.includes(t), t);
  }
  assert.ok(notices.every((n) => n.user_id === juan));
  await ok(
    client
      .from("notification")
      .update({ read_at: new Date().toISOString() })
      .in("notification_id", notices.map((n) => n.notification_id))
      .is("read_at", null),
  );
  assert.ok(db.tables.notification.filter((n) => n.user_id === juan).every((n) => n.read_at));
});

test("commuter scenario: a shared ride with Ana completes for both riders", async () => {
  const juan = await signIn("juan@demo.tsuperhero");
  const commuterId = await findCommuter(juan);
  const from = area("SAFE Gas");
  const { requestId } = await requestPickupLikeTheApp(
    { ...pointOf(from), name: String(from.area_name) },
    area("E-Mall"),
    2,
  );
  const found: Row[] = await rpc("search_available_commuters", { p_query: "Ana" });
  const ana = found.find((r) => r.first_name === "Ana")!;
  assert.equal(ana.user_id, userId("ana"));
  await rpc("add_pickup_companions", { p_request_id: requestId, p_user_ids: [ana.user_id] });
  let statuses: Row[] = await rpc("get_pickup_companion_statuses", { p_request_id: requestId });
  assert.equal(statuses[0].companion_status, "pending");
  engine.setSpeed(1);
  assert.ok(
    tickUntil(() =>
      db.tables.pickup_companion.some(
        (c) => c.request_id === requestId && c.companion_status === "accepted",
      ),
    10),
  );
  statuses = await rpc("get_pickup_companion_statuses", { p_request_id: requestId });
  assert.equal(statuses[0].companion_status, "accepted");
  await rpc("publish_pickup_draft", { p_request_id: requestId });
  const party: Row[] = await rpc("get_ride_party", { p_request_id: requestId });
  assert.deepEqual(
    party.map((p) => [p.first_name, p.is_owner]),
    [["Ana", false]],
  );

  simulateWalkTo(pointOf(from));
  engine.arriveNow();
  const here = currentSimulatedPoint();
  await rpc("mark_pickup_arrived", {
    p_request_id: requestId,
    p_latitude: here.lat,
    p_longitude: here.lng,
  });
  engine.setSpeed(10);
  assert.ok(tickUntil(() => requestOf(requestId).request_status === "completed"));
  const bookings: Row[] = await rpc("get_my_bookings");
  const ride = bookings.find((b) => b.request_id === requestId)!;
  assert.deepEqual(
    (ride.riders as Row[]).map((r) => r.first_name),
    ["Juan", "Ana"],
  );
  assert.equal((await findActiveRequest(commuterId)), null);

  await client.auth.signOut({ scope: "local" });
  await signIn("ana@demo.tsuperhero");
  const anaBookings: Row[] = await rpc("get_my_bookings");
  const shared = anaBookings.find((b) => b.request_id === requestId)!;
  assert.equal(shared.shared_by, "Juan");
  assert.ok(
    db.tables.trip_history.some(
      (h) => h.commuter_id === db.tables.commuter.find((c) => c.user_id === userId("ana"))!.commuter_id,
    ),
  );
});

test("driver scenario: start trip, accept, board, drop off, end trip, trip history, ratings", async () => {
  const mario = await signIn("mario@demo.tsuperhero");
  const profile = await ok(
    client.from("profile").select("user_type, first_name").eq("user_id", mario).maybeSingle(),
  );
  assert.equal(profile.user_type, "transit_personnel");
  const assignment = await rpc("get_my_vehicle_assignment");
  assert.equal(assignment.vehicle.plate_number, "DEMO 101");
  assert.equal(assignment.vehicle.max_capacity, 24);
  assert.ok(assignment.route_id);
  assert.equal(assignment.cooperative.cooperative_name, "Bicol Demo Transport Cooperative");

  const tripsBefore: Row[] = await rpc("get_my_trips");
  assert.equal(tripsBefore.length, 4);

  const tripId = await rpc("start_my_trip", { p_distance_total_km: 8.4 });
  assert.equal(typeof tripId, "string");
  await rpc("set_my_vehicle_trip_state", {
    p_status: "on-trip",
    p_current_capacity: 0,
    p_is_full: false,
  });
  engine.setSpeed(10);
  const start = currentSimulatedPoint();
  mock.timers.tick(1000);
  const fix = currentSimulatedPoint();
  assert.ok(getDistanceMeters(start, fix) > 10, "simulated GPS drives the vehicle");
  await rpc("share_my_vehicle_location", {
    p_latitude: fix.lat,
    p_longitude: fix.lng,
    p_speed_kmh: 18,
    p_heading: 0,
  });
  assert.equal(engine.sendPickupRequest(), true);
  assert.equal(engine.sendPickupRequest(), true);

  let nearby: Row[] = [];
  for (let i = 0; i < 600 && nearby.length === 0; i++) {
    nearby = await rpc("get_my_nearby_pickups");
    if (nearby.length === 0) mock.timers.tick(1000);
  }
  assert.ok(nearby.length > 0, "pickup requests appear for the driver");
  const target = nearby[0];
  assert.equal(typeof target.latitude, "number");
  assert.equal(typeof target.distance_m, "number");
  const waiting = await rpc("accept_pickup_request", { p_request_id: target.request_id });
  assert.equal(typeof waiting, "number");

  let boarded: number | null = null;
  for (let i = 0; i < 900 && boarded === null; i++) {
    const here = currentSimulatedPoint();
    if (getDistanceMeters(here, { lat: target.latitude, lng: target.longitude }) <= 40) {
      boarded = await rpc("board_pickup", { p_request_id: target.request_id });
    } else mock.timers.tick(1000);
  }
  assert.equal(boarded, target.passengers);
  assert.equal(requestOf(target.request_id).request_status, "riding");

  const riders: Row[] = await rpc("get_my_vehicle_riders");
  const rider = riders.find((r) => r.request_id === target.request_id)!;
  assert.ok(rider.dropoff_name && typeof rider.dropoff_lat === "number");

  assert.ok(tickUntil(() => requestOf(target.request_id).request_status === "completed", 2000));
  const after: Row[] = await rpc("get_my_vehicle_riders");
  assert.ok(!after.some((r) => r.request_id === target.request_id));

  await rpc("end_my_trip", { p_distance_done_km: 3.2 });
  const trips: Row[] = await rpc("get_my_trips");
  assert.equal(trips.length, 5);
  assert.equal(trips[0].trip_id, tripId);
  assert.equal(trips[0].trip_status, "completed");
  assert.ok(trips[0].arrival_time);
  assert.equal(trips[0].route_name, "Del Rosario - Concepcion - Magsaysay - Centro");
  assert.ok(Number(trips[0].pickups) >= 1);

  const ratings = await rpc("get_my_ratings");
  assert.equal(ratings.average, 4.6);
  assert.equal(ratings.count, 5);
  assert.equal(ratings.recent.filter((r: Row) => r.feedback).length, 2);
  assert.ok(
    ratings.recent.every((r: Row) => String(r.commuter_picture).startsWith("data:image/")),
  );
  const url = client.storage
    .from("profile-pictures")
    .getPublicUrl(String(ratings.recent[0].commuter_picture)).data.publicUrl;
  assert.ok(url.startsWith("data:image/"));
});

const collectRoutes = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectRoutes(full, out);
    else if (name === "routes.ts") out.push(full);
  }
  return out;
};

test("every table the api reads is a mock table", () => {
  const tables = new Set<string>();
  for (const file of collectRoutes("src/api")) {
    for (const m of readFileSync(file, "utf8").matchAll(/\.from\(\s*"([a-z_-]+)"/g)) {
      if (!m[1].includes("-")) tables.add(m[1]);
    }
  }
  const missing = [...tables].filter((t) => !(t in db.tables)).sort();
  assert.deepEqual(missing, []);
  assert.ok(tables.has("request") && tables.has("notification"));
});

test("every screen's read call answers without an error for each demo role", async () => {
  await signIn("juan@demo.tsuperhero");
  for (const name of [
    "get_my_pickup_draft",
    "get_my_share_invites",
    "get_my_shared_ride",
    "get_my_bookings",
    "get_my_rentals",
    "get_my_ride_progress",
    "get_my_pickup_driver",
    "get_live_vehicles_with_last_seen",
    "get_live_vehicles_with_full",
  ]) {
    await rpc(name);
  }
  await rpc("register_push_token", { p_token: "ExponentPushToken[demo]", p_platform: "android" });
  await rpc("unregister_push_token", { p_token: "ExponentPushToken[demo]" });
  for (const email of ["mario@demo.tsuperhero", "pedro@demo.tsuperhero"]) {
    await client.auth.signOut({ scope: "local" });
    await signIn(email);
    for (const name of [
      "get_my_vehicle_assignment",
      "get_my_nearby_pickups",
      "get_my_vehicle_riders",
      "get_my_trips",
      "get_my_rental_requests",
      "get_rental_job_board",
      "get_my_ratings",
    ]) {
      await rpc(name);
    }
  }
});

test("rental scenario: Juan posts, Mario accepts on the job board, Juan completes and rates", async () => {
  await signIn("juan@demo.tsuperhero");
  const pickupTime = new Date(Date.now() + 2 * 86400_000).toISOString();
  const rentalId = await rpc("post_charter_rental", {
    p_vehicles: ["Jeepney"],
    p_pickup_location: "Centro, Naga City",
    p_pickup_latitude: 13.6229,
    p_pickup_longitude: 123.1851,
    p_destination: "Mt. Isarog",
    p_destination_latitude: 13.66,
    p_destination_longitude: 123.3,
    p_pickup_time: pickupTime,
    p_trip_type: "one_way",
    p_return_time: null,
    p_purpose: "Field trip",
    p_passengers: 15,
    p_notes: null,
  });
  assert.equal(typeof rentalId, "string");
  const mine: Row[] = await rpc("get_my_rentals");
  const posted = mine.find((r) => r.request_id === rentalId)!;
  assert.equal(posted.status, "pending");
  assert.equal((posted.units as Row[])[0].status, "open");

  await client.auth.signOut({ scope: "local" });
  await signIn("mario@demo.tsuperhero");
  const board: Row[] = await rpc("get_rental_job_board");
  assert.ok(board.length >= 2, "the seeded job and Juan's post are on the board");
  const job = board.find((r) => r.request_id === rentalId)!;
  assert.ok(job.unit_id);
  await rpc("accept_rental_job", { p_unit_id: job.unit_id });
  const requests: Row[] = await rpc("get_my_rental_requests");
  assert.ok(requests.some((r) => r.request_id === rentalId));
  const seeded = board.find((r) => r.request_id !== rentalId)!;
  await rpc("accept_rental_job", { p_unit_id: seeded.unit_id });

  await client.auth.signOut({ scope: "local" });
  await signIn("juan@demo.tsuperhero");
  const booked = await rpc("get_my_rental", { p_request_id: rentalId });
  assert.equal(booked.status, "accepted");
  assert.equal(booked.plate_number, "DEMO 101");
  await rpc("complete_rental", { p_request_id: rentalId });
  const done = await rpc("get_my_rental", { p_request_id: rentalId });
  assert.equal(done.status, "completed");
  const driverId = (done.units as Row[])[0].driver_id;
  await rpc("rate_rental_driver", {
    p_request_id: rentalId,
    p_driver_id: driverId,
    p_score: 5,
    p_feedback: "Excellent",
    p_tags: [],
  });

  await client.auth.signOut({ scope: "local" });
  await signIn("mario@demo.tsuperhero");
  const ratings = await rpc("get_my_ratings");
  assert.equal(ratings.count, 6);
  assert.equal(ratings.recent[0].commuter_name, "Juan");
  assert.equal(ratings.recent[0].feedback, "Excellent");
  assert.ok(String(ratings.recent[0].commuter_picture).startsWith("data:image/"));
});
