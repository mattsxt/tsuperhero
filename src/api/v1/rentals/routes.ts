import { getSupabaseClient } from "@/api/v1/client";

export type RentalVehicleType = "Van" | "Jeepney" | "Bus" | "Tricycle";

export type RentalUnitRow = {
  unit_id: string;
  vehicle_type: string;
  status: "open" | "booked" | "completed";
  is_mine: boolean;
  driver_name: string | null;
  plate_number: string | null;
  driver_contact: string | null;
  driver_id?: string | null;
  /** The commuter's rating for this driver, once rated. */
  my_score?: number | null;
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
  driver_assigned?: boolean;
  requested_vehicle_type?: string | null;
  schedule_conflict?: boolean;
  units?: RentalUnitRow[];
  unit_id?: string;
  unit_vehicle_type?: string;
};

export type RentalPostParams = {
  p_vehicles: RentalVehicleType[];
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
  post: (params: RentalPostParams) => rpc().rpc("post_charter_rental", params),

  listMine: () => rpc().rpc("get_my_rentals"),

  cancel: (requestId: string) =>
    rpc().rpc("cancel_my_rental", { p_request_id: requestId }),

  listForDriver: () => rpc().rpc("get_my_rental_requests"),

  jobBoard: () => rpc().rpc("get_rental_job_board"),

  acceptJob: (unitId: string) =>
    rpc().rpc("accept_rental_job", { p_unit_id: unitId }),

  getMine: (requestId: string) =>
    rpc().rpc("get_my_rental", { p_request_id: requestId }),

  removeDriver: (unitId: string) =>
    rpc().rpc("remove_rental_driver", { p_unit_id: unitId }),

  rateDriver: (
    requestId: string,
    driverId: string,
    score: number,
    feedback: string | null,
    tags: string[],
  ) =>
    rpc().rpc("rate_rental_driver", {
      p_request_id: requestId,
      p_driver_id: driverId,
      p_score: score,
      p_feedback: feedback,
      p_tags: tags,
    }),

  dismissJob: (requestId: string) =>
    rpc().rpc("dismiss_rental_job", { p_request_id: requestId }),

  respond: (requestId: string, accept: boolean) =>
    rpc().rpc("respond_to_rental", {
      p_request_id: requestId,
      p_accept: accept,
    }),

  complete: (requestId: string) =>
    rpc().rpc("complete_rental", { p_request_id: requestId }),
};
