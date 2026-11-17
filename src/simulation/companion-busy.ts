import { currentUserId } from "@/simulation/auth";
import { db, type Row } from "@/simulation/db";

export type BusyTrip = "pickup" | "rental";

const now = () => db.now();
const iso = () => now().toISOString();
const num = (value: unknown) => (typeof value === "number" ? value : Number(value));

export function companionBusyTrip(commuterId: unknown): BusyTrip | null {
  const time = now().getTime();
  const pickup = db.tables.request.some(
    (request) =>
      request.commuter_id === commuterId &&
      request.request_type === "Pickup" &&
      ["pending", "accepted", "riding"].includes(String(request.request_status)) &&
      ((request.is_draft === false &&
        db.tables.pickup.some((row) => row.request_id === request.request_id)) ||
        db.tables.pickup_companion.some(
          (row) =>
            row.request_id === request.request_id &&
            row.commuter_id === commuterId &&
            row.companion_status === "accepted",
        )),
  );
  if (pickup) return "pickup";

  const rental = db.tables.request.some((request) => {
    if (
      request.commuter_id !== commuterId ||
      request.request_type !== "Charter_Rental" ||
      !["pending", "accepted"].includes(String(request.request_status))
    )
      return false;
    const details = db.tables.charter_rental.find(
      (row) => row.request_id === request.request_id,
    );
    if (!details) return false;
    const end = new Date(
      String(details.return_time ?? details.pickup_time ?? details.rental_date),
    ).getTime();
    return request.request_status === "pending" ? end > time : end + 12 * 3_600_000 > time;
  });
  return rental ? "rental" : null;
}

const emitInsert = (table: "request" | "pickup" | "charter_rental" | "charter_rental_unit", row: Row) => {
  db.tables[table].push(row);
  db.emit({ table, type: "INSERT", row });
};

export function markCompanionBusy(
  requestId: string,
  commuterId: string,
  kind: BusyTrip = "pickup",
): boolean {
  const mine = db.tables.commuter.find(
    (row) => row.user_id === currentUserId(),
  )?.commuter_id;
  const request = db.tables.request.find(
    (row) => row.request_id === requestId && !!mine && row.commuter_id === mine,
  );
  const companion = db.tables.pickup_companion.find(
    (row) =>
      row.request_id === requestId &&
      row.commuter_id === commuterId &&
      row.companion_status === "pending",
  );
  if (!request || request.request_status !== "pending" || !companion) return false;
  if (companionBusyTrip(commuterId)) return false;
  const id = db.id();
  Object.assign(companion, {
    busy_trip: kind,
    busy_request_id: id,
  });
  db.emit({ table: "pickup_companion", type: "UPDATE", row: companion });

  const invitePickup = db.tables.pickup.find((row) => row.request_id === requestId);
  const latitude = num(invitePickup?.pickup_lat ?? request.device_latitude ?? 13.6244);
  const longitude = num(invitePickup?.pickup_lng ?? request.device_longitude ?? 123.20293);
  const activeArea = db.tables.waiting_area.find((row) => row.is_active);
  const destination = String(activeArea?.area_name ?? "Centro, Naga City");
  const createdAt = iso();

  if (kind === "pickup") {
    emitInsert("request", {
      request_id: id,
      commuter_id: commuterId,
      driver_id: null,
      request_type: "Pickup",
      request_status: "pending",
      request_date: createdAt,
      device_latitude: latitude,
      device_longitude: longitude,
      is_draft: false,
      arrived_at: createdAt,
      owner_present_at: createdAt,
    });
    emitInsert("pickup", {
      pickup_id: db.id(),
      request_id: id,
      vehicle_id: null,
      pickup_destination: destination,
      pickup_date: createdAt,
      number_of_passengers: 1,
      requested_vehicle_type: "Jeepney",
      route_id: null,
      pickup_lat: latitude,
      pickup_lng: longitude,
      dropoff_name: null,
      dropoff_lat: null,
      dropoff_lng: null,
      boarded_at: null,
      dropped_at: null,
      waiting_area_id: activeArea?.area_id ?? null,
    });
    return true;
  }

  const pickupAt = new Date(now().getTime() + 86_400_000);
  const pickupTime = pickupAt.toISOString();
  emitInsert("request", {
    request_id: id,
    commuter_id: commuterId,
    driver_id: null,
    request_type: "Charter_Rental",
    request_status: "pending",
    request_date: createdAt,
    device_latitude: latitude,
    device_longitude: longitude,
    is_draft: false,
    arrived_at: null,
    owner_present_at: null,
  });
  emitInsert("charter_rental", {
    rental_id: db.id(),
    request_id: id,
    vehicle_id: null,
    rental_destination: destination,
    rental_date: pickupTime.slice(0, 10),
    number_of_passengers: 1,
    purpose: "Demo trip",
    pickup_location: destination,
    pickup_time: pickupTime,
    destination_latitude: latitude,
    destination_longitude: longitude,
    trip_type: "one_way",
    return_time: null,
    notes: null,
    requested_vehicle_type: "Jeepney",
  });
  emitInsert("charter_rental_unit", {
    unit_id: db.id(),
    request_id: id,
    position: 1,
    vehicle_type: "Jeepney",
    driver_id: null,
    vehicle_id: null,
    status: "open",
    booked_at: null,
  });
  return true;
}

export function resetCompanionBusy(commuterId: unknown): void {
  const marked = db.tables.pickup_companion.filter(
    (row) => row.commuter_id === commuterId && row.busy_trip != null,
  );

  for (const companion of marked) {
    const requestId = companion.busy_request_id;
    delete companion.busy_trip;
    delete companion.busy_request_id;
    delete companion.responded_at;
    db.emit({ table: "pickup_companion", type: "UPDATE", row: companion });

    if (typeof requestId !== "string") continue;
    for (const table of ["pickup", "charter_rental", "charter_rental_unit", "request"] as const) {
      const rows = db.tables[table];
      for (let index = rows.length - 1; index >= 0; index--) {
        const row = rows[index];
        if (row.request_id !== requestId) continue;
        rows.splice(index, 1);
        db.emit({ table, type: "DELETE", row });
      }
    }
  }
}

export function resetAllCompanionBusy(): number {
  const marked = db.tables.pickup_companion.filter((row) => row.busy_trip != null);
  const commuters = new Set(marked.map((row) => row.commuter_id));
  for (const commuterId of commuters) resetCompanionBusy(commuterId);
  return marked.length;
}

export function hasBusyCompanions(): boolean {
  return db.tables.pickup_companion.some((row) => row.busy_trip != null);
}
