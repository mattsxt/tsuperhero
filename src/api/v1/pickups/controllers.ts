import { authRoutes } from "@/api/v1/auth/routes";
import { getSupabaseClient } from "@/api/v1/client";
import {
  readCache,
  unwrapCached,
  writeCache,
} from "@/api/v1/cache";
import { pickupRoutes } from "@/api/v1/pickups/routes";
import type {
  BookingRow,
  CompanionStatus,
  PickupCompanionStatusRow,
  PickupDraftRow,
  PickupDriverRow,
  PickupRequestRow,
  RequestStatus,
  RiderRow,
  ShareInviteRow,
} from "@/api/v1/pickups/types";
import { getKnownWaitingAreas } from "@/api/v1/waiting-areas/controllers";
import type { WaitingAreaType } from "@/constants/waiting-area";
import {
  attempt,
  failure,
  success,
  unwrap,
  type Result,
} from "@/api/v1/result";
import {
  checkOnline,
  isOnline,
  subscribeToOnline,
} from "@/hooks/use-online";
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
  vehicle: PickupVehicle;
  waitingAreaType?: WaitingAreaType;
  lat: number;
  lng: number;
  passengers: number;
  status: RequestStatus;
};

export const minPickupPassengers = 1;
export const maxPickupPassengers = 10;

