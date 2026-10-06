import { authRoutes } from "@/api/v1/auth/routes";
import { getSupabaseClient } from "@/api/v1/client";
import { pickupRoutes } from "@/api/v1/pickups/routes";
import type {
  BookingRow,
  PickupDriverRow,
  PickupRequestRow,
  RequestStatus,
} from "@/api/v1/pickups/types";
import { attempt, failure, unwrap, type Result } from "@/api/v1/result";
import {
  getOccupancyLevel,
  toVehicleType,
  vehicleStatusLabels,
  type OccupancyLevel,
  type VehicleType,
} from "@/api/v1/transit-routes/controllers";

export type PickupVehicle = "jeep" | "tricy";

export type PickupRequest = {
  id: string;
  pickupName: string;
  lat: number;
  lng: number;
  passengers: number;
  status: RequestStatus;
};

export const minPickupPassengers = 1;
export const maxPickupPassengers = 10;

async function getCommuterId() {
  const { session } = await unwrap(authRoutes.getSession());
  if (!session) throw new Error("Sign in again to request a pickup.");
  const { id, email } = session.user;

  const existing: { commuter_id: string } | null = await unwrap(
    pickupRoutes.findCommuter(id),
  );
  if (existing) return existing.commuter_id;

  await unwrap(pickupRoutes.createUser(id, email ?? ""));
  const created: { commuter_id: string } | null = await unwrap(
    pickupRoutes.createCommuter(id),
  );
  if (!created) throw new Error("Your commuter account could not be set up.");
  return created.commuter_id;
}

let knownActivePickup: PickupRequest | null = null;
let knownUserId: string | null = null;
let watchingAuth = false;
export const getKnownActivePickup = () => knownActivePickup;

function watchAuthChanges() {
  if (watchingAuth) return;
  watchingAuth = true;
  getSupabaseClient().auth.onAuthStateChange((_event, session) => {
    const userId = session?.user.id ?? null;
    if (userId !== knownUserId) {
      knownUserId = userId;
      knownActivePickup = null;
    }
  });
}

export async function loadActivePickup(): Promise<
  Result<PickupRequest | null>
> {
  watchAuthChanges();
  const result = await fetchActivePickup();
  if (result.ok) knownActivePickup = result.data;
  return result;
}

function fetchActivePickup(): Promise<Result<PickupRequest | null>> {
  return attempt(async () => {
    const commuterId = await getCommuterId();
    const row: PickupRequestRow | null = await unwrap(
      pickupRoutes.findActiveRequest(commuterId),
    );
    const pickup = Array.isArray(row?.pickup) ? row.pickup[0] : row?.pickup;
    if (!row || !pickup) return null;
    return {
      id: row.request_id,
      pickupName: pickup.pickup_destination,
      lat: row.device_latitude,
      lng: row.device_longitude,
      passengers: pickup.number_of_passengers,
      status: row.request_status,
    };
  });
}

type PickupPoint = { name: string; lat: number; lng: number };

type PickupForm = {
  vehicle: PickupVehicle;
  passengers: number;
  location: PickupPoint | null;
  waitingArea: PickupPoint | null;
};

export async function requestPickup(
  form: PickupForm,
): Promise<Result<PickupRequest>> {
  const { vehicle, passengers, location, waitingArea } = form;

  if (!location) {
    return failure("Choose where you are so drivers can find you.");
  }
  if (vehicle === "jeep" && !waitingArea) {
    return failure(
      "There’s no waiting area near you. Jeepneys only pick up at waiting areas.",
    );
  }
  if (passengers < minPickupPassengers || passengers > maxPickupPassengers) {
    return failure(
      `Choose between ${minPickupPassengers} and ${maxPickupPassengers} passengers.`,
    );
  }

  const point = (vehicle === "jeep" ? waitingArea : null) ?? location;

  return attempt(async () => {
    const commuterId = await getCommuterId();
    const request: {
      request_id: string;
      request_status: RequestStatus;
    } | null = await unwrap(
      pickupRoutes.createRequest(commuterId, point.lat, point.lng),
    );
    if (!request) throw new Error("Your pickup request could not be saved.");

    try {
      await unwrap(
        pickupRoutes.createPickup(request.request_id, point.name, passengers),
      );
    } catch (error) {
      await pickupRoutes.deleteRequest(request.request_id);
      throw error;
    }

    knownActivePickup = {
      id: request.request_id,
      pickupName: point.name,
      lat: point.lat,
      lng: point.lng,
      passengers,
      status: request.request_status,
    };
    return knownActivePickup;
  });
}

