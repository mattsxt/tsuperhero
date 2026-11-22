import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { signInAs, signOutAll } from "@/simulation/auth";
import { db } from "@/simulation/db";
import { generateRideAsCompanion, generateRideAsHost } from "@/simulation/demo-rides";
import * as engine from "@/simulation/engine";
import { handlers } from "@/simulation/rpc";
import { userId } from "@/simulation/seed/people";

const call = (name: string, args: unknown = {}) => handlers[name](args) as any;

beforeEach(() => {
  mock.timers.enable({ apis: ["setInterval", "setTimeout", "Date"], now: Date.now() });
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

test("a companion sees the host's live location and the matched driver", () => {
  assert.equal(generateRideAsCompanion().ok, true);
  const id = engine.sharedRideId()!;
  engine.start();
  mock.timers.tick(2000);
  const party = call("get_ride_party", { p_request_id: id }) as any[];
  const host = party.find((rider) => rider.is_owner);
  assert.ok(host, "the host is in the party");
  assert.equal(typeof host.latitude, "number");
  assert.equal(typeof host.longitude, "number");
  assert.ok(engine.sharedRideId());
  const status = db.tables.request.find((r) => r.request_id === id)!.request_status;
  assert.equal(status, "accepted");
  const driver = call("get_my_pickup_driver");
  assert.ok(driver, "the companion gets the matched driver");
  assert.equal(driver.request_id, id);
  assert.ok(driver.location, "with the vehicle's location");
});

test("the host sees companions' locations once they share them", () => {
  assert.equal(generateRideAsHost().ok, true);
  const id = engine.hostedPickupId()!;
  engine.start();
  mock.timers.tick(2000);
  const [companion] = call("get_pickup_companion_statuses", { p_request_id: id }) as any[];
  assert.ok(companion);
  assert.equal(companion.companion_status, "accepted");
  assert.equal(typeof companion.latitude, "number", "simulated companions share their position");
});

test("a shared location goes stale after two minutes", () => {
  assert.equal(generateRideAsHost().ok, true);
  const id = engine.hostedPickupId()!;
  call("share_ride_location", { p_request_id: id, p_latitude: 13.62, p_longitude: 123.19 });
  const request = db.tables.request.find((r) => r.request_id === id)!;
  assert.equal(request.owner_latitude, 13.62);
  const companion = db.tables.pickup_companion.find((c) => c.request_id === id)!;
  companion.location_at = new Date(Date.now() - 3 * 60_000).toISOString();
  const [row] = call("get_pickup_companion_statuses", { p_request_id: id }) as any[];
  assert.equal(row.latitude, null);
  assert.equal(row.longitude, null);
});

test("only party members can share into a ride", () => {
  assert.equal(generateRideAsHost().ok, true);
  const id = engine.hostedPickupId()!;
  const request = db.tables.request.find((r) => r.request_id === id)!;
  const members = new Set([
    request.commuter_id,
    ...db.tables.pickup_companion.filter((c) => c.request_id === id).map((c) => c.commuter_id),
  ]);
  const outsider = db.tables.commuter.find((c) => !members.has(c.commuter_id))!;
  signInAs(String(outsider.user_id), "outsider@demo.tsuperhero");
  call("share_ride_location", { p_request_id: id, p_latitude: 1, p_longitude: 1 });
  assert.notEqual(request.owner_latitude, 1);
  assert.ok(
    !db.tables.pickup_companion.some((c) => c.request_id === id && c.last_latitude === 1),
  );
  assert.throws(() =>
    call("share_ride_location", { p_request_id: id, p_latitude: 200, p_longitude: 1 }),
  );
});
