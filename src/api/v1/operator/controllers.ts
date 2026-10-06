import type { LocationObjectCoords } from "expo-location";

import {
  operatorRoutes,
  type AssignmentRow,
  type NearbyPickupRow,
  type TripRow,
  type VehicleStatus,
} from "@/api/v1/operator/routes";
import { attempt, unwrap, type Result } from "@/api/v1/result";
import {
  findRoute,
  loadTransitRoutes,
  toVehicleType,
  vehicleTypeLabels,
  type VehicleType,
} from "@/api/v1/transit-routes/controllers";

type Cooperative = { name: string; type: string };

type OperatorVehicle = {
  vehicle_type: VehicleType;
  plate_number: string;
  max_capacity: number;
  verified: boolean;
};

export type OperatorAssignment = {
  cooperative: Cooperative | null;
  vehicle: OperatorVehicle;
  routeId: string | null;
};

export async function loadOperatorAssignment(): Promise<OperatorAssignment | null> {
  try {
    const [row]: [AssignmentRow | null, unknown] = await Promise.all([
      unwrap(operatorRoutes.findMyAssignment()),
      loadTransitRoutes(),
    ]);
    if (!row) return null;

    return {
      cooperative: row.operator
        ? { name: row.operator.name, type: row.operator.operator_type }
        : null,
      vehicle: {
        vehicle_type: toVehicleType(row.vehicle.vehicle_type),
        plate_number: row.vehicle.plate_number,
        max_capacity: row.vehicle.max_capacity,
        verified: row.vehicle.verified_at !== null,
      },
      routeId: row.route_id,
    };
  } catch {
    return null;
  }
}

export type AssignmentDetails = {
  assignment: OperatorAssignment;
  vehicleLabel: string;
  coverageTitle: string;
  route: ReturnType<typeof findRoute>;
};

export function describeAssignment(
  assignment: OperatorAssignment,
): AssignmentDetails {
  const route = findRoute(assignment.routeId);

  return {
    assignment,
    vehicleLabel: vehicleTypeLabels[assignment.vehicle.vehicle_type],
    coverageTitle: route?.name ?? "Unassigned",
    route,
  };
}

export type TripStatus = "idle" | "in-transit" | "loading";

export const tripStatusLabels: Record<TripStatus, string> = {
  idle: "Idle",
  "in-transit": "In Transit",
  loading: "Loading/Unloading",
};

const vehicleStatuses: Record<TripStatus, VehicleStatus> = {
  idle: "idle",
  "in-transit": "on-trip",
  loading: "loading",
};

export function saveTripState(
  status: TripStatus,
  passengers: number,
): Promise<Result<unknown>> {
  return attempt(() =>
    unwrap(
      operatorRoutes.setMyTripState({
        p_status: vehicleStatuses[status],
        p_current_capacity: passengers,
      }),
    ),
  );
}

export function shareLocation({
  latitude,
  longitude,
  speed,
  heading,
}: LocationObjectCoords): Promise<Result<unknown>> {
  return attempt(() =>
    unwrap(
      operatorRoutes.shareMyLocation({
        p_latitude: latitude,
        p_longitude: longitude,
        p_speed_kmh: Math.max(speed ?? 0, 0) * 3.6,
        p_heading: heading != null && heading >= 0 ? heading : 0,
      }),
    ),
  );
}

const metersPerKm = 1_000;

export function startTrip(
  distanceTotalMeters: number,
): Promise<Result<string>> {
  return attempt(() =>
    unwrap(operatorRoutes.startMyTrip(distanceTotalMeters / metersPerKm)),
  );
}

export function endTrip(distanceDoneMeters: number): Promise<Result<unknown>> {
  return attempt(() =>
    unwrap(operatorRoutes.endMyTrip(distanceDoneMeters / metersPerKm)),
  );
}

export type NearbyPickup = {
  id: string;
  lat: number;
  lng: number;
  passengers: number;
  distanceMeters: number;
};

export function loadNearbyPickups(): Promise<Result<NearbyPickup[]>> {
  return attempt(async () => {
    const rows: NearbyPickupRow[] =
      (await unwrap(operatorRoutes.findNearbyPickups())) ?? [];
    return rows.map((row) => ({
      id: row.request_id,
      lat: row.latitude,
      lng: row.longitude,
      passengers: row.passengers,
      distanceMeters: row.distance_m,
    }));
  });
}

export function acceptPickup(requestId: string): Promise<Result<number>> {
  return attempt(() => unwrap(operatorRoutes.acceptPickup(requestId)));
}

export function boardPickup(requestId: string): Promise<Result<number>> {
  return attempt(() => unwrap(operatorRoutes.boardPickup(requestId)));
}

export type TripRecord = {
  id: string;
  code: string;
  inProgress: boolean;
  departedAt: Date | null;
  arrivedAt: Date | null;
  durationMinutes: number | null;
  distanceKm: number;
  routeName: string;
  plateNumber: string | null;
  vehicleType: string | null;
  pickups: number;
};

const toNumber = (value: number | string | null) => Number(value ?? 0) || 0;

export function loadMyTrips(): Promise<Result<TripRecord[]>> {
  return attempt(async () => {
    const rows: TripRow[] = (await unwrap(operatorRoutes.findMyTrips())) ?? [];
    return rows.map((row) => {
      const departedAt = row.departure_time
        ? new Date(row.departure_time)
        : null;
      const arrivedAt = row.arrival_time ? new Date(row.arrival_time) : null;
      const inProgress = row.trip_status === "active";
      const end = arrivedAt ?? (inProgress ? new Date() : null);
      return {
        id: row.trip_id,
        code: row.trip_code,
        inProgress,
        departedAt,
        arrivedAt,
        durationMinutes:
          departedAt && end
            ? Math.max(
                0,
                Math.round((end.getTime() - departedAt.getTime()) / 60_000),
              )
            : null,
        distanceKm: toNumber(row.distance_done_km),
        routeName: row.route_name ?? "Unknown route",
        plateNumber: row.plate_number,
        vehicleType: row.vehicle_type,
        pickups: Number(row.pickups) || 0,
      };
    });
  });
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}
