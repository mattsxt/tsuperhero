import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { signInAs, signOutAll } from "@/simulation/auth";
import { db } from "@/simulation/db";
import * as engine from "@/simulation/engine";
import { handlers } from "@/simulation/rpc";
import { userId, vehicleId } from "@/simulation/seed/people";
import { roadPath } from "@/simulation/seed/roads";
import { distanceToPath, getDistanceMeters, type LatLngPair } from "@/utils/geo";

const call = (name: string, args: unknown = {}) => handlers[name](args) as any;
const idOf = (code: string) => String(db.tables.route.find((r) => r.route_code === code)!.route_id);
const locationOf = (id: string) => db.tables.location_records.find((l) => l.vehicle_id === id);
const pointOf = (row: any) => ({ lat: Number(row.records_latitude), lng: Number(row.records_longitude) });

beforeEach(() => {
  mock.timers.enable({ apis: ["setInterval", "setTimeout", "Date"] });
  db.reset();
  engine.reset();
  signOutAll();
});

afterEach(() => {
  engine.reset();
  signOutAll();
  mock.timers.reset();
});

test("demoJeepneyRoutes lists the six jeepney routes", () => {
  const codes = new Set(engine.demoJeepneyRoutes().map((r) => r.code));
  assert.deepEqual(
    codes,
    new Set(["DEL-CON-DIV-CEN", "DEL-CON-MAG-CEN", "DEL-CON-PAN-CEN", "DIVAB-MAG-CEN", "DIVCD-MAG-CEN", "SFE-FRA-CEN"]),
  );
});

test("chooseDemoRoute moves Mario's jeepney to the start of the chosen route", () => {
  signInAs(userId("mario"), "mario@demo.tsuperhero");
  const route = idOf("SFE-FRA-CEN");
  const path = roadPath(route)! as LatLngPair[];
  assert.equal(engine.chooseDemoRoute(route), true);
  const assignment = call("get_my_vehicle_assignment");
  assert.equal((Array.isArray(assignment) ? assignment[0] : assignment).route_id, route);
  const mario = vehicleId("mario");
  const start = { lat: path[0][0], lng: path[0][1] };
  assert.ok(getDistanceMeters(pointOf(locationOf(mario)), start) < 5);
  call("start_my_trip", { p_distance_total_km: 5 });
  engine.start();
  for (let i = 0; i < 10; i++) mock.timers.tick(1000);
  assert.ok(distanceToPath(pointOf(locationOf(mario)), path) < 8);
});

test("chooseDemoRoute refuses during an active trip and for tricycles", () => {
  signInAs(userId("mario"), "mario@demo.tsuperhero");
  call("start_my_trip", { p_distance_total_km: 5 });
  assert.equal(engine.chooseDemoRoute(idOf("SFE-FRA-CEN")), false);
  signOutAll();
  signInAs(userId("pedro"), "pedro@demo.tsuperhero");
  assert.equal(engine.chooseDemoRoute(idOf("SFE-FRA-CEN")), false);
});
