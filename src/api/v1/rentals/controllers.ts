import { getCommuterId } from "@/api/v1/pickups/controllers";
import type { Place } from "@/api/v1/places/controllers";
import {
  rentalRoutes,
  type RentalRow,
  type RentalVehicleType,
} from "@/api/v1/rentals/routes";
import { unwrapCached } from "@/api/v1/cache";
import { attempt, failure, unwrap, type Result } from "@/api/v1/result";
import { checkOnline } from "@/hooks/use-online";

export type CharterVehicle = "van" | "jeep" | "bus" | "tricy";
export type Fleet = Record<CharterVehicle, number>;
export type TripType = "one_way" | "round_trip";
export type RentalStatus = RentalRow["status"];

const vehicleTypes: Record<CharterVehicle, RentalVehicleType> = {
  van: "Van",
  jeep: "Jeepney",
  bus: "Bus",
  tricy: "Tricycle",
};

export const charterVehicleOrder: CharterVehicle[] = [
  "jeep",
  "van",
  "bus",
  "tricy",
];

export const fleetSize = (fleet: Fleet) =>
  charterVehicleOrder.reduce((total, vehicle) => total + fleet[vehicle], 0);

export function describeFleet(types: string[]) {
  const counts = new Map<string, number>();
  types.forEach((type) => counts.set(type, (counts.get(type) ?? 0) + 1));
  return [...counts]
    .map(([type, count]) => `${count} ${type}${count === 1 ? "" : "s"}`)
    .join(", ");
}

export type RentalUnit = {
  id: string;
  vehicleType: string;
  status: "open" | "booked" | "completed";
  isMine: boolean;
  driverName: string | null;
  plateNumber: string | null;
  driverContact: string | null;
  driverId: string | null;
  myScore: number | null;
};

export type Rental = {
  id: string;
  units: RentalUnit[];
  unitId: string | null;
  unitVehicleType: string | null;
  status: RentalStatus;
  expired: boolean;
  driverAssigned: boolean;
  requestedAt: Date;
  scheduleConflict: boolean;
  pickupLocation: string;
  destination: string;
  pickupTime: Date;
  tripType: TripType;
  returnTime: Date | null;
  purpose: string;
  passengers: number;
  notes: string | null;
  plateNumber: string | null;
  vehicleType: string | null;
  driverName: string | null;
  driverContact: string | null;
  commuterName: string | null;
  commuterContact: string | null;
  rating: { score: number; feedback: string | null } | null;
};

export type RentalTrip = {
  pickup: Place;
  destination: Place;
  pickupTime: Date;
  tripType: TripType;
  returnTime: Date | null;
  purpose: string;
  passengers: number;
  notes: string;
};

export function combineDateTime(date: Date, time: Date) {
  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined;
}

const toRental = (row: RentalRow): Rental => {
  const pickupTime = new Date(row.pickup_time);
  const anyBooked =
    (row.units ?? []).some((unit) => unit.status !== "open") ||
    (!row.units?.length && !!row.driver_assigned);
  return {
    id: row.request_id,
    units: (row.units ?? []).map((unit) => ({
      id: unit.unit_id,
      vehicleType: unit.vehicle_type,
      status: unit.status,
      isMine: unit.is_mine,
      driverName: unit.driver_name,
      plateNumber: unit.plate_number,
      driverContact: unit.driver_contact,
      driverId: unit.driver_id ?? null,
      myScore: unit.my_score ?? null,
    })),
    unitId: row.unit_id ?? null,
    unitVehicleType: row.unit_vehicle_type ?? null,
    status: row.status,
    expired:
      row.status === "pending" &&
      !anyBooked &&
      pickupTime.getTime() <= Date.now(),
    driverAssigned: row.driver_assigned ?? row.status !== "pending",
    requestedAt: new Date(row.requested_at),
    scheduleConflict: !!row.schedule_conflict,
    pickupLocation: row.pickup_location ?? "Pickup location",
    destination: row.destination,
    pickupTime,
    tripType: row.trip_type,
    returnTime: row.return_time ? new Date(row.return_time) : null,
    purpose: row.purpose,
    passengers: row.passengers,
    notes: row.notes,
    plateNumber: row.plate_number,
    vehicleType: row.vehicle_type ?? row.requested_vehicle_type ?? null,
    driverName: row.driver_name,
    driverContact: row.driver_contact,
    commuterName: row.commuter_name,
    commuterContact: row.commuter_contact,
    rating:
      row.rating_score === null || row.rating_score === undefined
        ? null
        : { score: row.rating_score, feedback: row.rating_feedback },
  };
};

export async function postRental(
  fleet: Fleet,
  trip: RentalTrip,
): Promise<Result<string>> {
  const vehicles = charterVehicleOrder.flatMap((vehicle) =>
    Array.from({ length: fleet[vehicle] }, () => vehicleTypes[vehicle]),
  );
  if (vehicles.length === 0) return failure("Choose at least one vehicle.");
  if (!(await checkOnline())) {
    return failure(
      "You're offline. Connect to the internet to post your request.",
    );
  }
  if (trip.pickupTime.getTime() <= Date.now()) {
    return failure("Choose a pickup time in the future.");
  }
  return attempt(async () => {
    await getCommuterId();
    return unwrap(
      rentalRoutes.post({
        p_vehicles: vehicles,
        p_pickup_location: trip.pickup.name,
        p_pickup_latitude: trip.pickup.lat,
        p_pickup_longitude: trip.pickup.lng,
        p_destination: trip.destination.name,
        p_destination_latitude: trip.destination.lat,
        p_destination_longitude: trip.destination.lng,
        p_pickup_time: trip.pickupTime.toISOString(),
        p_trip_type: trip.tripType,
        p_return_time:
          trip.tripType === "round_trip" && trip.returnTime
            ? trip.returnTime.toISOString()
            : null,
        p_purpose: trip.purpose,
        p_passengers: trip.passengers,
        p_notes: trip.notes.trim() || null,
      }),
    );
  });
}

