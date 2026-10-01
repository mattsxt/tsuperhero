import type { VehicleType } from "@/api/v1/transit-routes/controllers";

type Stop = { city: string; place: string };

export type TransitTrip = {
  id: string;
  kind: "regular" | "rental";
  from: Stop;
  to: Stop;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  passengers: number;
  vehicle: VehicleType;
  plate: string;
};

export type RentalStatus = "pending" | "accepted" | "declined";

export type RentalRequest = {
  id: string;
  commuter: string;
  requestedAgo: string;
  occasion: string;
  tripType: "One-way" | "Round trip";
  pickup: Stop;
  destination: Stop;
  date: string;
  pickupTime: string;
  returnDate?: string;
  passengers: number;
  vehicle: VehicleType;
  notes?: string;
  status: RentalStatus;
};

export type CommuterRating = {
  id: string;
  commuter: string;
  stars: number;
  comment?: string;
  date: string;
  trip: string;
};

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
