import { currentUserId } from "@/simulation/auth";
import { db, type Row } from "@/simulation/db";
import { notify } from "@/simulation/rpc/notify";
import {
  bookRentalUnitEffect,
  completeRentalEffect,
  freeRentalDriver,
  hasActivePickup,
  hasActiveRental,
  liftRentalSuspensionEffect,
  postRentalEffect,
} from "@/simulation/rpc/rentals";
import { COOPERATIVE_HEAD_USER_ID } from "@/simulation/seed/people";

const BOOK_FIRST_S = 5;
const BOOK_GAP_S = 5;
const BOOK_MAX_S = 15;
const RENTAL_POST_EVERY_S = 90;
const MAX_OPEN_RENTAL_POSTS = 3;
const DAY = 86_400_000;

const destinations: { name: string; lat: number; lng: number }[] = [
  { name: "Panicuason Hot Spring", lat: 13.6612, lng: 123.3065 },
  { name: "Camaligan Boat Ride", lat: 13.6205, lng: 123.1653 },
  { name: "Mt. Isarog Nature Park", lat: 13.6589, lng: 123.3711 },
  { name: "CWC Watersports Complex", lat: 13.6359, lng: 123.2451 },
  { name: "Caramoan Port", lat: 13.6667, lng: 123.6167 },
];
const purposes = ["Family outing", "School field trip", "Company outing", "Wedding"];
const passengersFor: Record<string, number> = { Jeepney: 12, Tricycle: 3, Van: 8, Bus: 30 };

const bookAt = new Map<string, number>();
const mockPosts = new Set<string>();
let nextPostAt: number | null = null;
let postTurn = 0;

const myCommuterId = () =>
  db.tables.commuter.find((c) => c.user_id === currentUserId())?.commuter_id ?? null;

const myDrivers = (): Row[] => {
  const personnel = db.tables.transit_personnel.find((p) => p.user_id === currentUserId());
  return personnel ? db.tables.driver.filter((d) => d.personnel_id === personnel.personnel_id) : [];
};

const myVehicleType = (): string | null => {
  const driver = myDrivers().find((d) => d.vehicle_id);
  const vehicle = db.tables.vehicle.find((v) => v.vehicle_id === driver?.vehicle_id);
  return vehicle ? String(vehicle.vehicle_type) : null;
};

const requestOf = (id: unknown) => db.tables.request.find((r) => r.request_id === id);

const openUnitsOfMyRentals = (): Row[] => {
  const mine = myCommuterId();
  if (!mine) return [];
  return db.tables.charter_rental_unit
    .filter((u) => u.status === "open")
    .filter((u) => {
      const request = requestOf(u.request_id);
      return request?.commuter_id === mine && request.request_status === "pending";
    })
    .sort((a, b) => Number(a.position) - Number(b.position));
};

const bookUnit = (unit: Row): boolean => {
  const free = freeRentalDriver(String(unit.unit_id), currentUserId());
  if (!free) return false;
  bookRentalUnitEffect(String(unit.unit_id), free.driverId, free.vehicleId);
  return true;
};

export function hasOpenRentalForMe(): boolean {
  return openUnitsOfMyRentals().length > 0;
}

export function acceptMyRentalNow(): number {
  let booked = 0;
  for (const unit of openUnitsOfMyRentals()) if (bookUnit(unit)) booked += 1;
  return booked;
}

const openMockPosts = () =>
  [...mockPosts].filter((id) => {
    const request = requestOf(id);
    return (
      request?.request_status === "pending" &&
      db.tables.charter_rental_unit.some((u) => u.request_id === id && u.status === "open")
    );
  });

export function postRentalRequestNow(): string | null {
  const type = myVehicleType();
  if (!type || openMockPosts().length >= MAX_OPEN_RENTAL_POSTS) return null;
  const me = myCommuterId();
  const commuters = db.tables.commuter.filter(
    (c) =>
      c.user_id !== currentUserId() &&
      c.commuter_id !== me &&
      !hasActivePickup(c.commuter_id) &&
      !hasActiveRental(c.commuter_id),
  );
  if (!commuters.length) return null;
  const commuter = commuters[postTurn % commuters.length];
  const destination = destinations[postTurn % destinations.length];
  const areas = db.tables.waiting_area.filter((w) => w.is_active);
  const pickupArea = areas[postTurn % Math.max(1, areas.length)];
  const days = 1 + (postTurn % 5);
  const now = db.now();
  const pickup = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + days * DAY);
  postTurn += 1;
  const id = postRentalEffect(String(commuter.commuter_id), {
    p_vehicles: [type],
    p_pickup_location: pickupArea ? `${pickupArea.area_name}, Naga City` : "Centro, Naga City",
    p_pickup_latitude: pickupArea?.area_latitude ?? 13.6229,
    p_pickup_longitude: pickupArea?.area_longitude ?? 123.1859,
    p_destination: destination.name,
    p_destination_latitude: destination.lat,
    p_destination_longitude: destination.lng,
    p_pickup_time: pickup.toISOString(),
    p_trip_type: "one_way",
    p_return_time: null,
    p_purpose: purposes[postTurn % purposes.length],
    p_passengers: passengersFor[type] ?? 4,
    p_notes: null,
  });
  mockPosts.add(id);
  return id;
}

