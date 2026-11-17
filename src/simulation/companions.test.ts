import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { signInAs, signOutAll } from "@/simulation/auth";
import { db, type Row } from "@/simulation/db";
import * as engine from "@/simulation/engine";
import { companionBusyTrip, markCompanionBusy } from "@/simulation/companion-busy";
import { currentSimulatedPoint } from "@/simulation/gps";
import { handlers } from "@/simulation/rpc";
import { userId } from "@/simulation/seed/people";
import { getDistanceMeters } from "@/utils/geo";

const call = (name: string, args: unknown = {}) => handlers[name](args) as any;
const as = (key: string) => {
  signOutAll();
  signInAs(userId(key), `${key}@demo.tsuperhero`);
};
const area = (name: string) => db.tables.waiting_area.find((w) => w.area_name === name)!;
const marioRoute = () => db.tables.route.find((r) => r.route_code === "DEL-CON-MAG-CEN")!;

const pickupWithAna = () => {
  const from = area("SAFE Gas");
  const id = call("save_pickup_draft", {
    p_request_id: null,
    p_latitude: from.area_latitude,
    p_longitude: from.area_longitude,
    p_destination: String(from.area_name),
    p_passengers: 2,
    p_vehicle_type: "Jeepney",
  });
  call("add_pickup_companions", { p_request_id: id, p_user_ids: [userId("ana")] });
  return String(id);
};
const companionOf = (id: string) => db.tables.pickup_companion.find((c) => c.request_id === id)!;
const notified = (type: string) =>
  db.tables.notification.some((n) => n.user_id === userId("juan") && n.notification_type === type);

beforeEach(() => {
  mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  db.reset();
  engine.reset();
  as("juan");
});

afterEach(() => {
  engine.reset();
  signOutAll();
  mock.timers.reset();
});

test("search returns the new mock commuters", () => {
  const names = (call("search_available_commuters", { p_query: "ma" }) as Row[]).map(
    (r) => `${r.first_name} ${r.last_name}`,
  );
  assert.ok(names.includes("Marco Villanueva"), JSON.stringify(names));
});

test("search lists everyone when asked to list all", () => {
  const all = call("search_available_commuters", { p_query: "", p_list_all: true }) as Row[];
  assert.ok(all.length >= 12, String(all.length));
  assert.ok(!all.some((r) => r.user_id === userId("juan")));
  assert.deepEqual(call("search_available_commuters", { p_query: "" }), []);
});

test("invited companions stay pending until answered", () => {
  const id = pickupWithAna();
  engine.start();
  for (let i = 0; i < 30; i++) mock.timers.tick(1000);
  assert.equal(companionOf(id).companion_status, "pending");
  const invites = engine.pendingCompanionInvites();
  assert.equal(invites.length, 1);
  assert.equal(invites[0].name, "Ana Reyes");
});

test("answerCompanionInvite accept starts the companion walk near the commuter", () => {
  const id = pickupWithAna();
  const [invite] = engine.pendingCompanionInvites();
  assert.equal(engine.answerCompanionInvite(invite.key, true), true);
  assert.equal(companionOf(id).companion_status, "accepted");
  assert.ok(notified("share_ride_accepted"));
  assert.deepEqual(engine.pendingCompanionInvites(), []);
  const from = area("SAFE Gas");
  call("set_pickup_route", {
    p_request_id: id,
    p_route_id: marioRoute().route_id,
    p_pickup_lat: from.area_latitude,
    p_pickup_lng: from.area_longitude,
    p_dropoff_lat: area("E-Mall").area_latitude,
    p_dropoff_lng: area("E-Mall").area_longitude,
    p_dropoff_name: "E-Mall",
    p_waiting_area_id: from.area_id,
  });
  engine.start();
  mock.timers.tick(1000);
  const start = engine.companionWalkStart(invite.key);
  assert.ok(start);
  const meters = getDistanceMeters(currentSimulatedPoint(), { lat: start[0], lng: start[1] });
  assert.ok(Math.abs(meters - 200) < 20, String(meters));
});

