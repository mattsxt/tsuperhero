import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { signInAs } from "@/simulation/auth";
import { db } from "@/simulation/db";
import { handlers } from "@/simulation/rpc";
import { driverId, userId } from "@/simulation/seed/people";

const call = (name: string, args: unknown = {}) => handlers[name](args) as any;
const as = (key: string) => signInAs(userId(key), `${key}@demo.tsuperhero`);
const throws = (fn: () => unknown, message: string) =>
  assert.throws(fn, (e: any) => e.message === message);

const post = (over: Record<string, unknown> = {}) =>
  call("post_charter_rental", {
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
    ...over,
  });

beforeEach(() => {
  db.reset();
  as("ana");
});

test("post, job board, accept, complete, rate, ratings average", () => {
  const id = post();
  assert.equal(call("get_my_rentals").length, 1);
  as("mario");
  const board = call("get_rental_job_board");
  const mine = board.find((j: any) => j.request_id === id);
  assert.ok(mine);
  assert.equal(mine.unit_vehicle_type, "Jeepney");
  const before = call("get_my_ratings");
  call("accept_rental_job", { p_unit_id: mine.unit_id });
  assert.equal(call("get_my_rental_requests").some((r: any) => r.request_id === id), true);
  as("ana");
  assert.equal(call("get_my_rental", { p_request_id: id }).status, "accepted");
  call("complete_rental", { p_request_id: id });
  call("rate_rental_driver", {
    p_request_id: id,
    p_driver_id: driverId("mario"),
    p_score: 1,
    p_feedback: "Late",
    p_tags: [],
  });
  throws(
    () => call("rate_rental_driver", { p_request_id: id, p_driver_id: driverId("mario"), p_score: 5, p_feedback: null, p_tags: [] }),
    "You already rated this driver.",
  );
  as("mario");
  const after = call("get_my_ratings");
  assert.equal(after.count, before.count + 1);
  assert.ok(Number(after.average) < Number(before.average));
  assert.equal(after.recent[0].feedback, "Late");
  assert.ok(after.recent[0].commuter_picture);
  const note = db.tables.notification.filter((n) => n.user_id === userId("mario"));
  assert.ok(note.some((n) => n.notification_type === "rating_received"));
});

test("post validation and single active rental", () => {
  throws(() => post({ p_vehicles: [] }), "Choose at least one vehicle to rent.");
  throws(() => post({ p_pickup_time: new Date(Date.now() - 1000).toISOString() }), "Choose a pickup time in the future.");
  throws(() => post({ p_passengers: 100 }), "These vehicles seat up to 24 passengers. Add another vehicle or choose bigger ones.");
  post();
  throws(() => post(), "You already have an active rental request. Cancel it before posting another.");
});

test("cancel removes the rental", () => {
  const id = post();
  call("cancel_my_rental", { p_request_id: id });
  assert.equal(call("get_my_rentals").length, 0);
  throws(() => call("cancel_my_rental", { p_request_id: id }), "This rental can no longer be cancelled.");
});

test("drop and remove reopen the unit", () => {
  const id = post();
  as("mario");
  const unit = call("get_rental_job_board").find((j: any) => j.request_id === id).unit_id;
  call("accept_rental_job", { p_unit_id: unit });
  throws(() => call("accept_rental_job", { p_unit_id: unit }), "Another driver already took this vehicle.");
  call("drop_rental_job", { p_request_id: id });
  assert.equal(call("get_rental_job_board").some((j: any) => j.request_id === id), true);
  call("accept_rental_job", { p_unit_id: unit });
  as("ana");
  call("remove_rental_driver", { p_unit_id: unit });
  assert.equal(call("get_my_rental", { p_request_id: id }).status, "pending");
});

test("dismiss hides a job; seeded board has two", () => {
  as("mario");
  const first = call("get_rental_job_board");
  assert.equal(first.length, 1);
  call("dismiss_rental_job", { p_request_id: first[0].request_id });
  assert.equal(call("get_rental_job_board").length, 0);
});

test("rate_request, push tokens, live vehicles", () => {
  as("juan");
  const done = call("get_my_bookings")[0];
  const rid = db.tables.request.find((r) => r.request_type === "Charter_Rental" && r.request_status === "completed")!.request_id;
  assert.ok(done);
  call("rate_request", { p_request_id: rid, p_score: 5, p_feedback: null });
  throws(() => call("rate_request", { p_request_id: rid, p_score: 5, p_feedback: null }), "You already rated this trip.");
  assert.equal(call("register_push_token", { p_token: "t", p_platform: "android" }), null);
  assert.equal(call("unregister_push_token", { p_token: "t" }), null);
  const live = call("get_live_vehicles_with_last_seen");
  assert.ok(live.length >= 3);
  assert.ok(live[0].recorded_at);
  assert.equal("recorded_at" in call("get_live_vehicles_with_full")[0], false);
});

test("seeded driver ratings come from completed rentals", () => {
  as("mario");
  const summary = call("get_my_ratings");
  assert.equal(summary.average, 4.6);
  assert.equal(summary.count, 5);
  assert.ok(summary.recent.every((r: any) => r.request_type === "Charter_Rental"));
  assert.equal(summary.recent.filter((r: any) => r.feedback).length, 2);
});
