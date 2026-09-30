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

export const sampleTransitTrips: TransitTrip[] = [
  {
    id: "t1",
    kind: "regular",
    from: { city: "Naga City", place: "Central Terminal" },
    to: { city: "Pili", place: "Pili Terminal" },
    date: "Jul 1, 2026",
    startTime: "6:30 AM",
    endTime: "7:18 AM",
    durationMinutes: 48,
    passengers: 18,
    vehicle: "jeep",
    plate: "JPA-101",
  },
  {
    id: "t2",
    kind: "regular",
    from: { city: "Pili", place: "Pili Terminal" },
    to: { city: "Naga City", place: "Central Terminal" },
    date: "Jul 1, 2026",
    startTime: "7:40 AM",
    endTime: "8:35 AM",
    durationMinutes: 55,
    passengers: 24,
    vehicle: "jeep",
    plate: "JPA-101",
  },
  {
    id: "t3",
    kind: "rental",
    from: { city: "Naga City", place: "SM City Naga" },
    to: { city: "Legazpi City", place: "Cagsawa Ruins" },
    date: "Jun 27, 2026",
    startTime: "5:00 AM",
    endTime: "7:40 PM",
    durationMinutes: 880,
    passengers: 12,
    vehicle: "van",
    plate: "NAB 4821",
  },
  {
    id: "t4",
    kind: "regular",
    from: { city: "Naga City", place: "Central Terminal" },
    to: { city: "Canaman", place: "Canaman Terminal" },
    date: "Jun 26, 2026",
    startTime: "9:10 AM",
    endTime: "9:32 AM",
    durationMinutes: 22,
    passengers: 15,
    vehicle: "jeep",
    plate: "JPA-101",
  },
  {
    id: "t5",
    kind: "regular",
    from: { city: "Naga City", place: "Central Terminal" },
    to: { city: "Camaligan", place: "Camaligan Terminal" },
    date: "Jun 23, 2026",
    startTime: "3:15 PM",
    endTime: "3:41 PM",
    durationMinutes: 26,
    passengers: 21,
    vehicle: "jeep",
    plate: "JPA-101",
  },
  {
    id: "t6",
    kind: "rental",
    from: { city: "Naga City", place: "Ateneo de Naga" },
    to: { city: "Caramoan", place: "Guijalo Port" },
    date: "Jun 20, 2026",
    startTime: "4:30 AM",
    endTime: "9:05 AM",
    durationMinutes: 275,
    passengers: 10,
    vehicle: "van",
    plate: "NAB 4821",
  },
];

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

export const sampleRentalRequests: RentalRequest[] = [
  {
    id: "r1",
    commuter: "Maria Santos",
    requestedAgo: "15 min ago",
    occasion: "Family Trip",
    tripType: "Round trip",
    pickup: { city: "Naga City", place: "Magsaysay Avenue" },
    destination: { city: "Legazpi City", place: "Cagsawa Ruins" },
    date: "Oct 4, 2026",
    pickupTime: "5:00 AM",
    returnDate: "Oct 5, 2026",
    passengers: 11,
    vehicle: "van",
    notes: "We have 3 kids and a few coolers. Please bring extra space for luggage.",
    status: "pending",
  },
  {
    id: "r2",
    commuter: "Jose Rizal Dimaculangan",
    requestedAgo: "1 hr ago",
    occasion: "Field Trip",
    tripType: "One-way",
    pickup: { city: "Naga City", place: "Camarines Sur National High School" },
    destination: { city: "Pili", place: "Provincial Capitol" },
    date: "Oct 8, 2026",
    pickupTime: "7:30 AM",
    passengers: 14,
    vehicle: "van",
    status: "pending",
  },
  {
    id: "r3",
    commuter: "Ana Villareal",
    requestedAgo: "3 hr ago",
    occasion: "Wedding",
    tripType: "One-way",
    pickup: { city: "Naga City", place: "Naga Metropolitan Cathedral" },
    destination: { city: "Pili", place: "Villa Caceres Hotel" },
    date: "Oct 12, 2026",
    pickupTime: "2:00 PM",
    passengers: 12,
    vehicle: "van",
    notes: "We'll bring our own ribbons to decorate the van.",
    status: "pending",
  },
  {
    id: "r4",
    commuter: "Carlos Mendoza",
    requestedAgo: "Yesterday",
    occasion: "Company Event",
    tripType: "Round trip",
    pickup: { city: "Naga City", place: "SM City Naga" },
    destination: { city: "Caramoan", place: "Guijalo Port" },
    date: "Oct 2, 2026",
    pickupTime: "4:00 AM",
    returnDate: "Oct 3, 2026",
    passengers: 13,
    vehicle: "van",
    status: "accepted",
  },
  {
    id: "r5",
    commuter: "Liza Ramos",
    requestedAgo: "2 days ago",
    occasion: "Outing",
    tripType: "One-way",
    pickup: { city: "Naga City", place: "Plaza Rizal" },
    destination: { city: "Calabanga", place: "Sabang Beach" },
    date: "Sep 29, 2026",
    pickupTime: "6:00 AM",
    passengers: 8,
    vehicle: "van",
    status: "declined",
  },
];

export type CommuterRating = {
  id: string;
  commuter: string;
  stars: number;
  comment?: string;
  date: string;
  trip: string;
};

export const sampleRatings: CommuterRating[] = [
  {
    id: "g1",
    commuter: "Maria Santos",
    stars: 5,
    comment: "Very safe driver and waited for us at the terminal. Thank you!",
    date: "Jul 1, 2026",
    trip: "Naga City – Pili",
  },
  {
    id: "g2",
    commuter: "Paolo Reyes",
    stars: 4,
    comment: "Smooth ride, though the music was a little loud.",
    date: "Jul 1, 2026",
    trip: "Pili – Naga City",
  },
  {
    id: "g3",
    commuter: "Carlos Mendoza",
    stars: 5,
    comment: "Great for our company outing. Very accommodating with our stops.",
    date: "Jun 27, 2026",
    trip: "Naga City – Legazpi City",
  },
  {
    id: "g4",
    commuter: "Jenny Lopez",
    stars: 4,
    date: "Jun 26, 2026",
    trip: "Naga City – Canaman",
  },
  {
    id: "g5",
    commuter: "Ramon Cruz",
    stars: 3,
    comment: "Arrived a bit late at the pickup point.",
    date: "Jun 23, 2026",
    trip: "Naga City – Camaligan",
  },
];

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
