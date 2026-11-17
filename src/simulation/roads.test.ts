import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { signInAs, signOutAll } from "@/simulation/auth";
import { db } from "@/simulation/db";
import * as engine from "@/simulation/engine";
import { roadGeometry } from "@/simulation/seed/road-geometry.generated";
import { userId } from "@/simulation/seed/people";
import { roadPath } from "@/simulation/seed/roads";
import { distanceToPath, type LatLngPair } from "@/utils/geo";

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

test("roadPath returns baked geometry for every route with a path", () => {
  const withPath = db.tables.route.filter((r) => Array.isArray(r.path) && (r.path as unknown[]).length > 1);
  assert.equal(withPath.length, 6);
  for (const route of withPath) {
    const id = String(route.route_id);
    assert.deepEqual(roadPath(id), roadGeometry[id].path);
    assert.ok(roadPath(id)!.length > (route.path as unknown[]).length, `${route.route_code} has road detail`);
  }
  assert.equal(roadPath("missing-route"), null);
});

test("background vehicles stay on their road path", () => {
  signInAs(userId("juan"), "juan@demo.tsuperhero");
  const off: string[] = [];
  const stop = db.subscribe((event) => {
    if (event.table !== "location_records") return;
    const vehicle = db.tables.vehicle.find((v) => v.vehicle_id === event.row.vehicle_id);
    const trip = db.tables.trip.find((t) => t.vehicle_id === event.row.vehicle_id && t.trip_status === "active");
    const path = roadPath(trip?.route_id ?? vehicle?.route_id);
    if (!path) return;
    const point = { lat: Number(event.row.records_latitude), lng: Number(event.row.records_longitude) };
    const meters = distanceToPath(point, path as LatLngPair[]);
    if (meters >= 8) off.push(`${vehicle?.plate_number}: ${meters.toFixed(1)} m`);
  });
  engine.start();
  for (let i = 0; i < 120; i++) mock.timers.tick(1000);
  stop();
  assert.deepEqual(off.slice(0, 5), []);
});
