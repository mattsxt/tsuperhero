import { getSupabaseClient } from "@/api/v1/client";

export type VehicleStatus = "on-trip" | "loading" | "idle" | "offline";

export type AssignmentRow = {
  role: "driver" | "conductor";
  vehicle: {
    vehicle_id: string;
    plate_number: string;
    vehicle_type: "Bus" | "Jeepney" | "Tricycle" | "Van";
    vehicle_status: VehicleStatus;
    max_capacity: number;
    is_modern: boolean;
    documents_checked: string[] | null;
    verified_at: string | null;
  };
  operator: { operator_type: string; name: string } | null;
  route_id: string | null;
};

export type TripStateParams = {
  p_status: VehicleStatus;
  p_current_capacity: number;
};

export type LocationParams = {
  p_latitude: number;
  p_longitude: number;
  p_speed_kmh: number;
  p_heading: number;
};

export type NearbyPickupRow = {
  request_id: string;
  latitude: number;
  longitude: number;
  passengers: number;
  distance_m: number;
};

export const operatorRoutes = {
  findMyAssignment: () => getSupabaseClient().rpc("get_my_vehicle_assignment"),
  setMyTripState: (params: TripStateParams) =>
    getSupabaseClient().rpc("set_my_vehicle_trip_state", params),
  shareMyLocation: (params: LocationParams) =>
    getSupabaseClient().rpc("share_my_vehicle_location", params),
  startMyTrip: (distanceTotalKm: number) =>
    getSupabaseClient().rpc("start_my_trip", {
      p_distance_total_km: distanceTotalKm,
    }),
  endMyTrip: (distanceDoneKm: number) =>
    getSupabaseClient().rpc("end_my_trip", {
      p_distance_done_km: distanceDoneKm,
    }),
  findNearbyPickups: () => getSupabaseClient().rpc("get_my_nearby_pickups"),
  acceptPickup: (requestId: string) =>
    getSupabaseClient().rpc("accept_pickup_request", {
      p_request_id: requestId,
    }),
};
