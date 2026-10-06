export type RequestStatus = "pending" | "accepted" | "rejected" | "completed";

export type PickupRow = {
  pickup_id: string;
  pickup_destination: string;
  number_of_passengers: number;
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
  request_id: string;
  request_status: RequestStatus;
  device_latitude: number;
  device_longitude: number;
  pickup: PickupRow[] | PickupRow | null;
};
