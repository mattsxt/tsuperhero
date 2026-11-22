import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { signInAs, signOutAll } from "@/simulation/auth";
import { db } from "@/simulation/db";
import * as engine from "@/simulation/engine";
import {
  acceptMyRentalNow,
  completeAcceptedRentalNow,
  hasCompletedRentalJobs,
  hasOpenRentalForMe,
  postRentalRequestNow,
  rateCompletedRentalNow,
} from "@/simulation/rentals-sim";
import { handlers } from "@/simulation/rpc";
import { userId } from "@/simulation/seed/people";

const call = (name: string, args: unknown = {}) => handlers[name](args) as any;
const as = (key: string) => {
  signOutAll();
  signInAs(userId(key), `${key}@demo.tsuperhero`);
};
const post = (vehicles: string[]) =>
  call("post_charter_rental", {
    p_vehicles: vehicles,
    p_pickup_location: "Centro, Naga City",
    p_pickup_latitude: 13.62,
    p_pickup_longitude: 123.18,
    p_destination: "Mayon View",
    p_destination_latitude: 13.2,
    p_destination_longitude: 123.7,
    p_pickup_time: new Date(Date.now() + 2 * 86400_000).toISOString(),
    p_trip_type: "one_way",
    p_return_time: null,
    p_purpose: "Family outing",
    p_passengers: 10,
    p_notes: null,
  });
const tick = (seconds: number) => {
  for (let i = 0; i < seconds; i++) mock.timers.tick(1000);
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

test("simulated drivers book a commuter's posted rental", () => {
  as("juan");
  const id = post(["Jeepney", "Jeepney"]);
  engine.start();
  tick(20);
  const rental = call("get_my_rental", { p_request_id: id });
  const units = db.tables.charter_rental_unit.filter((u) => u.request_id === id);
  assert.equal(units.length, 2);
  assert.ok(units.every((u) => u.status === "booked"), JSON.stringify(units.map((u) => u.status)));
  assert.notEqual(units[0].driver_id, units[1].driver_id);
  assert.equal(rental.status, "accepted");
  assert.equal(hasOpenRentalForMe(), false);
});

test("acceptMyRentalNow books every open unit immediately", () => {
  as("juan");
  const id = post(["Jeepney", "Jeepney"]);
  assert.equal(hasOpenRentalForMe(), true);
  assert.equal(acceptMyRentalNow(), 2);
  assert.ok(db.tables.charter_rental_unit.filter((u) => u.request_id === id).every((u) => u.status === "booked"));
  assert.equal(acceptMyRentalNow(), 0);
});

test("mock commuters post rental jobs for the signed-in driver", () => {
  as("mario");
  const before = new Set(call("get_rental_job_board").map((j: any) => j.request_id));
  engine.start();
  tick(90);
  const fresh = call("get_rental_job_board").filter((j: any) => !before.has(j.request_id));
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].unit_vehicle_type, "Jeepney");
  tick(600);
  const open = call("get_rental_job_board").filter((j: any) => !before.has(j.request_id));
  assert.ok(open.length <= 3, String(open.length));
});

test("postRentalRequestNow adds a job right away", () => {
  as("mario");
  const id = postRentalRequestNow();
  assert.ok(id);
  assert.ok(call("get_rental_job_board").some((j: any) => j.request_id === id));
});

test("completeAcceptedRentalNow completes the driver's earliest accepted rental", () => {
  as("mario");
  assert.equal(completeAcceptedRentalNow(), false);
  const id = postRentalRequestNow()!;
  const job = call("get_rental_job_board").find((j: any) => j.request_id === id);
  call("accept_rental_job", { p_unit_id: job.unit_id });
  assert.equal(completeAcceptedRentalNow(), true);
  assert.equal(db.tables.request.find((r) => r.request_id === id)!.request_status, "completed");
  assert.ok(
    db.tables.notification.some(
      (n) => n.user_id === userId("mario") && n.notification_type === "rental_job_completed",
    ),
  );
});

test("generate ratings only applies to a driver's completed rental jobs", () => {
  as("carla");
  assert.equal(hasCompletedRentalJobs(), false, "no completed jobs, so the action is hidden");
  assert.equal(rateCompletedRentalNow(), null);

  as("pedro");
  assert.equal(hasCompletedRentalJobs(), true, "the tricycle driver has completed jobs too");
  assert.ok([4, 5].includes(rateCompletedRentalNow()!));
  assert.ok([4, 5].includes(rateCompletedRentalNow()!));
  assert.equal(rateCompletedRentalNow(), null, "both tricycle jobs are now rated");

  as("mario");
  assert.equal(hasCompletedRentalJobs(), true);
  const marioDriver = db.tables.driver.find(
    (d) =>
      d.personnel_id ===
      db.tables.transit_personnel.find((p) => p.user_id === userId("mario"))?.personnel_id,
  )!;
  const unrated = () =>
    db.tables.charter_rental_unit.filter(
      (u) =>
        u.status === "completed" &&
        u.driver_id === marioDriver.driver_id &&
        !db.tables.rating.some((r) => r.request_id === u.request_id && r.driver_id === u.driver_id),
    ).length;
  const before = db.tables.rating.length;
  const left = unrated();
  for (let i = 0; i < left; i++) {
    const score = rateCompletedRentalNow();
    assert.ok(score === 4 || score === 5);
  }
  assert.equal(db.tables.rating.length, before + left, "one rating per completed job");
  assert.equal(unrated(), 0);
  assert.equal(rateCompletedRentalNow(), null, "every job is already rated");
  assert.ok(
    db.tables.notification.some(
      (n) => n.user_id === userId("mario") && n.notification_type === "rating_received",
    ),
  );
});
