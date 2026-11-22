import { currentUserId } from "@/simulation/auth";
import { db, type Row } from "@/simulation/db";
import { planSharedJourney, sendPickupRequest, userFix } from "@/simulation/engine";
import {
  acceptMyRentalNow,
  hasOpenRentalForMe,
  postRentalRequestNow,
} from "@/simulation/rentals-sim";
import { notify } from "@/simulation/rpc/notify";
import { hasActivePickup, hasActiveRental } from "@/simulation/rpc/rentals";
import { getDistanceMeters } from "@/utils/geo";

export type GenerateResult = { ok: true; type: string } | { ok: false; reason: string };

const NOTHING = "Nothing to notify about right now. Try another screen first.";
const feedback = [
  "Smooth ride and very polite driver.",
  "Arrived on time. Thank you!",
  "Safe driving, clean jeepney.",
  null,
];

const iso = () => db.now().toISOString();
const me = () => currentUserId();
const myCommuter = () => db.tables.commuter.find((c) => c.user_id === me());
const myPersonnel = () => db.tables.transit_personnel.find((p) => p.user_id === me());
const myDrivers = () => {
  const personnel = myPersonnel();
  return personnel ? db.tables.driver.filter((d) => d.personnel_id === personnel.personnel_id) : [];
};
const profileOf = (userId: unknown) => db.tables.profile.find((p) => p.user_id === userId);
const fullName = (userId: unknown) =>
  [profileOf(userId)?.first_name, profileOf(userId)?.last_name].filter(Boolean).join(" ") || "A commuter";
const insert = (table: "request" | "pickup" | "pickup_companion" | "charter_rental" | "charter_rental_unit" | "rating", row: Row) => {
  db.tables[table].push(row);
  db.emit({ table, type: "INSERT", row });
};
const generatedCount = () =>
  db.tables.notification.filter((n) => n.user_id === me() && (n.data as Row | null)?.generated === true).length;
const rotation = { commuter: 0, driver: 0 };
let lastNotificationCount = db.tables.notification.length;

const tagNewNotifications = (before: number, type: string): boolean => {
  const fresh = db.tables.notification
    .slice(before)
    .filter((n) => n.user_id === me() && n.notification_type === type);
  for (const n of fresh) n.data = { ...((n.data as Row | null) ?? {}), generated: true };
  return fresh.length > 0;
};

const freeCommuters = (): Row[] =>
  db.tables.commuter.filter(
    (c) =>
      c.user_id !== me() &&
      !hasActivePickup(c.commuter_id) &&
      !hasActiveRental(c.commuter_id) &&
      !db.tables.pickup_companion.some(
        (p) =>
          p.commuter_id === c.commuter_id &&
          ["pending", "accepted"].includes(String(p.companion_status)),
      ),
  );

export const inviteToSharedRide = (): string | null => {
  const mine = myCommuter();
  if (!mine || hasActivePickup(mine.commuter_id)) return null;
  const invited = db.tables.pickup_companion.some((c) => {
    const request = db.tables.request.find((r) => r.request_id === c.request_id);
    return (
      c.commuter_id === mine.commuter_id &&
      c.companion_status === "pending" &&
      ["pending", "accepted"].includes(String(request?.request_status))
    );
  });
  if (invited) return null;
  const owners = freeCommuters();
  if (!owners.length) return null;
  const owner = owners[generatedCount() % owners.length];
  const here = userFix(me());
  const journey = planSharedJourney([here.lat, here.lng]);
  const area =
    journey?.from ??
    [...db.tables.waiting_area]
      .filter((w) => w.is_active)
      .sort(
        (a, b) =>
          getDistanceMeters(here, { lat: Number(a.area_latitude), lng: Number(a.area_longitude) }) -
          getDistanceMeters(here, { lat: Number(b.area_latitude), lng: Number(b.area_longitude) }),
      )[0];
  if (!area) return null;
  const fellow = owners.find((c) => c.commuter_id !== owner.commuter_id) ?? null;
  const requestId = db.id();
  insert("request", {
    request_id: requestId,
    commuter_id: owner.commuter_id,
    driver_id: null,
    request_type: "Pickup",
    request_status: "pending",
    request_date: iso(),
    device_latitude: area.area_latitude,
    device_longitude: area.area_longitude,
    is_draft: true,
    arrived_at: null,
    owner_present_at: null,
  });
  insert("pickup", {
    pickup_id: db.id(),
    request_id: requestId,
    vehicle_id: null,
    pickup_destination: String(area.area_name),
    pickup_date: iso(),
    number_of_passengers: fellow ? 3 : 2,
    requested_vehicle_type: "Jeepney",
    route_id: journey?.routeId ?? null,
    pickup_lat: area.area_latitude,
    pickup_lng: area.area_longitude,
    dropoff_name: journey ? String(journey.to.area_name) : null,
    dropoff_lat: journey?.to.area_latitude ?? null,
    dropoff_lng: journey?.to.area_longitude ?? null,
    boarded_at: null,
    dropped_at: null,
    waiting_area_id: area.area_id ?? null,
  });
  insert("pickup_companion", {
    request_id: requestId,
    commuter_id: mine.commuter_id,
    companion_status: "pending",
    responded_at: null,
    added_at: iso(),
    location_changed: false,
    arrived_at: null,
  });
  if (fellow)
    insert("pickup_companion", {
      request_id: requestId,
      commuter_id: fellow.commuter_id,
      companion_status: "pending",
      responded_at: null,
      added_at: iso(),
      location_changed: false,
      arrived_at: null,
    });
  notify(
    me(),
    "pickup_shared",
    "Share a ride request",
    `${fullName(owner.user_id)} wants to share a ride with you from ${area.area_name}. Tap to accept or decline.`,
    { request_id: requestId, generated: true },
  );
  return requestId;
};

