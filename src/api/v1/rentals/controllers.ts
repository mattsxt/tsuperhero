import { getCommuterId } from "@/api/v1/pickups/controllers";
import type { Place } from "@/api/v1/places/controllers";
import {
  rentalRoutes,
  type RentalDriverRow,
  type RentalRow,
  type RentalVehicleType,
} from "@/api/v1/rentals/routes";
import { unwrapCached } from "@/api/v1/cache";
import { attempt, failure, unwrap, type Result } from "@/api/v1/result";

export type CharterVehicle = "van" | "jeep" | "bus";
export type TripType = "one_way" | "round_trip";
export type RentalStatus = RentalRow["status"];

const vehicleTypes: Record<CharterVehicle, RentalVehicleType> = {
  van: "Van",
  jeep: "Jeepney",
  bus: "Bus",
};

export type RentalDriver = {
  driverId: string;
  vehicleId: string;
  name: string;
  yearsOfExperience: number | null;
  plateNumber: string;
  vehicleType: string;
  maxCapacity: number;
  isModern: boolean;
  cooperative: string | null;
};

export type Rental = {
  id: string;
  status: RentalStatus;
  expired: boolean;
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

const toDriver = (row: RentalDriverRow): RentalDriver => ({
  driverId: row.driver_id,
  vehicleId: row.vehicle_id,
  name: row.driver_name,
  yearsOfExperience: row.years_of_experience,
  plateNumber: row.plate_number,
  vehicleType: row.vehicle_type,
  maxCapacity: row.max_capacity,
  isModern: row.is_modern,
  cooperative: row.cooperative_name,
});

const toRental = (row: RentalRow): Rental => {
  const pickupTime = new Date(row.pickup_time);
  return {
    id: row.request_id,
    status: row.status,
    expired: row.status === "pending" && pickupTime.getTime() <= Date.now(),
    pickupLocation: row.pickup_location ?? "Pickup location",
    destination: row.destination,
    pickupTime,
    tripType: row.trip_type,
    returnTime: row.return_time ? new Date(row.return_time) : null,
    purpose: row.purpose,
    passengers: row.passengers,
    notes: row.notes,
    plateNumber: row.plate_number,
    vehicleType: row.vehicle_type,
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

export function findRentalDrivers(
  vehicle: CharterVehicle,
  trip: RentalTrip,
): Promise<Result<RentalDriver[]>> {
  return attempt(async () => {
    const rows: RentalDriverRow[] =
      (await unwrap(
        rentalRoutes.findDrivers(
          vehicleTypes[vehicle],
          trip.passengers,
          trip.pickupTime.toISOString(),
          trip.tripType === "round_trip" && trip.returnTime
            ? trip.returnTime.toISOString()
            : null,
        ),
      )) ?? [];
    return rows.map(toDriver);
  });
}

export async function requestRental(
  driver: RentalDriver,
  trip: RentalTrip,
): Promise<Result<string>> {
  if (trip.pickupTime.getTime() <= Date.now()) {
    return failure("Choose a pickup time in the future.");
  }
  return attempt(async () => {
    await getCommuterId();
    return unwrap(
      rentalRoutes.request({
        p_driver_id: driver.driverId,
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
  pending: "Waiting for driver",
  accepted: "Booked",
  rejected: "Declined",
  completed: "Completed",
};