export const canCancelPickup = (request: PickupRequest) =>
  request.status === "pending";

export async function cancelPickup(
  request: PickupRequest,
): Promise<Result<void>> {
  if (!canCancelPickup(request)) {
    return failure("A driver already accepted this request.");
  }
  return attempt(async () => {
    await unwrap(pickupRoutes.deletePickup(request.id));
    await unwrap(pickupRoutes.deleteRequest(request.id));
    knownActivePickup = null;
  });
}

export type PickupDriver = {
  requestId: string;
  plateNumber: string;
  vehicleType: VehicleType;
  status: string;
  maxCapacity: number;
  currentCapacity: number;
  occupancy: OccupancyLevel;
  location: { lat: number; lng: number; speedKmh: number } | null;
};

export function loadPickupDriver(): Promise<Result<PickupDriver | null>> {
  return attempt(async () => {
    const row: PickupDriverRow | null = await unwrap(
      pickupRoutes.findMyDriver(),
    );
    if (!row) return null;
    return {
      requestId: row.request_id,
      plateNumber: row.plate_number,
      vehicleType: toVehicleType(row.vehicle_type),
      status: vehicleStatusLabels[row.vehicle_status] ?? row.vehicle_status,
      maxCapacity: row.max_capacity,
      currentCapacity: row.current_capacity,
      occupancy: getOccupancyLevel(row.current_capacity, row.max_capacity),
      location: row.location
        ? {
            lat: row.location.latitude,
            lng: row.location.longitude,
            speedKmh: row.location.speed_kmh,
          }
        : null,
    };
  });
}

export function formatEta(seconds: number) {
  if (seconds < 60) return "in less than a minute";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `in about ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `in about ${hours} hr${rest ? ` ${rest} min` : ""}`;
}

export type BookingKind = "pickup" | "rental";

export type Booking = {
  id: string;
  kind: BookingKind;
  requestedAt: Date;
  destination: string;
  passengers: number | null;
  rentalDate: string | null;
  purpose: string | null;
  plateNumber: string | null;
  vehicleType: string | null;
  driverName: string | null;
};

export function loadBookings(): Promise<Result<Booking[]>> {
  return attempt(async () => {
    const rows: BookingRow[] =
      (await unwrap(pickupRoutes.findMyBookings())) ?? [];
    return rows.map((row) => ({
      id: row.request_id,
      kind: row.request_type === "Charter_Rental" ? "rental" : "pickup",
      requestedAt: new Date(row.request_date),
      destination: row.destination ?? "Unknown destination",
      passengers: row.passengers,
      rentalDate: row.rental_date,
      purpose: row.purpose,
      plateNumber: row.plate_number,
      vehicleType: row.vehicle_type,
      driverName: row.driver_name,
    }));
  });
}

export function loadRequestStatus(
  requestId: string,
): Promise<Result<RequestStatus | null>> {
  return attempt(async () => {
    const row: { request_status: RequestStatus } | null = await unwrap(
      pickupRoutes.findRequestStatus(requestId),
    );
    return row?.request_status ?? null;
  });
}

export type TripRide = {
  id: string;
  onBoard: boolean;
  departedAt: Date | null;
  arrivedAt: Date | null;
  routeName: string;
  plateNumber: string | null;
  vehicleType: string | null;
  driverName: string | null;
};

export function loadTripHistory(): Promise<Result<TripRide[]>> {
  return attempt(async () => {
    const rows: {
      history_id: string;
      trip_status: string;
      departure_time: string | null;
      arrival_time: string | null;
      route_name: string | null;
      plate_number: string | null;
      vehicle_type: string | null;
      driver_name: string | null;
    }[] = (await unwrap(pickupRoutes.findMyTripHistory())) ?? [];
    return rows.map((row) => ({
      id: row.history_id,
      onBoard: row.trip_status === "active",
      departedAt: row.departure_time ? new Date(row.departure_time) : null,
      arrivedAt: row.arrival_time ? new Date(row.arrival_time) : null,
      routeName: row.route_name ?? "Unknown route",
      plateNumber: row.plate_number,
      vehicleType: row.vehicle_type,
      driverName: row.driver_name,
    }));
  });
}