export function loadMyRentals(): Promise<Result<Rental[]>> {
  return attempt(async () => {
    const rows: RentalRow[] =
      (await unwrapCached("rentals", rentalRoutes.listMine())) ?? [];
    return rows.map(toRental);
  });
}

export function cancelRental(id: string): Promise<Result<unknown>> {
  return attempt(() => unwrap(rentalRoutes.cancel(id)));
}

export function loadRentalRequests(): Promise<Result<Rental[]>> {
  return attempt(async () => {
    const rows: RentalRow[] =
      (await unwrapCached("rental-requests", rentalRoutes.listForDriver())) ??
      [];
    return rows.map(toRental);
  });
}

export function respondToRental(
  id: string,
  accept: boolean,
): Promise<Result<unknown>> {
  return attempt(() => unwrap(rentalRoutes.respond(id, accept)));
}

export function loadJobBoard(): Promise<Result<Rental[]>> {
  return attempt(async () => {
    const rows: RentalRow[] =
      (await unwrapCached("rental-job-board", rentalRoutes.jobBoard())) ?? [];
    return rows.map(toRental);
  });
}

export async function acceptRentalJob(job: Rental): Promise<Result<unknown>> {
  if (!job.unitId) return failure("This job is no longer available.");
  if (!(await checkOnline())) {
    return failure("Reconnect to the internet to accept this job.");
  }
  const unitId = job.unitId;
  return attempt(() => unwrap(rentalRoutes.acceptJob(unitId)));
}

export function dropRentalJob(id: string): Promise<Result<unknown>> {
  return attempt(() => unwrap(rentalRoutes.dropJob(id)));
}

export function dismissRentalJob(id: string): Promise<Result<unknown>> {
  return attempt(() => unwrap(rentalRoutes.dismissJob(id)));
}

export function activeRentalOf(rentals: Rental[]): Rental | null {
  const now = Date.now();
  return (
    rentals.find((rental) => {
      if (rental.status === "pending") return !rental.expired;
      if (rental.status !== "accepted") return false;
      const end = (rental.returnTime ?? rental.pickupTime).getTime();
      return end + 12 * 60 * 60_000 > now;
    }) ?? null
  );
}

export function loadMyRental(id: string): Promise<Result<Rental | null>> {
  return attempt(async () => {
    const row: RentalRow | null = await unwrap(rentalRoutes.getMine(id));
    return row ? toRental(row) : null;
  });
}

export async function removeRentalDriver(
  unitId: string,
): Promise<Result<unknown>> {
  if (!(await checkOnline())) {
    return failure("Reconnect to the internet to change your drivers.");
  }
  return attempt(() => unwrap(rentalRoutes.removeDriver(unitId)));
}

export async function rateRentalDriver(
  requestId: string,
  driverId: string,
  score: number,
  feedback: string,
  tags: string[],
): Promise<Result<unknown>> {
  if (!(await checkOnline())) {
    return failure("Reconnect to the internet to send your rating.");
  }
  return attempt(() =>
    unwrap(
      rentalRoutes.rateDriver(
        requestId,
        driverId,
        score,
        feedback.trim() || null,
        tags,
      ),
    ),
  );
}

export const unratedDrivers = (rental: Rental) =>
  rental.units.filter(
    (unit) =>
      !!unit.driverId && unit.status !== "open" && unit.myScore === null,
  );

export function completeRental(id: string): Promise<Result<unknown>> {
  return attempt(() => unwrap(rentalRoutes.complete(id)));
}

export function formatRentalTime(date: Date) {
  const day = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

export const rentalStatusLabels: Record<RentalStatus, string> = {
  pending: "Waiting for a driver",
  accepted: "Booked",
  rejected: "Declined",
  completed: "Completed",
};

export const rentalCooldownMs = 60 * 60_000;

export function rentalWindow(
  jobs: Rental[],
  now: number,
): { rental: Rental; at: Date } | null {
  for (const rental of jobs) {
    const booked =
      rental.status === "accepted" ||
      rental.units.some((unit) => unit.isMine && unit.status === "booked");
    if (!booked || rental.status === "completed") continue;
    for (const at of [rental.pickupTime, rental.returnTime]) {
      if (at && Math.abs(at.getTime() - now) <= rentalCooldownMs) {
        return { rental, at };
      }
    }
  }
  return null;
}

export function commuterRentalWindow(
  rentals: Rental[],
  now: number,
): { rental: Rental; at: Date } | null {
  for (const rental of rentals) {
    if (rental.status !== "pending" && rental.status !== "accepted") continue;
    if (rental.expired) continue;
    for (const at of [rental.pickupTime, rental.returnTime]) {
      if (at && Math.abs(at.getTime() - now) <= rentalCooldownMs) {
        return { rental, at };
      }
    }
  }
  return null;
}
