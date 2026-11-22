import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { signInAs, signOutAll } from "@/simulation/auth";
import { db, type Row } from "@/simulation/db";
import * as engine from "@/simulation/engine";
import {
  clearGeneratedVehicles,
  generateVehicle,
  generatedVehicleCount,
  generatedVehicleSettings,
  loadFor,
  occupancyChoices,
  setViewedRoute,
  updateGeneratedVehicle,
} from "@/simulation/generated-vehicles";
import { handlers } from "@/simulation/rpc";
import { roadPath } from "@/simulation/seed/roads";
import { userId } from "@/simulation/seed/people";
import { distanceToPath, getDistanceMeters } from "@/utils/geo";

const call = (name: string, args: unknown = {}) => handlers[name](args) as any;
const route = (code: string) => String(db.tables.route.find((r) => r.route_code === code)!.route_id);
const vehicleOf = (id: string) => db.tables.vehicle.find((v) => v.vehicle_id === id)!;
const pointOf = (id: string) => {
  const l = db.tables.location_records.find((r) => r.vehicle_id === id)!;
  return { lat: Number(l.records_latitude), lng: Number(l.records_longitude) };
};
const live = (id: string) =>
  (call("get_live_vehicles_with_last_seen") as Row[]).find((v) => v.vehicle_id === id);

beforeEach(() => {
  mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
  db.reset();
  engine.reset();
  signInAs(userId("juan"), "juan@demo.tsuperhero");
});

afterEach(() => {
  setViewedRoute(null);
  engine.reset();
  signOutAll();
  mock.timers.reset();
});

test("a generated jeepney is live on its route, marked generated, and drives along it", () => {
  const routeId = route("SFE-FRA-CEN");
  const result = generateVehicle({ type: "Jeepney", routeId, dynamic: true, occupancy: "Moderate" });
  assert.ok(result.ok);
  const row = live(result.vehicleId);
  assert.ok(row, "shows as a live vehicle");
  assert.equal(row.is_generated, true);
  assert.equal(row.route_id, routeId);
  const before = pointOf(result.vehicleId);
  engine.start();
  mock.timers.tick(5000);
  const after = pointOf(result.vehicleId);
  assert.ok(getDistanceMeters(before, after) > 10, "it moves");
  assert.ok(distanceToPath(after, roadPath(routeId)!) < 5, "on its route");
});

test("a jeepney needs a route", () => {
  assert.equal(generateVehicle({ type: "Jeepney", dynamic: true, occupancy: "Available" }).ok, false);
});

test("a generated tricycle starts near the commuter on the viewed route and keeps moving there", () => {
  const routeId = route("DEL-CON-MAG-CEN");
  setViewedRoute(routeId);
  const result = generateVehicle({ type: "Tricycle", dynamic: true, occupancy: "Available" });
  assert.ok(result.ok);
  const juan = engine.userFix(userId("juan"));
  const start = pointOf(result.vehicleId);
  assert.ok(distanceToPath(start, roadPath(routeId)!) < 5, "on the viewed route");
  assert.ok(getDistanceMeters(start, juan) < 1_500, "in the commuter's vicinity");
  engine.start();
  mock.timers.tick(5000);
  assert.ok(getDistanceMeters(start, pointOf(result.vehicleId)) > 10, "it moves");
});

test("static occupancy never changes; dynamic occupancy does", () => {
  const routeId = route("DEL-CON-PAN-CEN");
  const fixed = generateVehicle({ type: "Jeepney", routeId, dynamic: false, occupancy: "Almost Full" });
  const moving = generateVehicle({ type: "Jeepney", routeId, dynamic: true, occupancy: "Almost Full" });
  assert.ok(fixed.ok && moving.ok);
  const fixedLoad = vehicleOf(fixed.vehicleId).current_capacity;
  const seen = new Set<number>();
  const statuses = new Set<string>();
  engine.start();
  for (let i = 0; i < 180; i++) {
    mock.timers.tick(1000);
    assert.equal(vehicleOf(fixed.vehicleId).current_capacity, fixedLoad);
    assert.equal(vehicleOf(fixed.vehicleId).vehicle_status, "on-trip");
    seen.add(Number(vehicleOf(moving.vehicleId).current_capacity));
    statuses.add(String(vehicleOf(moving.vehicleId).vehicle_status));
  }
  assert.ok(seen.size > 1, "dynamic load changes");
  assert.deepEqual(statuses, new Set(["on-trip", "loading"]), "dynamic vehicles stop to load");
});

test("starting occupancy maps to that level, and impossible levels are not offered", () => {
  assert.equal(loadFor("Full", 4), 4);
  assert.equal(loadFor("Almost Full", 4), null);
  assert.deepEqual(occupancyChoices("Tricycle"), ["Available", "Moderate", "Full"]);
  assert.deepEqual(occupancyChoices("Jeepney"), ["Available", "Moderate", "Almost Full", "Full"]);
  const result = generateVehicle({ type: "Tricycle", dynamic: false, occupancy: "Full" });
  assert.ok(result.ok);
  assert.equal(vehicleOf(result.vehicleId).is_full, true);
});

