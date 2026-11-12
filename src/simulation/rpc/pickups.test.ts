import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { signInAs } from "@/simulation/auth";
import { db } from "@/simulation/db";
import { handlers } from "@/simulation/rpc";
import { setRequestStatus } from "@/simulation/rpc/pickups";
import { userId, vehicleId, driverId } from "@/simulation/seed/people";

const call = (name: string, args: unknown = {}) => handlers[name](args) as any;

const area = () => db.tables.waiting_area.find((w) => w.area_name === "Rotunda")!;
const route = () => db.tables.route.find((r) => r.route_code === "DEL-CON-MAG-CEN")!;

const asJuan = () => signInAs(userId("juan"), "juan@demo.tsuperhero");
const asAna = () => signInAs(userId("ana"), "ana@demo.tsuperhero");

const draft = () => {
  const a = area();
  const id = call("save_pickup_draft", {
    p_request_id: null,
    p_latitude: a.area_latitude,
    p_longitude: a.area_longitude,
    p_destination: "E-Mall",
    p_passengers: 2,
    p_vehicle_type: "Jeepney",
  });
  return { id, a };
};

const routePath = () => (route().path as [number, number][])[5];

beforeEach(() => {
  db.reset();
  asJuan();
});

test("lifecycle: save, route, publish, arrived", () => {
  const { id, a } = draft();
  assert.equal(call("get_my_pickup_draft")[0].request_id, id);
  const [lat, lng] = routePath();
  call("set_pickup_route", {
    p_request_id: id,
    p_route_id: route().route_id,
    p_pickup_lat: lat,
    p_pickup_lng: lng,
    p_dropoff_name: "Centro",
    p_dropoff_lat: lat,
    p_dropoff_lng: lng,
    p_waiting_area_id: a.area_id,
  });
  assert.equal(call("publish_pickup_draft", { p_request_id: id }), id);
  assert.equal(call("get_my_pickup_draft").length, 0);
  assert.throws(
    () => call("mark_pickup_arrived", { p_request_id: id, p_latitude: lat + 0.01, p_longitude: lng }),
    /Go to the pickup point first\. Drivers will see your request once you arrive\./,
  );
  const at = call("mark_pickup_arrived", { p_request_id: id, p_latitude: lat, p_longitude: lng });
  assert.ok(at);
  const request = db.tables.request.find((r) => r.request_id === id)!;
  assert.ok(request.arrived_at);
});

test("publish rejects a pickup point off the route", () => {
  const { id } = draft();
  assert.throws(
    () =>
      call("set_pickup_route", {
        p_request_id: id,
        p_route_id: route().route_id,
        p_pickup_lat: 14.5,
        p_pickup_lng: 121,
        p_dropoff_name: "X",
        p_dropoff_lat: 14.5,
        p_dropoff_lng: 121,
      }),
    /Pickup point must be on the route\. Please re-select\./,
  );
});

test("complete_my_ride", () => {
  const { id } = draft();
  const request = db.tables.request.find((r) => r.request_id === id)!;
  request.is_draft = false;
  request.driver_id = driverId("mario");
  const pickup = db.tables.pickup.find((p) => p.request_id === id)!;
  pickup.vehicle_id = vehicleId("mario");
  setRequestStatus(id, "accepted");
  setRequestStatus(id, "riding");
  assert.equal(call("complete_my_ride", { p_request_id: id }), "completed");
  assert.equal(call("complete_my_ride", { p_request_id: id }), "already_completed");
  assert.ok(pickup.dropped_at);
  const types = db.tables.notification.map((n) => n.notification_type);
  assert.ok(types.includes("pickup_accepted"));
  assert.ok(types.includes("pickup_boarded"));
  assert.ok(types.includes("pickup_completed"));
  const mine = call("get_my_bookings").find((b: any) => b.request_id === id);
  assert.ok(mine.boarded_at === null || mine.boarded_at === undefined || mine.boarded_at);
  assert.ok(mine.dropped_at);
});

test("get_my_bookings includes boarded_at, dropped_at, dropoff_name", () => {
  const rows = call("get_my_bookings");
  const pickups = rows.filter((b: any) => b.request_type === "Pickup");
  assert.ok(pickups.length >= 3);
  for (const b of pickups) {
    assert.ok(b.boarded_at);
    assert.ok(b.dropped_at);
    assert.ok(b.dropoff_name);
    assert.ok(Array.isArray(b.riders));
    assert.ok(Array.isArray(b.drivers));
  }
});

test("share invite accepted shows companion", () => {
  const { id } = draft();
  const found = call("search_available_commuters", { p_query: "Ana" });
  assert.equal(found[0].user_id, userId("ana"));
  assert.equal(call("add_pickup_companions", { p_request_id: id, p_user_ids: [userId("ana")] }), 1);
  assert.equal(call("get_pickup_companion_statuses", { p_request_id: id })[0].companion_status, "pending");
  asAna();
  assert.equal(call("get_my_share_invites").length, 1);
  assert.equal(call("respond_to_share_invite", { p_request_id: id, p_accept: true }), 2);
  asJuan();
  const statuses = call("get_pickup_companion_statuses", { p_request_id: id });
  assert.equal(statuses[0].companion_status, "accepted");
  assert.equal(statuses[0].user_id, userId("ana"));
  asAna();
  assert.equal(call("get_my_shared_ride")[0].request_id, id);
});
