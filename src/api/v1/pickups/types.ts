export type RequestStatus = "pending" | "accepted" | "rejected" | "completed";
export type CompanionStatus = "pending" | "accepted" | "rejected";

export type PickupDraftRow = {
  request_id: string;
  device_latitude: number;
  device_longitude: number;
  pickup_destination: string;
  number_of_passengers: number;
  requested_vehicle_type: "Jeepney" | "Tricycle";
};

export type PickupCompanionStatusRow = RiderRow & {
  companion_status: CompanionStatus;
  arrived?: boolean | null;
};

export type PickupRow = {
  pickup_id: string;
  pickup_destination: string;
  number_of_passengers: number;
  requested_vehicle_type: "Jeepney" | "Tricycle";
};

export type BookingRow = {
  request_id: string;
  request_type: "Pickup" | "Charter_Rental";
  request_date: string;
  destination: string | null;
  passengers: number | null;
  rental_date: string | null;
  purpose: string | null;
  plate_number: string | null;
  vehicle_type: string | null;
  driver_name: string | null;
  rating_score: number | null;
  rating_feedback: string | null;
  /** Rentals: hired drivers, and how many the commuter has rated. */
  drivers_total?: number;
  drivers_rated?: number;
  /** Pickups: the requester and accepted companions. */
  riders?: (RiderRow & { is_owner: boolean; is_me: boolean })[] | null;
  drivers?: (Omit<RiderRow, "user_id"> & {
    driver_id: string;
    vehicle_type: string | null;
    plate_number: string | null;
    score: number | null;
  })[];
  shared_by: string | null;
};

export type RiderRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture?: string | null;
};

export type ShareInviteRow = Omit<RiderRow, "user_id"> & {
  request_id: string;
  pickup_destination: string | null;
  number_of_passengers: number | null;
  request_status: RequestStatus;
  added_at: string;
  latitude?: number | null;
  longitude?: number | null;
  location_changed?: boolean | null;
};

export type PickupDriverRow = {
  request_id: string;
  plate_number: string;
  vehicle_type: string;
  vehicle_status: string;
  max_capacity: number;
  current_capacity: number;
  occupancy_level: number;
  location: {
    latitude: number;
    longitude: number;
    speed_kmh: number;
    recorded_at: string;
  } | null;
};

export type PickupRequestRow = {
  arrived_at?: string | null;
  request_id: string;
  request_status: RequestStatus;
  device_latitude: number;
  device_longitude: number;
  pickup: PickupRow[] | PickupRow | null;
};

export type SharedRideRow = {
  request_id: string;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_picture: string | null;
  pickup_destination: string;
  latitude: number;
  longitude: number;
  passengers: number;
  vehicle_type: "Jeepney" | "Tricycle";
  request_status: RequestStatus;
  is_draft: boolean;
  plate_number: string | null;
  owner_arrived?: boolean | null;
  me_arrived?: boolean | null;
};
