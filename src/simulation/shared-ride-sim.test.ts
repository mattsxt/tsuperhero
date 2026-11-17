import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { signInAs, signOutAll } from "@/simulation/auth";
import { db } from "@/simulation/db";
import { generateRideAsCompanion, generateRideAsHost } from "@/simulation/demo-rides";
import * as engine from "@/simulation/engine";
import { currentSimulatedPoint } from "@/simulation/gps";
import { generateNotification } from "@/simulation/notifications-sim";
import { handlers } from "@/simulation/rpc";
import { commuterId, userId } from "@/simulation/seed/people";
import { getDistanceMeters } from "@/utils/geo";

const call = (name: string, args: unknown = {}) => handlers[name](args) as any;

beforeEach(() => {
  mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  db.reset();
  engine.reset();
  signOutAll();
  signInAs(userId("juan"), "juan@demo.tsuperhero");
});

afterEach(() => {
  engine.reset();
  signOutAll();
  mock.timers.reset();
});

const joinSharedRide = (): string => {
  assert.deepEqual(generateNotification(), { ok: true, type: "pickup_shared" });
  const invite = db.tables.pickup_companion.find(
    (c) => c.commuter_id === commuterId("juan") && c.companion_status === "pending",
  )!;
  call("respond_to_share_invite", { p_request_id: invite.request_id, p_accept: true });
  return String(invite.request_id);
};

const statusOf = (id: string) =>
  db.tables.request.find((r) => r.request_id === id)?.request_status;

const tickUntil = (done: () => boolean, max = 900) => {
  for (let i = 0; i < max && !done(); i++) mock.timers.tick(1000);
  return done();
};

test("a generated share invite already carries the journey", () => {
  const id = joinSharedRide();
  const [ride] = call("get_my_shared_ride");
  assert.equal(ride.request_id, id);
  assert.ok(ride.route_id, "the shared ride has a route");
  assert.ok(ride.dropoff_name, "the shared ride has a drop-off name");
  assert.equal(typeof ride.dropoff_lat, "number");
  assert.equal(typeof ride.dropoff_lng, "number");
  assert.ok(
    getDistanceMeters(
      { lat: ride.latitude, lng: ride.longitude },
      { lat: ride.dropoff_lat, lng: ride.dropoff_lng },
    ) > 300,
    "the drop-off is further along the route",
  );
});

const fellowOf = (id: string) =>
  db.tables.pickup_companion.find(
    (c) => c.request_id === id && c.commuter_id !== commuterId("juan"),
  )!;

test("the share invite comes with a simulated co-companion the demo controls can answer", () => {
  assert.deepEqual(generateNotification(), { ok: true, type: "pickup_shared" });
  const invites = engine.pendingCompanionInvites();
  assert.equal(invites.length, 1, "Juan sees the other invited rider in the demo controls");
  const id = invites[0].requestId;
  assert.equal(fellowOf(id).companion_status, "pending");
  assert.equal(db.tables.pickup.find((p) => p.request_id === id)!.number_of_passengers, 3);
  assert.ok(
    !invites.some((invite) => invite.commuterId === commuterId("juan")),
    "Juan's own invite is answered in the app, not the demo controls",
  );
});

const ownerUserId = (id: string) => {
  const owner = db.tables.request.find((r) => r.request_id === id)!.commuter_id;
  return String(db.tables.commuter.find((c) => c.commuter_id === owner)!.user_id);
};

const markFellowBusyAsHost = async (id: string) => {
  const { markCompanionBusy } = await import("@/simulation/companion-busy");
  signOutAll();
  signInAs(ownerUserId(id), "host@demo.tsuperhero");
  assert.equal(markCompanionBusy(id, String(fellowOf(id).commuter_id)), true);
  signOutAll();
  signInAs(userId("juan"), "juan@demo.tsuperhero");
};

test("only the host can mark an invited companion busy", async () => {
  const id = joinSharedRide();
  const [invite] = engine.pendingCompanionInvites();
  assert.equal(invite.hosted, false, "Juan is a companion here, not the host");
  const { markCompanionBusy } = await import("@/simulation/companion-busy");
  assert.equal(markCompanionBusy(id, String(fellowOf(id).commuter_id)), false);
  assert.equal(engine.pendingCompanionInvites()[0].busy, null);

  await markFellowBusyAsHost(id);
  assert.ok(engine.pendingCompanionInvites()[0].busy);
});

test("a companion can have the co-companion decline", async () => {
  const id = joinSharedRide();
  await markFellowBusyAsHost(id);
  const [invite] = engine.pendingCompanionInvites();
  assert.equal(engine.answerCompanionInvite(invite.key, true), false, "a busy rider can't accept");
  assert.equal(engine.answerCompanionInvite(invite.key, false), true);
  assert.equal(fellowOf(id).companion_status, "rejected");
  assert.equal(db.tables.pickup.find((p) => p.request_id === id)!.number_of_passengers, 2);
  assert.equal(engine.generateSharedRide().ok, true);
});

test("an accepted co-companion walks to the pickup point from the companion's view", () => {
  const id = joinSharedRide();
  const [invite] = engine.pendingCompanionInvites();
  assert.equal(engine.answerCompanionInvite(invite.key, true), true);
  assert.equal(fellowOf(id).companion_status, "accepted");
  engine.start();
  mock.timers.tick(1000);
  assert.ok(engine.companionWalkStart(invite.key), "the co-companion starts walking");
  assert.equal(engine.arriveNow(), true);
  assert.ok(fellowOf(id).arrived_at, "arrive now brings the co-companion to the pickup point");
  const party = call("get_ride_party", { p_request_id: id });
  assert.ok(party.some((rider: { arrived: boolean; is_owner: boolean }) => !rider.is_owner && rider.arrived));
});

