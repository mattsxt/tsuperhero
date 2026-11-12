import type { Row } from "@/simulation/db";
import { waitingAreas } from "@/simulation/seed/geography";
import {
  commuterId,
  driverId,
  routeByCode,
  sid,
  vehicleId,
} from "@/simulation/seed/people";

const R = 20;
const PK = 21;
const T = 22;
const H = 23;
const RT = 24;
const CR = 25;
const CU = 26;

const area = (name: string): Row => waitingAreas.find((w) => w.area_name === name)!;

const minutes = (base: Date, daysAgo: number, hour: number, plus = 0): string => {
  const d = new Date(base);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, plus, 0, 0);
  return d.toISOString();
};

export const buildHistory = (now: Date) => {
  const request: Row[] = [];
  const pickup: Row[] = [];
  const charter_rental: Row[] = [];
  const charter_rental_unit: Row[] = [];
  const trip: Row[] = [];
  const trip_history: Row[] = [];
  const rating: Row[] = [];
  const notification: Row[] = [];

  const pickups = [
    { n: 1, days: 2, hour: 7, driver: "mario", vehicle: "mario", type: "Jeepney", from: "Rotunda", to: "E-Mall", route: "DEL-CON-MAG-CEN", pax: 1 },
    { n: 2, days: 5, hour: 17, driver: "mario", vehicle: "mario", type: "Jeepney", from: "Gaisano", to: "CBD Terminal", route: "DEL-CON-MAG-CEN", pax: 2 },
    { n: 3, days: 9, hour: 12, driver: "pedro", vehicle: "pedro", type: "Tricycle", from: "City Hall", to: "Park Avenue", route: "NAGA-CITY", pax: 1 },
  ];
  for (const p of pickups) {
    const from = area(p.from);
    const to = area(p.to);
    const requestId = sid(R, p.n);
    const at = minutes(now, p.days, p.hour);
    request.push({
      request_id: requestId,
      commuter_id: commuterId("juan"),
      driver_id: driverId(p.driver),
      request_type: "Pickup",
      request_status: "completed",
      request_date: at,
      device_latitude: from.area_latitude,
      device_longitude: from.area_longitude,
      is_draft: false,
      arrived_at: minutes(now, p.days, p.hour, 4),
      owner_present_at: null,
    });
    pickup.push({
      pickup_id: sid(PK, p.n),
      request_id: requestId,
      vehicle_id: vehicleId(p.vehicle),
      pickup_destination: String(to.area_name),
      pickup_date: at,
      number_of_passengers: p.pax,
      requested_vehicle_type: p.type,
      route_id: routeByCode(p.route),
      pickup_lat: from.area_latitude,
      pickup_lng: from.area_longitude,
      dropoff_name: String(to.area_name),
      dropoff_lat: to.area_latitude,
      dropoff_lng: to.area_longitude,
      boarded_at: minutes(now, p.days, p.hour, 5),
      dropped_at: minutes(now, p.days, p.hour, 19),
      waiting_area_id: from.area_id,
    });
  }

  const rentalRequest = (
    n: number,
    commuter: string,
    status: string,
    driver: string | null,
    vehicle: string | null,
    destination: string,
    pax: number,
    daysAhead: number,
    vehicleType: string,
    unitStatus: string,
  ) => {
    const requestId = sid(R, 100 + n);
    const date = new Date(now);
    date.setDate(date.getDate() + daysAhead);
    request.push({
      request_id: requestId,
      commuter_id: commuterId(commuter),
      driver_id: driver ? driverId(driver) : null,
      request_type: "Charter_Rental",
      request_status: status,
      request_date: new Date(now.getTime() - 3600_000).toISOString(),
      device_latitude: 13.6229,
      device_longitude: 123.1851,
      is_draft: false,
      arrived_at: null,
      owner_present_at: null,
    });
    charter_rental.push({
      rental_id: sid(CR, n),
      request_id: requestId,
      vehicle_id: vehicle ? vehicleId(vehicle) : null,
      rental_destination: destination,
      rental_date: date.toISOString().slice(0, 10),
      number_of_passengers: pax,
      purpose: "Family outing",
      pickup_location: "Centro, Naga City",
      pickup_time: new Date(date.setHours(8, 0, 0, 0)).toISOString(),
      destination_latitude: 13.6217,
      destination_longitude: 123.1948,
      trip_type: "round_trip",
      return_time: new Date(date.setHours(18, 0, 0, 0)).toISOString(),
      notes: null,
      requested_vehicle_type: vehicleType,
    });
    charter_rental_unit.push({
      unit_id: sid(CU, n),
      request_id: requestId,
      position: 1,
      vehicle_type: vehicleType,
      driver_id: driver ? driverId(driver) : null,
      vehicle_id: vehicle ? vehicleId(vehicle) : null,
      status: unitStatus,
      booked_at: driver ? new Date(now.getTime() - 86400_000).toISOString() : null,
    });
  };

  rentalRequest(1, "juan", "completed", "mario", "mario", "Naga Metropolitan Cathedral", 12, -14, "Jeepney", "completed");
  const rated = [
    { n: 4, who: "ana", dest: "Quezon Avenue Church", score: 5, feedback: "Smooth ride and very polite driver.", days: 20 },
    { n: 5, who: "ana", dest: "Naga City People's Mall", score: 5, feedback: null, days: 24 },
    { n: 6, who: "nena", dest: "Bicol University Gate", score: 4, feedback: "Arrived on time, a bit crowded.", days: 28 },
    { n: 7, who: "bong", dest: "Naga Airport Road", score: 5, feedback: null, days: 33 },
    { n: 8, who: "bong", dest: "Panicuason Trail", score: 4, feedback: null, days: 40 },
  ];
  for (const r of rated) {
    rentalRequest(r.n, r.who, "completed", "mario", "mario", r.dest, 10, -r.days, "Jeepney", "completed");
    rating.push({
      rating_id: sid(RT, r.n),
      history_id: null,
      score: r.score,
      feedback: r.feedback,
      rated_at: minutes(now, r.days - 1, 20),
      request_id: sid(R, 100 + r.n),
      driver_id: driverId("mario"),
      tags: [],
    });
  }
  rentalRequest(2, "nena", "pending", null, null, "Camaligan Boat Ride", 18, 3, "Jeepney", "open");
  rentalRequest(3, "bong", "pending", null, null, "Panicuason Hot Spring", 4, 5, "Tricycle", "open");

  const trips = [
    { n: 1, days: 1, hour: 6, dest: "Centro" },
    { n: 2, days: 3, hour: 14, dest: "Del Rosario" },
    { n: 3, days: 6, hour: 7, dest: "Centro" },
    { n: 4, days: 8, hour: 16, dest: "Del Rosario" },
  ];
  for (const t of trips) {
    trip.push({
      trip_id: sid(T, t.n),
      driver_id: driverId("mario"),
      vehicle_id: vehicleId("mario"),
      route_id: routeByCode("DEL-CON-MAG-CEN"),
      trip_date: minutes(now, t.days, t.hour).slice(0, 10),
      trip_status: "completed",
      trip_destination: t.dest,
      departure_time: minutes(now, t.days, t.hour),
      arrival_time: minutes(now, t.days, t.hour, 42),
      trip_code: `T-DEMO-${t.n}`,
      distance_done_km: 8.4,
      distance_total_km: 8.4,
    });
  }

  const reviews = [
    { n: 1, trip: 1, who: "juan", score: 5, feedback: "Smooth ride and very polite driver.", days: 1 },
    { n: 2, trip: 2, who: "ana", score: 5, feedback: null, days: 3 },
    { n: 3, trip: 3, who: "nena", score: 4, feedback: "Arrived on time, a bit crowded.", days: 6 },
    { n: 4, trip: 3, who: "bong", score: 5, feedback: null, days: 6 },
    { n: 5, trip: 4, who: "juan", score: 4, feedback: null, days: 8 },
  ];
  for (const r of reviews) {
    const historyId = sid(H, r.n);
    trip_history.push({
      history_id: historyId,
      commuter_id: commuterId(r.who),
      driver_id: driverId("mario"),
      trip_id: sid(T, r.trip),
      boarded_at: minutes(now, r.days, 7, 5),
    });
  }

  return {
    request,
    pickup,
    charter_rental,
    charter_rental_unit,
    trip,
    trip_history,
    rating,
    notification,
    pickup_companion: [] as Row[],
    ride_emergency: [] as Row[],
  };
};
