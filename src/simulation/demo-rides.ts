import { currentUserId } from "@/simulation/auth";
import { db, type Row } from "@/simulation/db";
import * as engine from "@/simulation/engine";
import { inviteToSharedRide } from "@/simulation/notifications-sim";
import { handlers } from "@/simulation/rpc";
import { hasActivePickup, hasActiveRental } from "@/simulation/rpc/rentals";

type Result = engine.GenerateRideResult;

const iso = () => db.now().toISOString();
const myCommuterId = () =>
  db.tables.commuter.find((c) => c.user_id === currentUserId())?.commuter_id as
    | string
    | undefined;

const insert = (table: "request" | "pickup" | "pickup_companion", row: Row) => {
  db.tables[table].push(row);
  db.emit({ table, type: "INSERT", row });
};

const isFreeRider = (commuterId: unknown) =>
  !hasActivePickup(commuterId) &&
  !hasActiveRental(commuterId) &&
  !db.tables.pickup_companion.some(
    (c) =>
      c.commuter_id === commuterId &&
      ["pending", "accepted"].includes(String(c.companion_status)) &&
      ["pending", "accepted", "riding"].includes(
        String(db.tables.request.find((r) => r.request_id === c.request_id)?.request_status),
      ),
  );

const pendingInviteForMe = (mine: string) =>
  db.tables.pickup_companion.find(
    (c) =>
      c.commuter_id === mine &&
      c.companion_status === "pending" &&
      db.tables.request.find((r) => r.request_id === c.request_id)?.request_status === "pending",
  );

export function generateRideAsCompanion(): Result {
  const mine = myCommuterId();
  if (!mine) return { ok: false, message: "Sign in as a commuter first." };
  if (engine.hostedPickupId())
    return { ok: false, message: "You're hosting · use HOST" };
  let id = engine.sharedRideId();
  if (!id) {
    const invite = pendingInviteForMe(mine);
    const requestId = invite ? String(invite.request_id) : inviteToSharedRide();
    if (!requestId) return { ok: false, message: "No free host" };
    try {
      handlers.respond_to_share_invite({ p_request_id: requestId, p_accept: true });
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
    id = requestId;
  }
  return engine.fastForwardPickup(id);
}

export function generateRideAsHost(): Result {
  const mine = myCommuterId();
  if (!mine) return { ok: false, message: "Sign in as a commuter first." };
  if (engine.sharedRideId())
    return { ok: false, message: "You're a companion · use COMPANION" };
  const hosted = engine.hostedPickupId();
  if (hosted) return engine.fastForwardPickup(hosted);
  if (hasActiveRental(mine)) return { ok: false, message: "Rental in progress" };
  const here = engine.userFix(currentUserId());
  const journey = engine.planSharedJourney([here.lat, here.lng]);
  if (!journey) return { ok: false, message: "No route here" };
  const companion = db.tables.commuter.find(
    (c) => c.commuter_id !== mine && isFreeRider(c.commuter_id),
  );
  const { from, to, routeId } = journey;
  const requestId = db.id();
  insert("request", {
    request_id: requestId,
    commuter_id: mine,
    driver_id: null,
    request_type: "Pickup",
    request_status: "pending",
    request_date: iso(),
    device_latitude: from.area_latitude,
    device_longitude: from.area_longitude,
    is_draft: true,
    arrived_at: null,
    owner_present_at: null,
  });
  insert("pickup", {
    pickup_id: db.id(),
    request_id: requestId,
    vehicle_id: null,
    pickup_destination: String(from.area_name),
    pickup_date: iso(),
    number_of_passengers: companion ? 2 : 1,
    requested_vehicle_type: "Jeepney",
    route_id: routeId,
    pickup_lat: from.area_latitude,
    pickup_lng: from.area_longitude,
    dropoff_name: String(to.area_name),
    dropoff_lat: to.area_latitude,
    dropoff_lng: to.area_longitude,
    boarded_at: null,
    dropped_at: null,
    waiting_area_id: from.area_id ?? null,
  });
  if (companion)
    insert("pickup_companion", {
      request_id: requestId,
      commuter_id: companion.commuter_id,
      companion_status: "accepted",
      responded_at: iso(),
      added_at: iso(),
      location_changed: false,
      arrived_at: null,
    });
  return engine.fastForwardPickup(requestId);
}
