import { authRoutes } from "@/api/v1/auth/routes";
import { pickupRoutes } from "@/api/v1/pickups/routes";
import type { PickupRequestRow, RequestStatus } from "@/api/v1/pickups/types";
import { attempt, failure, unwrap, type Result } from "@/api/v1/result";

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

export const pickupStatusLabels: Record<RequestStatus, string> = {
  pending: "Waiting for a driver",
  accepted: "Driver on the way",
  rejected: "Rejected",
  completed: "Completed",
};

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

export async function loadActivePickup(): Promise<
  Result<PickupRequest | null>
> {
  return attempt(async () => {
    const commuterId = await getCommuterId();
    const row: PickupRequestRow | null = await unwrap(
      pickupRoutes.findActiveRequest(commuterId),
    );
    const pickup = Array.isArray(row?.pickups) ? row.pickups[0] : row?.pickups;
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

export type PickupForm = {
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

    return {
      id: request.request_id,
      pickupName: point.name,
      lat: point.lat,
      lng: point.lng,
      passengers,
      status: request.request_status,
    };
  });
}

export const canCancelPickup = (request: PickupRequest) =>
  request.status === "accepted";

export async function cancelPickup(
  request: PickupRequest,
): Promise<Result<void>> {
  if (!canCancelPickup(request)) {
    return failure("You can cancel once a driver accepts your request.");
  }
  return attempt(async () => {
    await unwrap(pickupRoutes.deletePickup(request.id));
    await unwrap(pickupRoutes.deleteRequest(request.id));
  });
}