test("an accepted invite simulates the signed-in companion walking to the pickup", () => {
  const id = pickupWithAna();
  const request = db.tables.request.find((r) => r.request_id === id)!;
  const pickup = db.tables.pickup.find((p) => p.request_id === id)!;
  const target = {
    lat: Number(pickup.pickup_lat ?? request.device_latitude),
    lng: Number(pickup.pickup_lng ?? request.device_longitude),
  };
  as("ana");
  assert.equal(call("respond_to_share_invite", { p_request_id: id, p_accept: true }), 2);
  const companion = companionOf(id);
  assert.equal(companion.companion_status, "accepted");
  const before = currentSimulatedPoint();
  assert.ok(getDistanceMeters(before, target) > 20);

  engine.start();
  for (let i = 0; i < 900 && !companion.arrived_at; i++) mock.timers.tick(1000);

  assert.ok(companion.arrived_at, "the accepted companion eventually reaches the pickup");
  assert.ok(getDistanceMeters(currentSimulatedPoint(), target) < 3);
  assert.ok(getDistanceMeters(before, currentSimulatedPoint()) > 20);
});

test("demo controls mark an invited companion busy with a pickup or rental", () => {
  for (const kind of ["pickup", "rental"] as const) {
    db.reset();
    engine.reset();
    as("juan");
    const id = pickupWithAna();
    const ana = db.tables.commuter.find((row) => row.user_id === userId("ana"))!;
    const invite = engine.pendingCompanionInvites()[0];

    assert.equal(markCompanionBusy(id, String(ana.commuter_id), kind), true);
    assert.equal(companionBusyTrip(ana.commuter_id), kind);
    assert.equal(engine.pendingCompanionInvites()[0].busy, kind);
    assert.equal(engine.answerCompanionInvite(invite.key, true), false);

    as("ana");
    assert.throws(
      () => call("respond_to_share_invite", { p_request_id: id, p_accept: true }),
      /pickup request|active rental/,
    );
  }
});

test("a new pickup request clears the temporary simulated busy trip", () => {
  const inviteRequestId = pickupWithAna();
  const ana = db.tables.commuter.find((row) => row.user_id === userId("ana"))!;
  assert.equal(markCompanionBusy(inviteRequestId, String(ana.commuter_id)), true);
  const busyRequestId = String(companionOf(inviteRequestId).busy_request_id);
  assert.ok(db.tables.request.some((row) => row.request_id === busyRequestId));

  as("ana");
  const from = area("SAFE Gas");
  const pickupRequestId = call("save_pickup_draft", {
    p_request_id: null,
    p_latitude: from.area_latitude,
    p_longitude: from.area_longitude,
    p_destination: String(from.area_name),
    p_passengers: 1,
    p_vehicle_type: "Jeepney",
  });

  assert.ok(pickupRequestId);
  assert.equal(companionBusyTrip(ana.commuter_id), null);
  assert.equal(companionOf(inviteRequestId).busy_trip, undefined);
  assert.equal(companionOf(inviteRequestId).busy_request_id, undefined);
  assert.equal(db.tables.request.some((row) => row.request_id === busyRequestId), false);
});

test("answerCompanionInvite decline notifies the owner and frees the seat", () => {
  const id = pickupWithAna();
  const [invite] = engine.pendingCompanionInvites();
  assert.equal(engine.answerCompanionInvite(invite.key, false), true);
  assert.equal(companionOf(id).companion_status, "rejected");
  assert.ok(notified("share_ride_declined"));
  assert.equal(Number(db.tables.pickup.find((p) => p.request_id === id)!.number_of_passengers), 1);
  assert.equal(engine.answerCompanionInvite(invite.key, true), false);
});

test("drivers see no companion invites", () => {
  pickupWithAna();
  as("mario");
  assert.deepEqual(engine.pendingCompanionInvites(), []);
});
