import assert from "node:assert/strict";
import { test } from "node:test";

import { actionsFor } from "@/simulation/ui/panel-actions";

test("actionsFor maps actions to the current screen and role", () => {
  assert.deepEqual(actionsFor("/commuter/pickup", "commuter", false), []);
  assert.deepEqual(actionsFor("/commuter/rental", "commuter", false), ["acceptMyRental"]);
  assert.deepEqual(actionsFor("/transit/start-trip", "driver", false), ["sendPickupRequest"]);
  assert.deepEqual(actionsFor("/transit/start-trip", "driver", true), ["sendPickupRequest", "arriveNow"]);
  assert.deepEqual(actionsFor("/transit/rental-requests", "driver", false), ["postRentalRequest", "completeAcceptedRental"]);
  assert.deepEqual(actionsFor("/notifications", "commuter", false), ["generateNotification"]);
  assert.deepEqual(actionsFor("/notifications", "driver", true), ["generateNotification"]);
});

test("actionsFor hides actions for mismatched roles and unknown screens", () => {
  assert.deepEqual(actionsFor("/commuter/pickup", "driver", false), []);
  assert.deepEqual(actionsFor("/unknown", "commuter", false), []);
});
