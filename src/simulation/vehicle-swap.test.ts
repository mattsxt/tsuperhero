import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { currentUserId, signInAs, signOutAll } from "@/simulation/auth";
import { db } from "@/simulation/db";
import * as engine from "@/simulation/engine";
import { handlers } from "@/simulation/rpc";
import { driverId, userId, vehicleId } from "@/simulation/seed/people";
import { myVehicleType, swapDemoVehicle } from "@/simulation/vehicle-swap";

const call = (name: string, args: unknown = {}) => handlers[name](args) as any;
const as = (key: string) => {
  signOutAll();
  signInAs(userId(key), `${key}@demo.tsuperhero`);
};

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

const vehicleOfDriver = (key: string) =>
  db.tables.driver.find((d) => d.driver_id === driverId(key))?.vehicle_id;

test("switching vehicle type keeps the driver signed in and swaps the vehicles", () => {
  as("mario");
  const signedIn = currentUserId();
  assert.equal(myVehicleType(), "Jeepney");
  const ratingsBefore = call("get_my_ratings").count;

  const result = swapDemoVehicle();
  assert.deepEqual(result, { ok: true, message: "Now driving a tricycle" });
  assert.equal(currentUserId(), signedIn, "still the same signed-in driver");
  assert.equal(myVehicleType(), "Tricycle");
  assert.equal(vehicleOfDriver("mario"), vehicleId("pedro"));
  assert.equal(vehicleOfDriver("pedro"), vehicleId("mario"), "the other driver takes the old vehicle");
  assert.equal(call("get_my_vehicle_assignment").vehicle.vehicle_type, "Tricycle");
  assert.equal(call("get_my_ratings").count, ratingsBefore, "ratings stay with the driver");

  assert.equal(swapDemoVehicle().message, "Now driving a jeepney");
  assert.equal(myVehicleType(), "Jeepney");
  assert.equal(vehicleOfDriver("mario"), vehicleId("mario"));
});

test("a tricycle trip works after switching, and the switch waits for trips to end", () => {
  as("mario");
  swapDemoVehicle();
  call("start_my_trip", { p_distance_total_km: 3 });
  assert.deepEqual(swapDemoVehicle(), { ok: false, message: "End the trip first" });
  engine.start();
  mock.timers.tick(1000);
  assert.equal(engine.sendPickupRequest(), true, "the tricycle trip gets demo requests");
});

test("commuters can't switch vehicle type", () => {
  as("juan");
  assert.equal(myVehicleType(), null);
  assert.equal(swapDemoVehicle().ok, false);
});
