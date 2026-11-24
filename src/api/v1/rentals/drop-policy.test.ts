import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cancelReasons,
  dropOutcomeMessage,
  dropWarning,
  formatWait,
  maxCancelDetailsLength,
  penaltyForDrop,
  reasonLabel,
  reasonProblem,
} from "@/api/v1/rentals/drop-policy";

test("drops escalate: warning, 15 min, 30 min, then suspended", () => {
  assert.deepEqual(penaltyForDrop(1), { kind: "warning" });
  assert.deepEqual(penaltyForDrop(2), { kind: "cooldown", minutes: 15 });
  assert.deepEqual(penaltyForDrop(3), { kind: "cooldown", minutes: 30 });
  assert.deepEqual(penaltyForDrop(4), { kind: "suspended" });
  assert.deepEqual(penaltyForDrop(9), { kind: "suspended" });
});

test("a reason is required, and other needs details", () => {
  assert.equal(reasonProblem("driver", null, ""), "Choose a reason for dropping this job.");
  assert.equal(reasonProblem("commuter", null, ""), "Choose a reason for removing this driver.");
  assert.equal(reasonProblem("driver", "safety_concern", ""), "Choose one of the listed reasons.");
  assert.equal(reasonProblem("commuter", "vehicle_problem", ""), "Choose one of the listed reasons.");
  assert.match(reasonProblem("driver", "other", "   ") ?? "", /Add a few words/);
  assert.equal(reasonProblem("driver", "other", "Flat tire"), null);
  assert.equal(reasonProblem("commuter", "plans_changed", ""), null);
  assert.match(
    reasonProblem("driver", "vehicle_problem", "x".repeat(maxCancelDetailsLength + 1)) ?? "",
    /under 300/,
  );
});

test("both sides offer a way out with other, and labels match the database", () => {
  for (const reasons of Object.values(cancelReasons)) {
    assert.equal(reasons.at(-1)?.code, "other");
  }
  assert.equal(reasonLabel("commuter_unreachable"), "Can't reach the commuter");
  assert.equal(reasonLabel("driver_unresponsive"), "Driver isn't responding");
  assert.equal(reasonLabel("other"), "Other reason");
});

test("the warning tells the driver what this drop costs", () => {
  const first = dropWarning(penaltyForDrop(1), 0);
  assert.equal(first.tone, "info");
  assert.match(first.text, /first drop/);
  const second = dropWarning(penaltyForDrop(2), 1);
  assert.equal(second.tone, "warning");
  assert.match(second.text, /dropped 1 job .*15 minutes/);
  const fourth = dropWarning(penaltyForDrop(4), 3);
  assert.equal(fourth.tone, "danger");
  assert.match(fourth.text, /cooperative head/);
});

test("outcomes and waits read naturally", () => {
  assert.equal(
    dropOutcomeMessage({ kind: "cooldown", minutes: 30 }),
    "Job dropped. You can accept another job in 30 minutes.",
  );
  assert.equal(formatWait(10_000), "1 minute");
  assert.equal(formatWait(15 * 60_000 + 12_000), "15 minutes");
  assert.equal(formatWait(14 * 60_000 + 40_000), "15 minutes");
  assert.equal(formatWait(90 * 60_000), "1 hr 30 min");
});