test("controls hold a generated vehicle at Loading/Unloading and release it", () => {
  const result = generateVehicle({ type: "Jeepney", routeId: route("DIVAB-MAG-CEN"), dynamic: false, occupancy: "Available" });
  assert.ok(result.ok);
  engine.start();
  mock.timers.tick(2000);
  assert.ok(updateGeneratedVehicle(result.vehicleId, { status: "loading", dynamic: false, occupancy: "Moderate" }).ok);
  assert.deepEqual(generatedVehicleSettings(result.vehicleId), {
    type: "Jeepney",
    plate: result.plate,
    status: "loading",
    dynamic: false,
    occupancy: "Moderate",
  });
  const held = pointOf(result.vehicleId);
  mock.timers.tick(10_000);
  assert.ok(getDistanceMeters(held, pointOf(result.vehicleId)) < 1, "stays put");
  assert.equal(live(result.vehicleId).vehicle_status, "loading");
  updateGeneratedVehicle(result.vehicleId, { status: "on-trip", dynamic: false, occupancy: "Moderate" });
  mock.timers.tick(3000);
  assert.ok(getDistanceMeters(held, pointOf(result.vehicleId)) > 10, "drives on");
  assert.equal(live(result.vehicleId).vehicle_status, "on-trip");
});

test("seeded vehicles are not generated and have no controls", () => {
  const seeded = String(db.tables.vehicle[0].vehicle_id);
  assert.equal(generatedVehicleSettings(seeded), null);
  assert.equal(updateGeneratedVehicle(seeded, { status: "loading", dynamic: true, occupancy: "Full" }).ok, false);
});

test("clear removes every generated vehicle on every route and nothing else", () => {
  const seededCount = db.tables.vehicle.length;
  generateVehicle({ type: "Jeepney", routeId: route("SFE-FRA-CEN"), dynamic: true, occupancy: "Available" });
  generateVehicle({ type: "Jeepney", routeId: route("DIVCD-MAG-CEN"), dynamic: false, occupancy: "Full" });
  generateVehicle({ type: "Tricycle", dynamic: true, occupancy: "Moderate" });
  engine.start();
  mock.timers.tick(3000);
  assert.equal(generatedVehicleCount(), 3);
  assert.equal(clearGeneratedVehicles(), 3);
  assert.equal(generatedVehicleCount(), 0);
  assert.equal(db.tables.vehicle.length, seededCount);
  assert.ok(!(call("get_live_vehicles_with_last_seen") as Row[]).some((v) => v.is_generated));
  mock.timers.tick(3000);
  assert.equal(clearGeneratedVehicles(), 0);
});

test("some background vehicles stay lightly loaded and some stop to load and unload", () => {
  engine.start();
  const light = db.tables.vehicle.filter((v) => Array.isArray(v.occupancy_band));
  assert.ok(light.length >= 3);
  const loadingSeen = new Set<string>();
  for (let i = 0; i < 240; i++) {
    mock.timers.tick(1000);
    for (const v of light)
      assert.ok(Number(v.current_capacity) / Number(v.max_capacity) < 0.5, `${v.plate_number} stays Available`);
    for (const v of call("get_live_vehicles_with_last_seen") as Row[])
      if (v.vehicle_status === "loading") loadingSeen.add(String(v.vehicle_id));
  }
  assert.ok(loadingSeen.size >= 5, "several vehicles were seen loading/unloading");
});

test("a vehicle never jumps between ticks, even after finishing a pickup off its path", () => {
  const last = new Map<string, { lat: number; lng: number }>();
  const jumps: string[] = [];
  engine.start();
  engine.setSpeed(10);
  const trike = db.tables.vehicle.find((v) => v.plate_number === "TRC 216")!;
  const loc = db.tables.location_records.find((l) => l.vehicle_id === trike.vehicle_id)!;
  mock.timers.tick(1000);
  engine.forgetVehicles([String(trike.vehicle_id)]);
  loc.records_latitude = Number(loc.records_latitude) + 0.004;
  for (let i = 0; i < 300; i++) {
    mock.timers.tick(1000);
    for (const l of db.tables.location_records) {
      const id = String(l.vehicle_id);
      const p = { lat: Number(l.records_latitude), lng: Number(l.records_longitude) };
      const prev = last.get(id);
      if (prev && getDistanceMeters(prev, p) > 60) jumps.push(`${id} ${getDistanceMeters(prev, p).toFixed(0)}m`);
      last.set(id, p);
    }
  }
  assert.deepEqual(jumps, []);
});
