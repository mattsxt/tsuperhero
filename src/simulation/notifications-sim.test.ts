import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { signInAs, signOutAll } from "@/simulation/auth";
import { db } from "@/simulation/db";
import * as engine from "@/simulation/engine";
import { generateNotification } from "@/simulation/notifications-sim";
import { handlers } from "@/simulation/rpc";
import { commuterId, userId } from "@/simulation/seed/people";

const call = (name: string, args: unknown = {}) => handlers[name](args) as any;
const as = (key: string) => {
  signOutAll();
  signInAs(userId(key), `${key}@demo.tsuperhero`);
};
const notesFor = (key: string) => db.tables.notification.filter((n) => n.user_id === userId(key));
const lastNoteFor = (key: string) => notesFor(key)[notesFor(key).length - 1];

beforeEach(() => {
  mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  db.reset();
  engine.reset();
});

afterEach(() => {
  engine.reset();
  signOutAll();
  mock.timers.reset();
});

test("commuter notifications are backed by data", () => {
  as("juan");
  const first = generateNotification();
  assert.deepEqual(first, { ok: true, type: "pickup_shared" });
  assert.equal(lastNoteFor("juan").notification_type, "pickup_shared");
  const invite = db.tables.pickup_companion.find(
    (c) => c.commuter_id === commuterId("juan") && c.companion_status === "pending",
  );
  assert.ok(invite, "Juan has a pending share invite");
  assert.equal(call("get_my_share_invites").length, 1);

  const second = generateNotification();
  assert.deepEqual(second, { ok: true, type: "rate_trip" });
  const note = lastNoteFor("juan");
  const request = db.tables.request.find((r) => r.request_id === (note.data as any).request_id)!;
  assert.equal(request.request_type, "Pickup");
  assert.equal(request.request_status, "completed");
  assert.ok(!db.tables.rating.some((r) => r.request_id === request.request_id));
});

test("commuter rental_accepted books a unit of the open rental", () => {
  as("juan");
  const id = call("post_charter_rental", {
    p_vehicles: ["Jeepney"],
    p_pickup_location: "Centro, Naga City",
    p_pickup_latitude: 13.62,
    p_pickup_longitude: 123.18,
    p_destination: "Mayon View",
    p_destination_latitude: 13.2,
    p_destination_longitude: 123.7,
    p_pickup_time: new Date(Date.now() + 2 * 86400_000).toISOString(),
    p_trip_type: "one_way",
    p_return_time: null,
    p_purpose: "Family outing",
    p_passengers: 10,
    p_notes: null,
  });
  let result: ReturnType<typeof generateNotification> = { ok: false, reason: "" };
  for (let i = 0; i < 3 && (!result.ok || result.type !== "rental_accepted"); i++)
    result = generateNotification();
  assert.deepEqual(result, { ok: true, type: "rental_accepted" });
  assert.ok(db.tables.charter_rental_unit.some((u) => u.request_id === id && u.status === "booked"));
});

test("driver rental_request notification creates a job", () => {
  as("mario");
  assert.deepEqual(generateNotification(), { ok: true, type: "rental_request" });
  const note = lastNoteFor("mario");
  assert.ok(
    call("get_rental_job_board").some((j: any) => j.request_id === (note.data as any).request_id),
  );
});

test("rating_received adds a rating to the driver's ratings", () => {
  as("mario");
  const before = db.tables.rating.length;
  generateNotification();
  assert.deepEqual(generateNotification(), { ok: true, type: "rating_received" });
  assert.equal(db.tables.rating.length, before + 1);
  const note = lastNoteFor("mario");
  assert.ok(call("get_my_ratings"));
  assert.ok(db.tables.rating.some((r) => r.request_id === (note.data as any).request_id));
});

test("pickup_nearby only fires during a trip", () => {
  as("mario");
  generateNotification();
  generateNotification();
  const third = generateNotification();
  assert.notEqual((third as any).type, "pickup_nearby");
});

test("no candidate gives a reason and inserts nothing", () => {
  as("juan");
  generateNotification();
  for (const request of db.tables.request.filter(
    (r) => r.commuter_id === commuterId("juan") && r.request_type === "Pickup" && r.request_status === "completed",
  )) {
    db.tables.rating.push({ rating_id: db.id(), request_id: request.request_id, score: 5 });
  }
  const count = db.tables.notification.length;
  const result = generateNotification();
  assert.equal(result.ok, false);
  assert.equal((result as any).reason, "Nothing to notify about right now. Try another screen first.");
  assert.equal(db.tables.notification.length, count);
});

test("a tricycle driver gets every driver notification, with readable rental dates", () => {
  as("pedro");
  const types = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const result = generateNotification();
    if (result.ok) types.add(result.type);
  }
  assert.ok(types.has("rental_request") && types.has("rating_received"), [...types].join(","));
  const rental = notesFor("pedro").find((n) => n.notification_type === "rental_request")!;
  assert.doesNotMatch(String(rental.body), /NaN|undefined/, String(rental.body));
  const newUnits = db.tables.charter_rental_unit.filter((u) => u.status === "open");
  assert.ok(newUnits.some((u) => u.vehicle_type === "Tricycle"), "rental jobs are for tricycles");

  call("start_my_trip", { p_distance_total_km: 3 });
  engine.start();
  mock.timers.tick(2000);
  let nearby = false;
  for (let i = 0; i < 6 && !nearby; i++) {
    const result = generateNotification();
    nearby = result.ok && result.type === "pickup_nearby";
  }
  assert.ok(nearby, "on a trip, a tricycle driver gets nearby pickups too");
  assert.match(String(lastNoteFor("pedro").body), /1 passenger waiting at /);
});