export function clearMyRentalPenaltiesNow(): "lifted" | "cooldown" | null {
  const mine = new Set(myDrivers().map((d) => String(d.driver_id)));
  if (!mine.size) return null;
  const open = db.tables.rental_suspension.find(
    (s) => mine.has(String(s.driver_id)) && !s.lifted_at,
  );
  if (open) {
    liftRentalSuspensionEffect(open.suspension_id, COOPERATIVE_HEAD_USER_ID, "Cleared from the demo panel");
    return "lifted";
  }
  const now = db.now().getTime();
  const cooling = db.tables.rental_cancellation.filter(
    (c) =>
      mine.has(String(c.driver_id)) &&
      !!c.blocked_until &&
      new Date(String(c.blocked_until)).getTime() > now,
  );
  for (const row of cooling) row.blocked_until = db.now().toISOString();
  return cooling.length ? "cooldown" : null;
}

export function completeAcceptedRentalNow(): boolean {
  const mine = new Set(myDrivers().map((d) => d.driver_id));
  if (!mine.size) return false;
  const candidates = db.tables.charter_rental
    .filter((rental) => {
      const request = requestOf(rental.request_id);
      return (
        !!request &&
        ["pending", "accepted"].includes(String(request.request_status)) &&
        db.tables.charter_rental_unit.some(
          (u) => u.request_id === rental.request_id && u.status === "booked" && mine.has(u.driver_id),
        )
      );
    })
    .sort((a, b) => new Date(String(a.pickup_time)).getTime() - new Date(String(b.pickup_time)).getTime());
  if (!candidates.length) return false;
  completeRentalEffect(String(candidates[0].request_id));
  return true;
}

export function runRentals(clock: number, seconds: number): void {
  const startedAt = clock - seconds;
  const units = openUnitsOfMyRentals();
  for (const unit of units) {
    const id = String(unit.unit_id);
    const due = bookAt.get(id);
    if (due === undefined) {
      const wait = Math.min(BOOK_MAX_S, BOOK_FIRST_S + BOOK_GAP_S * (Number(unit.position) - 1));
      bookAt.set(id, startedAt + wait);
    } else if (clock >= due) {
      bookAt.delete(id);
      bookUnit(unit);
    }
  }
  if (myVehicleType()) {
    if (nextPostAt === null) nextPostAt = startedAt + RENTAL_POST_EVERY_S;
    if (clock >= nextPostAt) {
      nextPostAt = clock + RENTAL_POST_EVERY_S;
      postRentalRequestNow();
    }
  } else nextPostAt = null;
}

export function resetRentals(): void {
  bookAt.clear();
  mockPosts.clear();
  nextPostAt = null;
  postTurn = 0;
  ratingTurn = 0;
}

const myCompletedRentalJobs = (): Row[] => {
  const mine = new Set(myDrivers().map((d) => d.driver_id));
  if (!mine.size) return [];
  return db.tables.charter_rental_unit.filter(
    (u) =>
      u.status === "completed" &&
      mine.has(u.driver_id) &&
      requestOf(u.request_id)?.request_type === "Charter_Rental",
  );
};

export function hasCompletedRentalJobs(): boolean {
  return myCompletedRentalJobs().length > 0;
}

const ratingFeedback = [
  "Smooth ride and very polite driver.",
  "Arrived on time. Thank you!",
  null,
  "Safe driving, clean vehicle.",
];
let ratingTurn = 0;

export function rateCompletedRentalNow(): number | null {
  const job = myCompletedRentalJobs()
    .filter(
      (u) =>
        !db.tables.rating.some(
          (r) => r.request_id === u.request_id && r.driver_id === u.driver_id,
        ),
    )
    .sort((a, b) => new Date(String(a.booked_at)).getTime() - new Date(String(b.booked_at)).getTime())[0];
  if (!job) return null;
  const score = ratingTurn % 3 === 2 ? 4 : 5;
  const feedback = ratingFeedback[ratingTurn % ratingFeedback.length];
  ratingTurn += 1;
  const row: Row = {
    rating_id: db.id(),
    history_id: null,
    request_id: job.request_id,
    driver_id: job.driver_id,
    score,
    feedback,
    tags: null,
    rated_at: db.now().toISOString(),
  };
  db.tables.rating.push(row);
  db.emit({ table: "rating", type: "INSERT", row });
  const destination =
    (db.tables.charter_rental.find((r) => r.request_id === job.request_id)
      ?.rental_destination as string | undefined) ?? "their destination";
  notify(
    currentUserId(),
    "rating_received",
    `New ${score}-star rating`,
    feedback ? `"${feedback}"` : `A commuter rated your rental to ${destination}.`,
    { request_id: job.request_id, score },
  );
  return score;
}
