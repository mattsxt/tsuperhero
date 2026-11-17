import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { signInAs, signOutAll } from "@/simulation/auth";
import { db } from "@/simulation/db";
import * as engine from "@/simulation/engine";
import { handlers } from "@/simulation/rpc";
import { userId, vehicleId } from "@/simulation/seed/people";

const call = (name: string, args: unknown = {}) => handlers[name](args) as any;

const level = (current: number, max: number) => {
  const ratio = current / max;
  if (ratio >= 1) return "Full";
  if (ratio >= 0.8) return "Almost Full";
  if (ratio >= 0.5) return "Moderate";
  return "Available";
};

beforeEach(() => {
  mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  db.reset();
  engine.reset();
  signOutAll();
});

afterEach(() => {
  engine.reset();
  signOutAll();
  mock.timers.reset();
});

test("background occupancy cycles through every level", () => {
  signInAs(userId("juan"), "juan@demo.tsuperhero");
  engine.start();
  const seen = new Set<string>();
  const bad: string[] = [];
  for (let i = 0; i < 240; i++) {
    mock.timers.tick(1000);
    const row = (call("get_live_vehicles_with_last_seen") as any[]).find((v) => v.plate_number === "DEMO 103");
    assert.ok(row, "DEMO 103 is live");
    const current = Number(row.current_capacity);
    const max = Number(row.max_capacity);
    if (current < 0 || current > max) bad.push(`${current}/${max}`);
    seen.add(level(current, max));
  }
  assert.deepEqual(bad, []);
  assert.deepEqual(seen, new Set(["Available", "Moderate", "Almost Full", "Full"]));
});

test("the signed-in driver's own load is never changed by the engine", () => {
  signInAs(userId("mario"), "mario@demo.tsuperhero");
  call("start_my_trip", { p_distance_total_km: 5 });
  engine.start();
  const mario = db.tables.vehicle.find((v) => v.vehicle_id === vehicleId("mario"))!;
  for (let i = 0; i < 120; i++) {
    mock.timers.tick(1000);
    assert.equal(Number(mario.current_capacity ?? 0), 0);
  }
});
