import assert from "node:assert/strict";
import { test } from "node:test";

import { db } from "@/simulation/db";

const find = (table: keyof typeof db.tables, key: string, value: unknown) =>
  db.tables[table].find((r) => r[key] === value);

test("reset restores the seed after mutation", () => {
  db.reset();
  const before = db.tables.user.length;
  db.tables.user.push({ user_id: "x", user_email: "x@x" });
  db.tables.vehicle.length = 0;
  db.reset();
  assert.equal(db.tables.user.length, before);
  assert.ok(db.tables.vehicle.length >= 5);
});

test("seed contains accounts and vehicles", () => {
  db.reset();
  for (const email of [
    "juan@demo.tsuperhero",
    "ana@demo.tsuperhero",
    "mario@demo.tsuperhero",
    "pedro@demo.tsuperhero",
  ]) {
    assert.ok(find("user", "user_email", email), email);
  }
  const mario = find("vehicle", "plate_number", "DEMO 101");
  const pedro = find("vehicle", "plate_number", "TRC 202");
  assert.equal(mario?.max_capacity, 24);
  assert.equal(pedro?.max_capacity, 4);
  assert.equal(mario?.vehicle_type, "Jeepney");
  assert.equal(pedro?.vehicle_type, "Tricycle");
  const route = find("route", "route_id", mario?.route_id);
  assert.match(String(route?.route_name).toLowerCase(), /del rosario . concepcion . magsaysay . centro/);
});

test("seed history", () => {
  db.reset();
  const juan = find("user", "user_email", "juan@demo.tsuperhero");
  const commuter = find("commuter", "user_id", juan?.user_id);
  const requests = db.tables.request.filter((r) => r.commuter_id === commuter?.commuter_id);
  const pickups = requests.filter((r) => r.request_type === "Pickup" && r.request_status === "completed");
  assert.equal(pickups.length, 3);
  for (const r of pickups) {
    const p = db.tables.pickup.find((x) => x.request_id === r.request_id);
    assert.ok(p?.boarded_at && p?.dropped_at);
  }
  assert.equal(
    requests.filter((r) => r.request_type === "Charter_Rental" && r.request_status === "completed").length,
    1,
  );

  const mario = find("user", "user_email", "mario@demo.tsuperhero");
  const personnel = find("transit_personnel", "user_id", mario?.user_id);
  const driver = find("driver", "personnel_id", personnel?.personnel_id);
  assert.equal(db.tables.trip.filter((t) => t.driver_id === driver?.driver_id && t.trip_status === "completed").length, 4);
  const ratings = db.tables.rating.filter((r) => r.driver_id === driver?.driver_id);
  assert.equal(ratings.length, 5);
  const avg = ratings.reduce((s, r) => s + Number(r.score), 0) / 5;
  assert.ok(Math.abs(avg - 4.6) < 0.001);
  assert.equal(ratings.filter((r) => r.feedback).length, 2);

  const bg = db.tables.vehicle.filter((v) => v.plate_number !== "DEMO 101" && v.plate_number !== "TRC 202");
  assert.ok(bg.every((v) => v.vehicle_status === "on-trip"));
  for (const route of db.tables.route.filter((r) => Array.isArray(r.path))) {
    const jeepneys = db.tables.vehicle.filter(
      (v) => v.vehicle_type === "Jeepney" && v.route_id === route.route_id,
    );
    assert.ok(jeepneys.length >= 1, String(route.route_code));
  }
  assert.ok(bg.filter((v) => v.vehicle_type === "Jeepney").length >= 10);
  assert.ok(bg.filter((v) => v.vehicle_type === "Tricycle").length >= 5);
  assert.equal(new Set(db.tables.vehicle.map((v) => v.plate_number)).size, db.tables.vehicle.length);
  for (const vehicle of db.tables.vehicle) {
    const driver = db.tables.driver.find((d) => d.vehicle_id === vehicle.vehicle_id);
    assert.ok(driver, String(vehicle.plate_number));
    assert.equal(driver.driver_type, vehicle.vehicle_type);
  }
  assert.ok(db.tables.commuter.length >= 12);
  const open = db.tables.request.filter(
    (r) => r.request_type === "Charter_Rental" && r.driver_id == null && r.request_status === "pending",
  );
  assert.equal(open.length, 2);
  assert.ok(db.tables.waiting_area.every((w) => w.request_radius_m === 100));
});

test("subscribe receives emitted events", () => {
  const seen: unknown[] = [];
  const off = db.subscribe((e) => seen.push(e));
  db.emit({ table: "user", type: "INSERT", row: { a: 1 } });
  off();
  db.emit({ table: "user", type: "INSERT", row: { a: 2 } });
  assert.equal(seen.length, 1);
  assert.notEqual(db.id(), db.id());
});
