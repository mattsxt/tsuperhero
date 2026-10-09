import { getSupabaseClient } from "@/api/v1/client";

export type RentalVehicleType = "Van" | "Jeepney" | "Bus";

export type RentalDriverRow = {
  driver_id: string;
  vehicle_id: string;
  driver_name: string;
  years_of_experience: number | null;
  plate_number: string;
  vehicle_type: string;
  max_capacity: number;
  is_modern: boolean;
  cooperative_name: string | null;
};

export type RentalRow = {
  request_id: string;
  status: "pending" | "accepted" | "rejected" | "completed";
  requested_at: string;
  pickup_location: string | null;
  pickup_latitude: number;
  pickup_longitude: number;
  destination: string;
  pickup_time: string;
  trip_type: "one_way" | "round_trip";
  return_time: string | null;
  purpose: string;
  passengers: number;
  notes: string | null;
  plate_number: string | null;
  vehicle_type: string | null;
  driver_name: string | null;
  driver_contact: string | null;
  commuter_name: string | null;
  commuter_contact: string | null;
  rating_score: number | null;
  rating_feedback: string | null;
};

export type RentalRequestParams = {
  p_driver_id: string;
  p_pickup_location: string;
  p_pickup_latitude: number;
  p_pickup_longitude: number;
  p_destination: string;
  p_destination_latitude: number;
  p_destination_longitude: number;
  p_pickup_time: string;
  p_trip_type: "one_way" | "round_trip";
  p_return_time: string | null;
  p_purpose: string;
  p_passengers: number;
  p_notes: string | null;
};

const rpc = () => getSupabaseClient();

export const rentalRoutes = {
  findDrivers: (
    vehicleType: RentalVehicleType,
    passengers: number,
    pickupTime: string,
    returnTime: string | null,
  ) =>
    rpc().rpc("find_rental_drivers", {
      p_vehicle_type: vehicleType,
      p_passengers: passengers,
      p_pickup_time: pickupTime,
      p_return_time: returnTime,
    }),

  request: (params: RentalRequestParams) =>
    rpc().rpc("request_charter_rental", params),

  listMine: () => rpc().rpc("get_my_rentals"),

  cancel: (requestId: string) =>
    rpc().rpc("cancel_my_rental", { p_request_id: requestId }),

  listForDriver: () => rpc().rpc("get_my_rental_requests"),

  respond: (requestId: string, accept: boolean) =>
    rpc().rpc("respond_to_rental", {
      p_request_id: requestId,
      p_accept: accept,
    }),

  complete: (requestId: string) =>
    rpc().rpc("complete_rental", { p_request_id: requestId }),
};
