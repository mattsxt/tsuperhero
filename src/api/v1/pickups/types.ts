export type RequestStatus = "pending" | "accepted" | "rejected" | "completed";

export type PickupRow = {
  pickup_id: string;
  pickup_destination: string;
  number_of_passengers: number;
};

export type PickupRequestRow = {
  request_id: string;
  request_status: RequestStatus;
  device_latitude: number;
  device_longitude: number;
  pickup: PickupRow[] | PickupRow | null;
};