test("generate a ride plays the owner and a driver through to drop-off", () => {
  assert.equal(engine.hasLiveSharedRide(), false);
  assert.equal(engine.generateSharedRide().ok, false);

  const id = joinSharedRide();
  assert.equal(engine.hasLiveSharedRide(), true);
  assert.equal(call("get_my_shared_ride")[0].is_draft, true);

  const generated = engine.generateSharedRide();
  assert.equal(generated.ok, true, generated.message);
  assert.equal(fellowOf(id).companion_status, "accepted", "pending co-companions are answered");
  assert.ok(fellowOf(id).arrived_at, "everyone is placed at the pickup point");
  const [shared] = call("get_my_shared_ride");
  assert.equal(shared.is_draft, false);
  assert.equal(shared.me_arrived, true);
  assert.equal(shared.owner_arrived, true);

  mock.timers.tick(1000);
  assert.equal(statusOf(id), "accepted", "a driver accepts on the next tick");
  assert.equal(engine.generateSharedRide().ok, false, "a second press does not duplicate the ride");
  assert.ok(call("get_my_shared_ride")[0].plate_number, "the companion sees the plate");

  engine.setSpeed(10);

  assert.ok(tickUntil(() => statusOf(id) === "riding"), "the driver picks the riders up");
  assert.equal(call("get_my_ride_progress")[0].request_id, id);

  assert.equal(engine.arriveNow(), true, "arrive now fast-forwards the companion's ride");
  assert.equal(statusOf(id), "completed");
  const dropoff = db.tables.pickup.find((p) => p.request_id === id)!;
  assert.ok(
    getDistanceMeters(currentSimulatedPoint(), {
      lat: Number(dropoff.dropoff_lat),
      lng: Number(dropoff.dropoff_lng),
    }) < 30,
    "Juan ends at the drop-off",
  );
  assert.equal(engine.hasLiveSharedRide(), false);
});

test("generate a ride fills in a missing route and drop-off", () => {
  const id = joinSharedRide();
  const pickup = db.tables.pickup.find((p) => p.request_id === id)!;
  Object.assign(pickup, { route_id: null, dropoff_name: null, dropoff_lat: null, dropoff_lng: null });
  assert.equal(call("get_my_shared_ride")[0].dropoff_name, null);
  assert.equal(engine.generateSharedRide().ok, true);
  const [ride] = call("get_my_shared_ride");
  assert.ok(ride.route_id && ride.dropoff_name);
});

test("a busy co-companion declines when the ride is generated", async () => {
  const id = joinSharedRide();
  await markFellowBusyAsHost(id);
  assert.equal(engine.generateSharedRide().ok, true);
  assert.equal(fellowOf(id).companion_status, "rejected");
});

const rideTo = (id: string) => {
  engine.setSpeed(10);
  assert.ok(tickUntil(() => statusOf(id) === "riding"), "the driver picks the riders up");
  assert.equal(engine.arriveNow(), true);
  assert.equal(statusOf(id), "completed");
};

test("generate a ride as companion works from nothing in one press", () => {
  const generated = generateRideAsCompanion();
  assert.equal(generated.ok, true, generated.message);
  const id = engine.sharedRideId()!;
  assert.ok(id);
  assert.equal(engine.hostedPickupId(), null);
  assert.equal(call("get_my_shared_ride")[0].me_arrived, true);
  assert.equal(generateRideAsHost().ok, false, "a companion can't also host");
  rideTo(id);
});

test("generate a ride as companion reuses a pending invite", () => {
  assert.deepEqual(generateNotification(), { ok: true, type: "pickup_shared" });
  const invite = db.tables.pickup_companion.find(
    (c) => c.commuter_id === commuterId("juan") && c.companion_status === "pending",
  )!;
  assert.equal(generateRideAsCompanion().ok, true);
  assert.equal(engine.sharedRideId(), invite.request_id);
});

test("generate a ride as host creates Juan's pickup with a companion and a driver", () => {
  const generated = generateRideAsHost();
  assert.equal(generated.ok, true, generated.message);
  const id = engine.hostedPickupId()!;
  assert.ok(id);
  const request = db.tables.request.find((r) => r.request_id === id)!;
  assert.equal(request.commuter_id, commuterId("juan"));
  assert.equal(request.is_draft, false);
  assert.ok(request.arrived_at, "the pickup is broadcast with everyone present");
  const companions = db.tables.pickup_companion.filter((c) => c.request_id === id);
  assert.equal(companions.length, 1);
  assert.ok(companions[0].arrived_at);
  assert.equal(generateRideAsCompanion().ok, false, "a host can't also join as companion");
  mock.timers.tick(1000);
  assert.equal(statusOf(id), "accepted");
  rideTo(id);
});

test("generate a ride as host readies Juan's existing draft", () => {
  const id = call("save_pickup_draft", {
    p_request_id: null,
    p_latitude: 13.6229,
    p_longitude: 123.1851,
    p_destination: "Centro",
    p_passengers: 1,
    p_vehicle_type: "Jeepney",
  });
  assert.equal(engine.hostedPickupId(), id);
  assert.equal(generateRideAsHost().ok, true);
  const pickup = db.tables.pickup.find((p) => p.request_id === id)!;
  assert.ok(pickup.route_id && pickup.dropoff_name, "the missing journey is filled in");
  assert.equal(db.tables.request.find((r) => r.request_id === id)!.is_draft, false);
});

test("demo rides tell the pickup screen to reload", () => {
  let reloads = 0;
  const stop = engine.subscribeDemoRides(() => reloads++);
  generateRideAsHost();
  stop();
  generateRideAsHost();
  assert.equal(reloads, 1);
});
