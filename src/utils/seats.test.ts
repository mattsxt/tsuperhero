import assert from "node:assert/strict";
import { test } from "node:test";

import { clampWalkIns, fitsPickup, seatPlan } from "@/utils/seats";

test("19 on board with 1 reserved in a 24-seater stops walk-ins at 23", () => {
  const plan = seatPlan(24, 19, 1);
  assert.equal(plan.walkInLimit, 23);
  assert.equal(plan.open, 4);
  assert.equal(plan.canAddWalkIn, true);
  assert.equal(clampWalkIns(plan, 24), 23, "the driver can't count past capacity minus reserved");

  const atLimit = seatPlan(24, 23, 1);
  assert.equal(atLimit.open, 0);
  assert.equal(atLimit.canAddWalkIn, false);
  assert.equal(atLimit.blockedBy, "reserved");
});

test("boarding the reserved pickup can still fill the vehicle", () => {
  const plan = seatPlan(24, 24, 0);
  assert.equal(plan.blockedBy, "full");
  assert.equal(plan.open, 0);
});

test("pickups only fit in open seats", () => {
  const plan = seatPlan(24, 19, 1);
  assert.equal(fitsPickup(plan, 4), true);
  assert.equal(fitsPickup(plan, 5), false);
  assert.equal(fitsPickup(plan, 0), false);
  assert.equal(fitsPickup(seatPlan(24, 10, 0, true), 1), false, "marked full takes no one");
});

test("marked full blocks walk-ins and opens no seats", () => {
  const plan = seatPlan(24, 10, 2, true);
  assert.equal(plan.blockedBy, "marked-full");
  assert.equal(plan.canAddWalkIn, false);
  assert.equal(plan.open, 0);
});

test("bad or overflowing inputs stay within the vehicle", () => {
  const over = seatPlan(24, 30, 5);
  assert.equal(over.onBoard, 24);
  assert.equal(over.reserved, 0, "no seats left to hold");
  assert.equal(over.open, 0);

  const held = seatPlan(24, 20, 9);
  assert.equal(held.reserved, 4, "reservations can't exceed the free seats");
  assert.equal(held.walkInLimit, 20);
  assert.equal(held.canAddWalkIn, false);

  const junk = seatPlan(Number.NaN, -3, -1);
  assert.deepEqual([junk.capacity, junk.onBoard, junk.reserved, junk.open], [0, 0, 0, 0]);
  assert.equal(clampWalkIns(seatPlan(24, 0, 0), -2), 0);
});