const pickupShared = (): boolean => inviteToSharedRide() !== null;

const rentalAccepted = (): boolean => {
  if (!hasOpenRentalForMe()) return false;
  const before = db.tables.notification.length;
  const booked = acceptMyRentalNow();
  return booked > 0 && tagNewNotifications(before, "rental_accepted");
};

const rateTrip = (): boolean => {
  const mine = myCommuter();
  if (!mine) return false;
  const rental = db.tables.request.find(
    (r) =>
      r.commuter_id === mine.commuter_id &&
      r.request_type === "Pickup" &&
      r.request_status === "completed" &&
      !db.tables.rating.some((x) => x.request_id === r.request_id) &&
      !db.tables.notification.some(
        (n) => n.notification_type === "rate_trip" && (n.data as Row | null)?.request_id === r.request_id && (n.data as Row | null)?.generated === true,
      ),
  );
  if (!rental) return false;
  notify(
    me(),
    "rate_trip",
    "How was your trip?",
    "Rate your rental to help other commuters and your driver.",
    { request_id: rental.request_id, generated: true },
  );
  return true;
};

const rentalRequest = (): boolean => {
  const before = db.tables.notification.length;
  return !!postRentalRequestNow() && tagNewNotifications(before, "rental_request");
};

const unratedRentalForMe = (driver: Row): Row | null => {
  const existing = db.tables.request.find(
    (r) =>
      r.request_type === "Charter_Rental" &&
      r.request_status === "completed" &&
      r.driver_id === driver.driver_id &&
      !db.tables.rating.some((x) => x.request_id === r.request_id),
  );
  if (existing) return existing;
  const commuters = freeCommuters();
  if (!commuters.length || !driver.vehicle_id) return null;
  const commuter = commuters[generatedCount() % commuters.length];
  const vehicle = db.tables.vehicle.find((v) => v.vehicle_id === driver.vehicle_id);
  const day = new Date(db.now().getTime() - 3 * 86_400_000);
  const requestId = db.id();
  insert("request", {
    request_id: requestId,
    commuter_id: commuter.commuter_id,
    driver_id: driver.driver_id,
    request_type: "Charter_Rental",
    request_status: "completed",
    request_date: new Date(day.getTime() - 86_400_000).toISOString(),
    device_latitude: 13.6229,
    device_longitude: 123.1851,
    is_draft: false,
    arrived_at: null,
    owner_present_at: null,
  });
  insert("charter_rental", {
    rental_id: db.id(),
    request_id: requestId,
    vehicle_id: driver.vehicle_id,
    rental_destination: "Naga Metropolitan Cathedral",
    rental_date: day.toISOString().slice(0, 10),
    number_of_passengers: 10,
    purpose: "Family outing",
    pickup_location: "Centro, Naga City",
    pickup_time: day.toISOString(),
    destination_latitude: 13.6217,
    destination_longitude: 123.1948,
    trip_type: "one_way",
    return_time: null,
    notes: null,
    requested_vehicle_type: vehicle?.vehicle_type ?? "Jeepney",
  });
  insert("charter_rental_unit", {
    unit_id: db.id(),
    request_id: requestId,
    position: 1,
    vehicle_type: vehicle?.vehicle_type ?? "Jeepney",
    driver_id: driver.driver_id,
    vehicle_id: driver.vehicle_id,
    status: "completed",
    booked_at: new Date(day.getTime() - 86_400_000).toISOString(),
  });
  return db.tables.request.find((r) => r.request_id === requestId) ?? null;
};

const ratingReceived = (): boolean => {
  const driver = myDrivers().find((d) => d.vehicle_id);
  if (!driver) return false;
  const rental = unratedRentalForMe(driver);
  if (!rental) return false;
  const turn = generatedCount();
  const score = turn % 3 === 0 ? 4 : 5;
  const text = feedback[turn % feedback.length];
  insert("rating", {
    rating_id: db.id(),
    history_id: null,
    request_id: rental.request_id,
    driver_id: driver.driver_id,
    score,
    feedback: text,
    tags: [],
    rated_at: iso(),
  });
  notify(
    me(),
    "rating_received",
    `New ${score}-star rating`,
    text ? `"${text}"` : "A commuter rated their rental with you.",
    { request_id: rental.request_id, score, generated: true },
  );
  return true;
};

const pickupNearby = (): boolean => {
  const before = db.tables.notification.length;
  return sendPickupRequest() && tagNewNotifications(before, "pickup_nearby");
};

const commuterSteps: [string, () => boolean][] = [
  ["pickup_shared", pickupShared],
  ["rental_accepted", rentalAccepted],
  ["rate_trip", rateTrip],
];
const driverSteps: [string, () => boolean][] = [
  ["rental_request", rentalRequest],
  ["rating_received", ratingReceived],
  ["pickup_nearby", pickupNearby],
];

export function generateNotification(): GenerateResult {
  const steps = myPersonnel() ? driverSteps : myCommuter() ? commuterSteps : [];
  if (!steps.length) return { ok: false, reason: NOTHING };
  const role = myPersonnel() ? "driver" : "commuter";
  if (db.tables.notification.length < lastNotificationCount) {
    rotation.commuter = 0;
    rotation.driver = 0;
  }
  lastNotificationCount = db.tables.notification.length;
  const start = rotation[role] % steps.length;
  rotation[role] = (rotation[role] + 1) % steps.length;
  for (let i = 0; i < steps.length; i++) {
    const [type, run] = steps[(start + i) % steps.length];
    if (run()) {
      lastNotificationCount = db.tables.notification.length;
      return { ok: true, type };
    }
  }
  lastNotificationCount = db.tables.notification.length;
  return { ok: false, reason: NOTHING };
}