export async function getCommuterId() {
  const { session } = await unwrap(authRoutes.getSession());
  if (!session) throw new Error("Sign in again to request a pickup.");
  const { id, email } = session.user;

  const existing: { commuter_id: string } | null = await unwrapCached(
    `commuter:${id}`,
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
let watchingNetwork = false;
let flushingPickupCancellations: Promise<void> | null = null;

const pendingPickupCancellationKey = (userId: string) =>
  `pending-pickup-cancellations:${userId}`;

export const getKnownActivePickup = () => knownActivePickup;

async function deletePickupRequest(requestId: string) {
  await unwrap(pickupRoutes.deletePickup(requestId));
  await unwrap(pickupRoutes.deleteRequest(requestId));
}

async function flushPickupCancellations() {
  if (flushingPickupCancellations || !isOnline()) return;
  flushingPickupCancellations = (async () => {
    const { data } = await getSupabaseClient().auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;

    const key = pendingPickupCancellationKey(userId);
    const requestIds = readCache<string[]>(key) ?? [];
    const remaining: string[] = [];
    for (const requestId of requestIds) {
      try {
        await deletePickupRequest(requestId);
        if (knownActivePickup?.id === requestId) knownActivePickup = null;
      } catch {
        remaining.push(requestId);
      }
    }
    writeCache(key, remaining);
  })().catch(() => {}).finally(() => {
    flushingPickupCancellations = null;
  });
  await flushingPickupCancellations;
}

export async function queuePickupCancellation(
  request: PickupRequest,
): Promise<void> {
  const { data } = await getSupabaseClient().auth.getSession().catch(() => ({
    data: { session: null },
  }));
  const userId = data.session?.user.id;
  if (!userId) return;

  const key = pendingPickupCancellationKey(userId);
  const requestIds = readCache<string[]>(key) ?? [];
  if (!requestIds.includes(request.id)) {
    writeCache(key, [...requestIds, request.id]);
  }
  if (knownActivePickup?.id === request.id) knownActivePickup = null;
  await flushPickupCancellations();
}

function watchAuthChanges() {
  if (watchingAuth) return;
  watchingAuth = true;
  if (!watchingNetwork) {
    watchingNetwork = true;
    subscribeToOnline(() => {
      if (isOnline()) void flushPickupCancellations();
      else if (knownActivePickup) {
        void queuePickupCancellation(knownActivePickup);
      }
    });
  }
  void flushPickupCancellations();
  getSupabaseClient().auth.onAuthStateChange((_event, session) => {
    const userId = session?.user.id ?? null;
    if (userId !== knownUserId) {
      knownUserId = userId;
      knownActivePickup = null;
    }
    if (userId) void flushPickupCancellations();
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
    const row: PickupRequestRow | null = await unwrapCached(
      "active-pickup",
      pickupRoutes.findActiveRequest(commuterId),
    );
    const pickup = Array.isArray(row?.pickup) ? row.pickup[0] : row?.pickup;
    if (!row || !pickup) return null;
    return {
      id: row.request_id,
      pickupName: pickup.pickup_destination,
      vehicle:
        pickup.requested_vehicle_type === "Tricycle" ? "tricy" : "jeep",
      waitingAreaType: getKnownWaitingAreas().find(
        (area) =>
          Math.abs(area.lat - row.device_latitude) < 0.00001 &&
          Math.abs(area.lng - row.device_longitude) < 0.00001,
      )?.type,
      lat: row.device_latitude,
      lng: row.device_longitude,
      passengers: pickup.number_of_passengers,
      status: row.request_status,
    };
  });
}

type PickupPoint = {
  name: string;
  lat: number;
  lng: number;
  waitingAreaType?: WaitingAreaType;
};

type PickupForm = {
  vehicle: PickupVehicle;
  passengers: number;
  location: PickupPoint | null;
  riders: Rider[];
  draftRequestId?: string | null;
};

export async function requestPickup(
  form: PickupForm,
): Promise<Result<PickupRequest>> {
  const { vehicle, passengers, location, riders } = form;

  if (!location) {
    return failure("Select a pickup location so drivers know where to find you.");
  }
  if (passengers < minPickupPassengers || passengers > maxPickupPassengers) {
    return failure(
      `Choose between ${minPickupPassengers} and ${maxPickupPassengers} passengers.`,
    );
  }
  const acceptedRiders = riders.filter(
    (rider) => rider.inviteStatus === "accepted",
  );
  if (acceptedRiders.length + 1 > passengers) {
    return failure(
      `Set the passenger count to at least ${acceptedRiders.length + 1} to include everyone in this shared ride.`,
    );
  }
  if (!(await checkOnline())) {
    return failure(
      "Reconnect to the internet before requesting a pickup.",
    );
  }

  const point = location;

  return attempt(async () => {
    let requestId = form.draftRequestId ?? null;
    if (requestId) {
      const draftId: string | null = await unwrap(
        pickupRoutes.savePickupDraft(
          requestId,
          point.lat,
          point.lng,
          point.name,
          passengers,
          vehicle === "jeep" ? "Jeepney" : "Tricycle",
        ),
      );
      if (!draftId) throw new Error("Your pickup draft could not be saved.");
      requestId = draftId;
      await unwrap(pickupRoutes.publishPickupDraft(requestId));
    } else {
      if (acceptedRiders.length > 0) {
        throw new Error("Send invitations to your accepted companions again.");
      }
      const commuterId = await getCommuterId();
      const request: {
        request_id: string;
        request_status: RequestStatus;
      } | null = await unwrap(
        pickupRoutes.createRequest(commuterId, point.lat, point.lng),
      );
      if (!request) throw new Error("Your pickup request could not be saved.");
      requestId = request.request_id;
      try {
        await unwrap(
          pickupRoutes.createPickup(
            requestId,
            point.name,
            passengers,
            vehicle === "jeep" ? "Jeepney" : "Tricycle",
          ),
        );
      } catch (error) {
        await pickupRoutes.deleteRequest(requestId);
        throw error;
      }
    }

    knownActivePickup = {
      id: requestId,
      pickupName: point.name,
      vehicle,
      waitingAreaType: point.waitingAreaType,
      lat: point.lat,
      lng: point.lng,
      passengers,
      status: "pending",
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
    return failure(
      "A driver has already accepted this pickup, so it can’t be cancelled here.",
    );
  }
  if (!(await checkOnline())) {
    return failure("Reconnect to the internet before cancelling this pickup.");
  }
  return attempt(async () => {
    await deletePickupRequest(request.id);
    knownActivePickup = null;
  });
}

export async function cancelActivePickupBeforeSignOut(): Promise<Result<void>> {
  if (!(await checkOnline())) {
    return failure("Connect to the internet before signing out.");
  }
  const result = await fetchActivePickup();
  if (!result.ok) return result;
  if (!result.data) return success(undefined);
  const request = result.data;
  return attempt(async () => {
    await deletePickupRequest(request.id);
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
  rating: { score: number; feedback: string | null } | null;
  sharedBy: string | null;
};

export function loadBookings(): Promise<Result<Booking[]>> {
  return attempt(async () => {
    const rows: BookingRow[] =
      (await unwrapCached("bookings", pickupRoutes.findMyBookings())) ?? [];
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
      rating:
        row.rating_score === null
          ? null
          : { score: row.rating_score, feedback: row.rating_feedback },
      sharedBy: row.shared_by ?? null,
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
    }[] =
      (await unwrapCached("trip-history", pickupRoutes.findMyTripHistory())) ??
      [];
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

export type Rider = {
  userId: string;
  name: string;
  initials: string;
  picture: string | null;
  inviteStatus?: CompanionStatus;
};

const toRider = (row: RiderRow): Rider => {
  const first = row.first_name?.trim() ?? "";
  const last = row.last_name?.trim() ?? "";
  return {
    userId: row.user_id,
    name: [first, last].filter(Boolean).join(" ") || "Commuter",
    initials: `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?",
    picture: row.profile_picture ?? null,
  };
};

export const maxRiders = maxPickupPassengers - 1;

export function savePickupDraft(
  requestId: string | null,
  location: PickupPoint,
  passengers: number,
  vehicle: PickupVehicle,
): Promise<Result<string>> {
  return attempt(async () => {
    const id: string | null = await unwrap(
      pickupRoutes.savePickupDraft(
        requestId,
        location.lat,
        location.lng,
        location.name,
        passengers,
        vehicle === "jeep" ? "Jeepney" : "Tricycle",
      ),
    );
    if (!id) throw new Error("Your pickup draft could not be saved.");
    return id;
  });
}

export function loadMyPickupDraft(): Promise<Result<PickupDraftRow | null>> {
  return attempt(async () => {
    const data: PickupDraftRow | PickupDraftRow[] | null = await unwrap(
      pickupRoutes.findMyPickupDraft(),
    );
    return Array.isArray(data) ? (data[0] ?? null) : data;
  });
}

export function loadPickupCompanionStatuses(
  requestId: string,
): Promise<Result<Rider[]>> {
  return attempt(async () => {
    const rows: PickupCompanionStatusRow[] =
      (await unwrap(pickupRoutes.findPickupCompanionStatuses(requestId))) ?? [];
    return rows.map((row) => ({
      ...toRider(row),
      inviteStatus: row.companion_status,
    }));
  });
}

export function sendPickupCompanionInvite(
  requestId: string,
  userId: string,
): Promise<Result<void>> {
  return attempt(async () => {
    if (!(await checkOnline())) {
      throw new Error("Reconnect to the internet before sending an invitation.");
    }
    await unwrap(pickupRoutes.addCompanion(requestId, userId));
  });
}

export function removePickupCompanion(
  requestId: string,
  userId: string,
): Promise<Result<number | null>> {
  return attempt(async () => {
    if (!(await checkOnline())) {
      throw new Error("Reconnect to the internet before removing a companion.");
    }
    return (await unwrap(
      pickupRoutes.removePickupCompanion(requestId, userId),
    )) as number | null;
  });
}

export function searchRiders(query: string): Promise<Result<Rider[]>> {
  return attempt(async () => {
    const rows: RiderRow[] =
      (await unwrap(pickupRoutes.searchCommuters(query.trim()))) ?? [];
    return rows.map(toRider);
  });
}

export type ShareInvite = {
  requestId: string;
  from: Rider;
  pickupName: string;
  passengers: number;
  status: RequestStatus;
};

export function loadShareInvites(): Promise<Result<ShareInvite[]>> {
  return attempt(async () => {
    const rows: ShareInviteRow[] =
      (await unwrap(pickupRoutes.findShareInvites())) ?? [];
    return rows.map((row) => ({
      requestId: row.request_id,
      from: toRider({ ...row, user_id: row.request_id }),
      pickupName: row.pickup_destination ?? "their waiting area",
      passengers: row.number_of_passengers ?? 1,
      status: row.request_status,
    }));
  });
}

export function respondToShareInvite(
  requestId: string,
  accept: boolean,
): Promise<Result<number>> {
  return attempt(() =>
    unwrap(pickupRoutes.respondToShareInvite(requestId, accept)),
  );
}
