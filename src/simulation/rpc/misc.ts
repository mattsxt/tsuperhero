import { currentUserId } from "@/simulation/auth";
import { db, type Row } from "@/simulation/db";
import { notify } from "@/simulation/rpc/notify";

const fail = (message: string, code = "22023"): never => {
  throw Object.assign(new Error(message), { code });
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
const timeOf = (v: unknown) => new Date(String(v)).getTime();
const uid = (): string => currentUserId() ?? "";

const profileOf = (userId: unknown) => db.tables.profile.find((p) => p.user_id === userId);
const commuterUser = (commuterId: unknown) =>
  db.tables.commuter.find((c) => c.commuter_id === commuterId)?.user_id;

const myDriverIds = (): string[] => {
  const personnel = db.tables.transit_personnel.find((p) => p.user_id === uid());
  return db.tables.driver
    .filter((d) => d.personnel_id === personnel?.personnel_id)
    .map((d) => String(d.driver_id));
};

const rateRequest = (a: any) => {
  const feedback = String(a.p_feedback ?? "").trim() || null;
  if (a.p_score == null || a.p_score < 1 || a.p_score > 5)
    fail("Choose between 1 and 5 stars.");
  if ((feedback ?? "").length > 500) fail("Keep your feedback under 500 characters.");
  const commuter = db.tables.commuter.find((c) => c.user_id === uid());
  const request = db.tables.request.find(
    (r) => r.request_id === a.p_request_id && r.commuter_id === commuter?.commuter_id,
  );
  if (!request) return fail("This booking was not found.", "42501");
  if (request.request_type !== "Charter_Rental") fail("Only rentals can be rated.");
  if (request.request_status !== "completed") fail("You can rate a trip once it is completed.");
  if (db.tables.rating.some((r) => r.request_id === a.p_request_id))
    fail("You already rated this trip.");
  const row: Row = {
    rating_id: db.id(),
    history_id: null,
    request_id: a.p_request_id,
    driver_id: request.driver_id,
    score: a.p_score,
    feedback,
    tags: null,
    rated_at: db.now().toISOString(),
  };
  db.tables.rating.push(row);
  db.emit({ table: "rating", type: "INSERT", row });
  const driver = db.tables.driver.find((d) => d.driver_id === request.driver_id);
  const personnel = db.tables.transit_personnel.find(
    (p) => p.personnel_id === driver?.personnel_id,
  );
  notify(
    personnel?.user_id,
    "rating_received",
    `New ${a.p_score}-star rating`,
    feedback ? `"${feedback.slice(0, 120)}"` : "A commuter rated their rental with you.",
    { request_id: a.p_request_id, score: a.p_score },
  );
  return null;
};

const getMyRatings = () => {
  const mine = myDriverIds();
  const entries = db.tables.rating
    .filter((r) => mine.includes(String(r.driver_id)))
    .flatMap((r) => {
      const request = db.tables.request.find((q) => q.request_id === r.request_id);
      if (!request || request.request_type !== "Charter_Rental") return [];
      const pickup = db.tables.pickup.find((p) => p.request_id === request.request_id);
      const rental = db.tables.charter_rental.find((c) => c.request_id === request.request_id);
      return [
        {
          r,
          requestType: request.request_type,
          destination: pickup?.pickup_destination ?? rental?.rental_destination ?? null,
          commuterId: request.commuter_id,
        },
      ];
    });
  const scores = entries.map((e) => num(e.r.score));
  const count = (n: number) => scores.filter((s) => s === n).length;
  const recent = [...entries]
    .sort((x, y) => timeOf(y.r.rated_at) - timeOf(x.r.rated_at))
    .slice(0, 20)
    .map((e) => {
      const profile = profileOf(commuterUser(e.commuterId));
      return {
        rating_id: e.r.rating_id,
        score: e.r.score,
        feedback: e.r.feedback ?? null,
        rated_at: e.r.rated_at,
        request_type: e.requestType,
        destination: e.destination,
        commuter_name: profile?.first_name ?? null,
        commuter_picture: profile?.profile_picture ?? null,
      };
    });
  return {
    average: scores.length
      ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10
      : null,
    count: scores.length,
    breakdown: { "5": count(5), "4": count(4), "3": count(3), "2": count(2), "1": count(1) },
    recent,
  };
};

const liveVehicles = (windowMs: number, withSeen: boolean) => () => {
  const now = db.now().getTime();
  return db.tables.location_records.flatMap((location) => {
    const vehicle = db.tables.vehicle.find((v) => v.vehicle_id === location.vehicle_id);
    if (!vehicle) return [];
    if (!["on-trip", "loading"].includes(String(vehicle.vehicle_status))) return [];
    if (!(timeOf(location.recorded_at) > now - windowMs)) return [];
    const activeTrip = db.tables.trip
      .filter((t) => t.vehicle_id === vehicle.vehicle_id && t.trip_status === "active")
      .sort((x, y) => timeOf(y.departure_time) - timeOf(x.departure_time))[0];
    const routeId = activeTrip?.route_id ?? vehicle.route_id ?? null;
    const route = db.tables.route.find((r) => r.route_id === routeId);
    const row: Row = {
      vehicle_id: vehicle.vehicle_id,
      vehicle_type: vehicle.vehicle_type,
      plate_number: vehicle.plate_number,
      vehicle_status: vehicle.vehicle_status,
      max_capacity: vehicle.max_capacity,
      current_capacity: vehicle.current_capacity ?? 0,
      latitude: location.records_latitude,
      longitude: location.records_longitude,
      route_id: route?.route_id ?? null,
      route_name: route?.route_name ?? null,
      is_full: vehicle.is_full ?? false,
    };
    if (withSeen) row.recorded_at = location.recorded_at;
    return [row];
  });
};

export const miscHandlers: Record<string, (args: any) => unknown> = {
  rate_request: rateRequest,
  get_my_ratings: getMyRatings,
  register_push_token: () => null,
  unregister_push_token: () => null,
  get_live_vehicles_with_full: liveVehicles(60_000, false),
  get_live_vehicles_with_last_seen: liveVehicles(10 * 60_000, true),
};
