import { currentUserId } from "@/simulation/auth";
import { db, type Row } from "@/simulation/db";
import { notify } from "@/simulation/rpc/notify";
import {
  distanceToPath,
  getDistanceMeters,
  type LatLngPair,
} from "@/utils/geo";

type PickupTable = "request" | "pickup" | "pickup_companion";

const fail = (message: string, code = "22023"): never => {
  throw Object.assign(new Error(message), { code });
};

const iso = () => db.now().toISOString();
const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
const uid = (): string => currentUserId() ?? "";
const timeOf = (v: unknown) => new Date(String(v)).getTime();

const commuterOf = (userId: unknown) =>
  db.tables.commuter.find((c) => c.user_id === userId);
const myCommuterId = () => commuterOf(uid())?.commuter_id as string | undefined;
const commuterUserId = (commuterId: unknown) =>
  db.tables.commuter.find((c) => c.commuter_id === commuterId)?.user_id;
const profileOf = (userId: unknown) =>
  db.tables.profile.find((p) => p.user_id === userId);
const profileByCommuter = (commuterId: unknown) =>
  profileOf(commuterUserId(commuterId));
const requestOf = (id: unknown) =>
  db.tables.request.find((r) => r.request_id === id);
const pickupOf = (id: unknown) =>
  db.tables.pickup.find((p) => p.request_id === id);
const companionsOf = (id: unknown) =>
  db.tables.pickup_companion.filter((c) => c.request_id === id);
const vehicleOf = (id: unknown) =>
  db.tables.vehicle.find((v) => v.vehicle_id === id);
const locationOf = (vehicleId: unknown) =>
  db.tables.location_records.find((l) => l.vehicle_id === vehicleId);
const statusOf = (r: Row) => String(r.request_status);
const livePickupStatus = (r: Row | undefined, statuses: string[]) =>
  !!r && r.request_type === "Pickup" && statuses.includes(statusOf(r));

const live = ["pending", "accepted", "riding"];
const open = ["pending", "accepted"];

const patch = (table: PickupTable, row: Row, values: Row) => {
  Object.assign(row, values);
  db.emit({ table, type: "UPDATE", row });
};

const insert = (table: PickupTable, row: Row) => {
  db.tables[table].push(row);
  db.emit({ table, type: "INSERT", row });
};

const fullName = (p?: Row) => {
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
  return name || null;
};

const nameOf = (userId: unknown, fallback: string) =>
  String(profileOf(userId)?.first_name || "") || fallback;

const driverProfile = (driverIdValue: unknown) => {
  const driver = db.tables.driver.find((d) => d.driver_id === driverIdValue);
  const personnel = db.tables.transit_personnel.find(
    (p) => p.personnel_id === driver?.personnel_id,
  );
  return profileOf(personnel?.user_id);
};

const acceptedCompanion = (requestId: unknown, commuterId: unknown) =>
  companionsOf(requestId).find(
    (c) => c.commuter_id === commuterId && c.companion_status === "accepted",
  );

const notifyAcceptedCompanions = (
  requestId: unknown,
  type: string,
  title: string,
  body: string,
) => {
  for (const c of companionsOf(requestId)) {
    if (c.companion_status === "accepted")
      notify(commuterUserId(c.commuter_id), type, title, body, {
        request_id: requestId,
      });
  }
};

export const setRequestStatus = (requestId: string, status: string): void => {
  const request = requestOf(requestId);
  if (!request) return;
  const old = statusOf(request);
  if (old === status) return;
  request.request_status = status;
  db.emit({ table: "request", type: "UPDATE", row: request });

  const data = { request_id: requestId };
  const ownerId = commuterUserId(request.commuter_id);
  if (request.request_type === "Pickup") {
    const pickup = pickupOf(requestId);
    const dropoff = (pickup?.dropoff_name ?? pickup?.pickup_destination ?? null) as
      | string
      | null;
    const driver = db.tables.driver.find((d) => d.driver_id === request.driver_id);
    const plate = driver
      ? (vehicleOf(driver.vehicle_id)?.plate_number as string | undefined)
      : undefined;
    if (old === "pending" && status === "accepted") {
      notify(
        ownerId,
        "pickup_accepted",
        "Driver on the way",
        plate
          ? `${plate} accepted your pickup request.`
          : "A driver accepted your pickup request.",
        data,
      );
      notifyAcceptedCompanions(
        requestId,
        "shared_pickup_accepted",
        "Driver on the way",
        plate
          ? `${plate} accepted your shared pickup.`
          : "A driver accepted your shared pickup.",
      );
    } else if (old === "accepted" && (status === "riding" || status === "completed")) {
      const activeTrip = db.tables.trip
        .filter(
          (t) => t.vehicle_id === pickup?.vehicle_id && t.trip_status === "active",
        )
        .sort((x, y) => timeOf(y.departure_time) - timeOf(x.departure_time))[0];
      if (activeTrip && request.driver_id) {
        for (const c of companionsOf(requestId)) {
          if (c.companion_status !== "accepted") continue;
          const history = {
            history_id: db.id(),
            commuter_id: c.commuter_id,
            driver_id: request.driver_id,
            trip_id: activeTrip.trip_id,
            boarded_at: iso(),
          };
          db.tables.trip_history.push(history);
          db.emit({ table: "trip_history", type: "INSERT", row: history });
        }
      }
      notify(
        ownerId,
        "pickup_boarded",
        "You're on board!",
        status === "riding" && dropoff
          ? `You're on board, heading to ${dropoff}.`
          : "Your driver picked you up. Enjoy the ride!",
        data,
      );
      notifyAcceptedCompanions(
        requestId,
        "shared_pickup_boarded",
        "You're on board!",
        dropoff
          ? `You're on board, heading to ${dropoff}.`
          : "Your shared ride picked you up. Enjoy the ride!",
      );
    } else if (old === "riding" && status === "completed") {
      notify(
        ownerId,
        "pickup_completed",
        "You've arrived",
        dropoff ? `You were dropped off at ${dropoff}.` : "Your ride is complete.",
        data,
      );
      notifyAcceptedCompanions(
        requestId,
        "shared_pickup_completed",
        "You've arrived",
        dropoff
          ? `You were dropped off at ${dropoff}.`
          : "Your shared ride is complete.",
      );
    } else if (old === "accepted" && status === "pending") {
      notify(
        ownerId,
        "pickup_released",
        "Looking for another driver",
        "Your driver couldn't reach you, so your request is open to other drivers again.",
        data,
      );
      notifyAcceptedCompanions(
        requestId,
        "shared_pickup_released",
        "Looking for another driver",
        "The driver couldn't reach your shared pickup, so it's open to other drivers again.",
      );
    } else if (status === "rejected") {
      notify(
        ownerId,
        "pickup_rejected",
        "Pickup request declined",
        "Your pickup request was declined. You can request another pickup.",
        data,
      );
    }
    return;
  }
  const rental = db.tables.charter_rental.find((r) => r.request_id === requestId);
  const destination = (rental?.rental_destination as string | undefined) ?? "your trip";
  if (status === "accepted")
    notify(
      ownerId,
      "rental_accepted",
      "Rental request accepted",
      `A driver accepted your rental to ${destination}.`,
      data,
    );
  else if (status === "rejected")
    notify(
      ownerId,
      "rental_declined",
      "Rental request declined",
      `Your rental to ${destination} was declined.`,
      data,
    );
  else if (status === "completed")
    notify(
      ownerId,
      "rental_completed",
      "Rental completed",
      `Your rental to ${destination} is complete.`,
      data,
    );
};

const pickupArrivalRadius = (requestId: unknown): number => {
  const area = db.tables.waiting_area.find(
    (a) => a.area_id === pickupOf(requestId)?.waiting_area_id,
  );
  return (area ? num(area.request_radius_m) : 60) + 15;
};

const pathsOf = (route: Row): LatLngPair[][] => {
  const out: LatLngPair[][] = [];
  if (Array.isArray(route.path) && route.path.length)
    out.push(route.path as LatLngPair[]);
  const alt = route.alternative_paths;
  if (Array.isArray(alt) && alt.length) {
    if (Array.isArray(alt[0]) && Array.isArray((alt[0] as unknown[])[0]))
      out.push(...(alt as LatLngPair[][]));
    else out.push(alt as LatLngPair[]);
  }
  return out;
};

export const routeFitsPoints = (
  routeId: unknown,
  a: [number, number],
  b: [number, number],
  tolerance: number,
): boolean => {
  const route = db.tables.route.find((r) => r.route_id === routeId);
  if (!route) return false;
  return pathsOf(route).some(
    (path) =>
      distanceToPath({ lat: a[0], lng: a[1] }, path) <= tolerance &&
      distanceToPath({ lat: b[0], lng: b[1] }, path) <= tolerance,
  );
};

const meters = (lat1: number, lng1: number, lat2: number, lng2: number) =>
  getDistanceMeters({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });

const pickupPoint = (request: Row): [number, number] => {
  const pickup = pickupOf(request.request_id);
  return [
    num(pickup?.pickup_lat ?? request.device_latitude),
    num(pickup?.pickup_lng ?? request.device_longitude),
  ];
};

export const tryBroadcastPickup = (requestId: string): string | null => {
  const request = requestOf(requestId);
  if (
    !request ||
    request.request_type !== "Pickup" ||
    request.request_status !== "pending" ||
    request.is_draft
  )
    return null;
  if (request.arrived_at) return String(request.arrived_at);
  if (
    !request.owner_present_at ||
    companionsOf(requestId).some(
      (c) => c.companion_status === "accepted" && !c.arrived_at,
    )
  )
    return null;
  const at = iso();
  patch("request", request, { arrived_at: at });
  const pickup = pickupOf(requestId);
  const [lat, lng] = pickupPoint(request);
  const notified = new Set<string>();
  for (const loc of db.tables.location_records) {
    const vehicle = vehicleOf(loc.vehicle_id);
    if (!vehicle || String(vehicle.vehicle_type) !== pickup?.requested_vehicle_type)
      continue;
    if (!["on-trip", "loading"].includes(String(vehicle.vehicle_status))) continue;
    if (timeOf(loc.recorded_at) <= db.now().getTime() - 60_000) continue;
    const trip = db.tables.trip
      .filter((t) => t.vehicle_id === vehicle.vehicle_id && t.trip_status === "active")
      .sort((x, y) => timeOf(y.departure_time) - timeOf(x.departure_time))[0];
    if (pickup?.route_id && pickup.route_id !== trip?.route_id) continue;
    if (
      meters(lat, lng, num(loc.records_latitude), num(loc.records_longitude)) > 300
    )
      continue;
    for (const d of db.tables.driver.filter((x) => x.vehicle_id === vehicle.vehicle_id)) {
      const crewUserId = String(
        db.tables.transit_personnel.find((p) => p.personnel_id === d.personnel_id)
          ?.user_id ?? "",
      );
      if (!crewUserId || notified.has(crewUserId)) continue;
      notified.add(crewUserId);
      const pax = num(pickup?.number_of_passengers);
      notify(
        crewUserId,
        "pickup_nearby",
        "Pickup request nearby",
        `${pax} ${pax === 1 ? "passenger" : "passengers"} waiting at ${pickup?.pickup_destination}.`,
        { request_id: requestId },
      );
    }
  }
  return at;
};

const ownedRequest = (id: unknown, filter: (r: Row) => boolean): Row | undefined => {
  const commuterId = myCommuterId();
  const request = requestOf(id);
  return request &&
    commuterId &&
    request.commuter_id === commuterId &&
    request.request_type === "Pickup" &&
    filter(request)
    ? request
    : undefined;
};

const isDraft = (r: Row) => r.request_status === "pending" && r.is_draft === true;
const isWaiting = (r: Row) => r.request_status === "pending" && r.is_draft === false;
const newestFirst = (x: Row, y: Row) => timeOf(y.request_date) - timeOf(x.request_date);

const savePickupDraft = (a: any) => {
  const destination = String(a.p_destination ?? "").trim();
  if (
    !uid() ||
    a.p_latitude == null ||
    a.p_longitude == null ||
    !destination ||
    !(a.p_passengers >= 1 && a.p_passengers <= 10) ||
    !["Jeepney", "Tricycle"].includes(a.p_vehicle_type)
  )
    fail("Complete the pickup details before inviting a companion.");
  if (a.p_vehicle_type === "Tricycle" && a.p_passengers > 4)
    fail("A tricycle fits up to 4 passengers.");
  const commuterId = myCommuterId();
  if (!commuterId) fail("Your commuter account could not be found.", "42501");

  if (
    db.tables.request.some(
      (r) =>
        r.commuter_id === commuterId &&
        livePickupStatus(r, live) &&
        r.is_draft === false &&
        pickupOf(r.request_id),
    )
  )
    fail("Cancel your active pickup before creating another shared ride.");
  if (
    db.tables.pickup_companion.some(
      (c) =>
        c.commuter_id === commuterId &&
        c.companion_status === "accepted" &&
        livePickupStatus(requestOf(c.request_id), live),
    )
  )
    fail("You already joined a shared ride. Leave it before requesting your own pickup.");

  let existing: Row | undefined;
  if (a.p_request_id == null) {
    existing = db.tables.request
      .filter((r) => r.commuter_id === commuterId && r.request_type === "Pickup" && isDraft(r))
      .sort(newestFirst)[0];
  } else {
    existing = ownedRequest(a.p_request_id, isDraft);
    if (!existing) fail("This pickup draft is no longer available.");
  }

  if (!existing) {
    const request: Row = {
      request_id: db.id(),
      commuter_id: commuterId,
      driver_id: null,
      request_type: "Pickup",
      request_status: "pending",
      request_date: iso(),
      device_latitude: a.p_latitude,
      device_longitude: a.p_longitude,
      is_draft: true,
      arrived_at: null,
      owner_present_at: null,
    };
    insert("request", request);
    insert("pickup", {
      pickup_id: db.id(),
      request_id: request.request_id,
      vehicle_id: null,
      pickup_destination: destination,
      pickup_date: iso(),
      number_of_passengers: a.p_passengers,
      requested_vehicle_type: a.p_vehicle_type,
      route_id: null,
      pickup_lat: null,
      pickup_lng: null,
      dropoff_name: null,
      dropoff_lat: null,
      dropoff_lng: null,
      boarded_at: null,
      dropped_at: null,
      waiting_area_id: null,
    });
    return request.request_id;
  }

  const requestId = existing!.request_id;
  const companions = companionsOf(requestId);
  const active = companions.filter((c) =>
    open.includes(String(c.companion_status)),
  ).length;
  if (active + 1 > a.p_passengers)
    fail("Increase the passenger count to include all invited companions.");
  const pickup = pickupOf(requestId)!;
  const changed =
    existing!.device_latitude !== a.p_latitude ||
    existing!.device_longitude !== a.p_longitude ||
    pickup.pickup_destination !== destination;
  if (changed) {
    if (companions.some((c) => c.companion_status === "pending"))
      fail("Wait for every companion to respond before changing the pickup location.");
    const ownerName = nameOf(uid(), "Your companion");
    for (const c of companions.filter((x) => x.companion_status === "accepted")) {
      notify(
        commuterUserId(c.commuter_id),
        "pickup_location_changed",
        "Pickup location changed",
        `${ownerName} changed the pickup location to ${destination}. Tap to accept or decline the new location.`,
        { request_id: requestId },
      );
      patch("pickup_companion", c, {
        companion_status: "pending",
        location_changed: true,
        responded_at: null,
      });
    }
  }
  patch("request", existing!, {
    device_latitude: a.p_latitude,
    device_longitude: a.p_longitude,
  });
  patch("pickup", pickup, {
    pickup_destination: destination,
    number_of_passengers: a.p_passengers,
    requested_vehicle_type: a.p_vehicle_type,
  });
  return requestId;
};

const setPickupRoute = (a: any) => {
  if (
    a.p_pickup_lat == null ||
    a.p_pickup_lng == null ||
    a.p_dropoff_lat == null ||
    a.p_dropoff_lng == null ||
    !String(a.p_dropoff_name ?? "").trim()
  )
    fail("Select where you want to be dropped off.");
  if (!ownedRequest(a.p_request_id, isDraft))
    fail("This pickup draft is no longer available.");
  if (
    a.p_route_id != null &&
    !routeFitsPoints(
      a.p_route_id,
      [a.p_pickup_lat, a.p_pickup_lng],
      [a.p_dropoff_lat, a.p_dropoff_lng],
      25,
    )
  )
    fail("Pickup point must be on the route. Please re-select.");
  if (
    a.p_waiting_area_id != null &&
    !db.tables.waiting_area.some((w) => w.area_id === a.p_waiting_area_id && w.is_active)
  )
    fail("This waiting area is no longer available.");
  patch("pickup", pickupOf(a.p_request_id)!, {
    route_id: a.p_route_id ?? null,
    pickup_lat: a.p_pickup_lat,
    pickup_lng: a.p_pickup_lng,
    dropoff_name: String(a.p_dropoff_name).trim(),
    dropoff_lat: a.p_dropoff_lat,
    dropoff_lng: a.p_dropoff_lng,
    waiting_area_id: a.p_waiting_area_id ?? null,
  });
  return null;
};

const publishPickupDraft = (a: any) => {
  if (!myCommuterId()) fail("Your commuter account could not be found.", "42501");
  const request = ownedRequest(a.p_request_id, isDraft);
  if (!request) fail("This pickup draft is no longer available.");
  if (companionsOf(a.p_request_id).some((c) => c.companion_status === "pending"))
    fail("Wait for every companion to accept or decline before confirming.");
  const pickup = pickupOf(a.p_request_id)!;
  if (
    pickup.route_id &&
    !routeFitsPoints(
      pickup.route_id,
      [num(pickup.pickup_lat), num(pickup.pickup_lng)],
      [num(pickup.dropoff_lat), num(pickup.dropoff_lng)],
      25,
    )
  )
    fail("Pickup point must be on the route. Please re-select.");
  patch("request", request!, { is_draft: false });
  return a.p_request_id;
};

const markPickupArrived = (a: any) => {
  const request = ownedRequest(a.p_request_id, isWaiting);
  if (!request) fail("This pickup request is no longer waiting.");
  const [lat, lng] = pickupPoint(request!);
  if (meters(lat, lng, a.p_latitude, a.p_longitude) > pickupArrivalRadius(a.p_request_id))
    fail("Go to the pickup point first. Drivers will see your request once you arrive.");
  patch("request", request!, { owner_present_at: request!.owner_present_at ?? iso() });
  return tryBroadcastPickup(a.p_request_id);
};

const markPickupAway = (a: any) => {
  const request = ownedRequest(a.p_request_id, isWaiting);
  if (!request) fail("This pickup request is no longer waiting.");
  const [lat, lng] = pickupPoint(request!);
  const distance = meters(lat, lng, a.p_latitude, a.p_longitude);
  if (distance <= Math.max(150, pickupArrivalRadius(a.p_request_id) + 50))
    return !!request!.arrived_at;
  patch("request", request!, { arrived_at: null, owner_present_at: null });
  return false;
};

const getMyPickupDraft = () => {
  const commuterId = myCommuterId();
  return db.tables.request
    .filter(
      (r) =>
        r.commuter_id === commuterId &&
        r.request_type === "Pickup" &&
        isDraft(r) &&
        pickupOf(r.request_id),
    )
    .sort(newestFirst)
    .slice(0, 1)
    .map((r) => {
      const p = pickupOf(r.request_id)!;
      return {
        request_id: r.request_id,
        device_latitude: r.device_latitude,
        device_longitude: r.device_longitude,
        pickup_destination: p.pickup_destination,
        number_of_passengers: p.number_of_passengers,
        requested_vehicle_type: p.requested_vehicle_type,
      };
    });
};

const getMyPickupDriver = () => {
  const commuterId = myCommuterId();
  const request = db.tables.request
    .filter(
      (r) =>
        r.commuter_id === commuterId &&
        r.request_type === "Pickup" &&
        r.request_status === "accepted" &&
        vehicleOf(pickupOf(r.request_id)?.vehicle_id),
    )
    .sort(newestFirst)[0];
  if (!request) return null;
  const vehicle = vehicleOf(pickupOf(request.request_id)!.vehicle_id)!;
  const loc = locationOf(vehicle.vehicle_id);
  return {
    request_id: request.request_id,
    plate_number: vehicle.plate_number,
    vehicle_type: vehicle.vehicle_type,
    vehicle_status: vehicle.vehicle_status,
    max_capacity: vehicle.max_capacity,
    current_capacity: vehicle.current_capacity ?? 0,
    occupancy_level: vehicle.occupancy_level ?? 0,
    location: loc
      ? {
          latitude: loc.records_latitude,
          longitude: loc.records_longitude,
          speed_kmh: loc.speed_kmh,
          recorded_at: loc.recorded_at,
        }
      : null,
  };
};

const getMyRideProgress = () => {
  const commuterId = myCommuterId();
  const ride = commuterId
    ? db.tables.request
        .filter(
          (r) =>
            r.request_type === "Pickup" &&
            r.request_status === "riding" &&
            (r.commuter_id === commuterId || acceptedCompanion(r.request_id, commuterId)) &&
            pickupOf(r.request_id),
        )
        .sort(newestFirst)[0]
    : undefined;
  if (!ride) return [];
  const p = pickupOf(ride.request_id)!;
  const vehicle = vehicleOf(p.vehicle_id);
  const loc = vehicle ? locationOf(vehicle.vehicle_id) : undefined;
  return [
    {
      request_id: ride.request_id,
      route_id: p.route_id ?? null,
      pickup_lat: p.pickup_lat ?? ride.device_latitude,
      pickup_lng: p.pickup_lng ?? ride.device_longitude,
      dropoff_lat: p.dropoff_lat ?? null,
      dropoff_lng: p.dropoff_lng ?? null,
      dropoff_name: p.dropoff_name ?? p.pickup_destination ?? null,
      driver_name: fullName(driverProfile(ride.driver_id)),
      plate_number: vehicle?.plate_number ?? null,
      vehicle_lat: loc?.records_latitude ?? null,
      vehicle_lng: loc?.records_longitude ?? null,
      vehicle_recorded_at: loc?.recorded_at ?? null,
    },
  ];
};

const completeMyRide = (a: any) => {
  const request = ownedRequest(a.p_request_id, () => true);
  if (!request) fail("This ride is not yours.", "42501");
  if (request!.request_status === "completed") return "already_completed";
  if (request!.request_status !== "riding")
    fail("You haven't boarded this ride yet.");
  completeRideEffect(String(a.p_request_id));
  return "completed";
};

export const completeRideEffect = (requestId: string): void => {
  setRequestStatus(requestId, "completed");
  const pickup = pickupOf(requestId);
  if (pickup) {
    patch("pickup", pickup, { dropped_at: iso() });
    const vehicle = vehicleOf(pickup.vehicle_id);
    if (vehicle) {
      vehicle.current_capacity = Math.max(
        0,
        num(vehicle.current_capacity ?? 0) - num(pickup.number_of_passengers ?? 0),
      );
      db.emit({ table: "vehicle", type: "UPDATE", row: vehicle });
    }
  }
};

const reportRideEmergency = (a: any) => {
  const commuterId = myCommuterId();
  const request = db.tables.request.find(
    (r) =>
      r.request_id === a.p_request_id &&
      livePickupStatus(r, ["accepted", "riding"]) &&
      (r.commuter_id === commuterId || acceptedCompanion(r.request_id, commuterId)),
  );
  if (!commuterId || !request) fail("This ride is not yours.", "42501");
  const pickup = pickupOf(a.p_request_id);
  const vehicle = vehicleOf(pickup?.vehicle_id);
  const emergency: Row = {
    emergency_id: db.id(),
    request_id: a.p_request_id,
    reported_by: uid(),
    vehicle_id: pickup?.vehicle_id ?? null,
    driver_id: request!.driver_id ?? null,
    plate_number: vehicle?.plate_number ?? null,
    latitude: a.p_latitude,
    longitude: a.p_longitude,
    created_at: iso(),
  };
  db.tables.ride_emergency.push(emergency);
  db.emit({ table: "ride_emergency", type: "INSERT", row: emergency });
  const name = fullName(profileOf(uid())) ?? "A commuter";
  for (const admin of db.tables.user.filter((u) => u.user_type === "admin")) {
    notify(
      admin.user_id,
      "ride_emergency",
      "SOS: rider emergency",
      `${name} pressed SOS${vehicle?.plate_number ? ` on vehicle ${vehicle.plate_number}` : ""}.`,
      {
        request_id: a.p_request_id,
        emergency_id: emergency.emergency_id,
        latitude: a.p_latitude,
        longitude: a.p_longitude,
      },
    );
  }
  return emergency.emergency_id;
};

const addPickupCompanions = (a: any) => {
  if (!ownedRequest(a.p_request_id, (r) => r.request_status === "pending"))
    fail("This pickup request was not found.", "42501");
  const ids: string[] = a.p_user_ids ?? [];
  const pickup = pickupOf(a.p_request_id);
  const existing = companionsOf(a.p_request_id).filter((c) =>
    open.includes(String(c.companion_status)),
  ).length;
  if (existing + ids.length + 1 > num(pickup?.number_of_passengers ?? 1))
    fail("Increase the passenger count to include all invited companions.");
  const ownerName = nameOf(uid(), "A commuter");
  let added = 0;
  for (const userIdValue of ids) {
    if (userIdValue === uid()) continue;
    if (!db.tables.profile.some((p) => p.user_id === userIdValue && p.user_type === "commuter"))
      fail("One of the riders is not a registered commuter.");
    let commuter = commuterOf(userIdValue);
    if (!commuter) {
      commuter = { commuter_id: db.id(), user_id: userIdValue };
      db.tables.commuter.push(commuter);
      db.emit({ table: "commuter", type: "INSERT", row: commuter });
    }
    const current = companionsOf(a.p_request_id).find(
      (c) => c.commuter_id === commuter!.commuter_id,
    );
    let changed = false;
    if (!current) {
      insert("pickup_companion", {
        request_id: a.p_request_id,
        commuter_id: commuter.commuter_id,
        companion_status: "pending",
        responded_at: null,
        added_at: iso(),
        location_changed: false,
        arrived_at: null,
      });
      changed = true;
    } else if (current.companion_status === "rejected") {
      patch("pickup_companion", current, {
        companion_status: "pending",
        responded_at: null,
        added_at: iso(),
      });
      changed = true;
    }
    if (changed) {
      added += 1;
      notify(
        userIdValue,
        "pickup_shared",
        "Share a ride request",
        `${ownerName} wants to share a ride with you from ${pickup?.pickup_destination ?? "their pickup location"}. Tap to accept or decline.`,
        { request_id: a.p_request_id },
      );
    }
  }
  return added;
};

const removePickupCompanion = (a: any) => {
  if (!ownedRequest(a.p_request_id, isDraft))
    fail("This pickup draft is no longer available.", "42501");
  const commuter = commuterOf(a.p_user_id);
  const row = commuter
    ? companionsOf(a.p_request_id).find((c) => c.commuter_id === commuter.commuter_id)
    : undefined;
  if (!row) return null;
  const status = String(row.companion_status);
  db.tables.pickup_companion.splice(db.tables.pickup_companion.indexOf(row), 1);
  db.emit({ table: "pickup_companion", type: "DELETE", row });
  const pickup = pickupOf(a.p_request_id)!;
  if (open.includes(status))
    patch("pickup", pickup, {
      number_of_passengers: Math.max(1, num(pickup.number_of_passengers) - 1),
    });
  return pickup.number_of_passengers;
};

const getPickupCompanionStatuses = (a: any) => {
  const request = requestOf(a.p_request_id);
  if (
    !request ||
    !livePickupStatus(request, open) ||
    request.commuter_id !== myCommuterId()
  )
    return [];
  return companionsOf(a.p_request_id)
    .sort((x, y) => timeOf(x.added_at) - timeOf(y.added_at))
    .flatMap((c) => {
      const p = profileByCommuter(c.commuter_id);
      return p
        ? [
            {
              user_id: p.user_id,
              first_name: p.first_name,
              last_name: p.last_name,
              profile_picture: p.profile_picture ?? null,
              companion_status: c.companion_status,
              arrived: !!c.arrived_at,
            },
          ]
        : [];
    });
};

const getMyShareInvites = () => {
  const commuterId = myCommuterId();
  return db.tables.pickup_companion
    .filter((c) => c.commuter_id === commuterId && c.companion_status === "pending")
    .flatMap((c) => {
      const r = requestOf(c.request_id);
      if (!r || !livePickupStatus(r, open)) return [];
      const p = pickupOf(r.request_id);
      const owner = profileByCommuter(r.commuter_id);
      return [
        {
          sort: timeOf(c.added_at),
          row: {
            request_id: r.request_id,
            first_name: owner?.first_name ?? null,
            last_name: owner?.last_name ?? null,
            profile_picture: owner?.profile_picture ?? null,
            pickup_destination: p?.pickup_destination ?? null,
            number_of_passengers: p?.number_of_passengers ?? null,
            request_status: r.request_status,
            added_at: c.added_at,
            latitude: r.device_latitude,
            longitude: r.device_longitude,
            location_changed: c.location_changed ?? false,
          },
        },
      ];
    })
    .sort((x, y) => x.sort - y.sort)
    .map((x) => x.row);
};

export const acceptCompanionInvite = (companion: Row, name: string): void => {
  const request = requestOf(companion.request_id);
  const locationChanged = companion.location_changed === true;
  patch("pickup_companion", companion, {
    companion_status: "accepted",
    location_changed: false,
    responded_at: iso(),
  });
  notify(
    commuterUserId(request?.commuter_id),
    "share_ride_accepted",
    "Share a ride accepted",
    locationChanged
      ? `${name} accepted the new pickup location.`
      : `${name} accepted your share a ride request.`,
    { request_id: companion.request_id },
  );
};

export const companionDisplayName = (commuterId: unknown): string =>
  nameOf(commuterUserId(commuterId), "A rider");

const respondToShareInvite = (a: any) => {
  const commuterId = myCommuterId();
  const request = requestOf(a.p_request_id);
  const companion = companionsOf(a.p_request_id).find(
    (c) => c.commuter_id === commuterId && c.companion_status === "pending",
  );
  if (!commuterId || !request || !companion)
    fail("This share a ride request was not found.", "42501");
  if (request!.request_type !== "Pickup" || request!.request_status !== "pending")
    fail("This shared ride has already ended.");
  const ownerId = commuterUserId(request!.commuter_id);
  const name = nameOf(uid(), "A rider");
  const locationChanged = companion!.location_changed === true;
  const pickup = pickupOf(a.p_request_id);
  let passengers = pickup?.number_of_passengers as number | undefined;
  if (a.p_accept) {
    if (
      db.tables.request.some(
        (r) =>
          r.commuter_id === commuterId &&
          livePickupStatus(r, open) &&
          pickupOf(r.request_id),
      )
    )
      fail("Cancel your own pickup request before joining a shared ride.");
    if (
      db.tables.pickup_companion.some(
        (c) =>
          c.commuter_id === commuterId &&
          c.request_id !== a.p_request_id &&
          c.companion_status === "accepted" &&
          livePickupStatus(requestOf(c.request_id), open),
      )
    )
      fail("You already joined another shared ride. Leave it before joining this one.");
    acceptCompanionInvite(companion!, name);
  } else {
    patch("pickup_companion", companion!, {
      companion_status: "rejected",
      location_changed: false,
      responded_at: iso(),
    });
    if (pickup) {
      passengers = Math.max(1, num(pickup.number_of_passengers) - 1);
      patch("pickup", pickup, { number_of_passengers: passengers });
    }
    notify(
      ownerId,
      "share_ride_declined",
      "Share a ride declined",
      locationChanged
        ? `${name} declined the new pickup location and left the shared ride.`
        : `${name} declined your share a ride request.`,
      { request_id: a.p_request_id },
    );
  }
  return passengers ?? 1;
};

const getMySharedRide = () => {
  const commuterId = myCommuterId();
  return db.tables.pickup_companion
    .filter((c) => c.commuter_id === commuterId && c.companion_status === "accepted")
    .flatMap((c) => {
      const r = requestOf(c.request_id);
      const p = pickupOf(c.request_id);
      if (!r || !p || !livePickupStatus(r, live)) return [];
      const owner = profileByCommuter(r.commuter_id);
      return [
        {
          sort: c.responded_at ? timeOf(c.responded_at) : -Infinity,
          row: {
            request_id: r.request_id,
            owner_first_name: owner?.first_name ?? null,
            owner_last_name: owner?.last_name ?? null,
            owner_picture: owner?.profile_picture ?? null,
            pickup_destination: p.pickup_destination,
            latitude: p.pickup_lat ?? r.device_latitude,
            longitude: p.pickup_lng ?? r.device_longitude,
            passengers: p.number_of_passengers,
            vehicle_type: p.requested_vehicle_type,
            request_status: r.request_status,
            is_draft: r.is_draft,
            plate_number: vehicleOf(p.vehicle_id)?.plate_number ?? null,
            owner_arrived: !!r.arrived_at,
            me_arrived: !!c.arrived_at,
          },
        },
      ];
    })
    .sort((x, y) => y.sort - x.sort)
    .slice(0, 1)
    .map((x) => x.row);
};

const leaveSharedRide = (a: any) => {
  const commuterId = myCommuterId();
  const request = requestOf(a.p_request_id);
  const companion = commuterId ? acceptedCompanion(a.p_request_id, commuterId) : undefined;
  if (!commuterId || !companion || !livePickupStatus(request, open))
    fail("This shared ride is no longer available.");
  patch("pickup_companion", companion!, {
    companion_status: "rejected",
    location_changed: false,
    responded_at: iso(),
    arrived_at: null,
  });
  const pickup = pickupOf(a.p_request_id);
  if (pickup)
    patch("pickup", pickup, {
      number_of_passengers: Math.max(1, num(pickup.number_of_passengers) - 1),
    });
  notify(
    commuterUserId(request!.commuter_id),
    "share_ride_left",
    "Companion left your shared ride",
    `${nameOf(uid(), "A rider")} left your shared ride.`,
    { request_id: a.p_request_id },
  );
  tryBroadcastPickup(a.p_request_id);
  return null;
};

const updateCompanionPresence = (a: any) => {
  const commuterId = myCommuterId();
  const request = requestOf(a.p_request_id);
  const companion = commuterId ? acceptedCompanion(a.p_request_id, commuterId) : undefined;
  if (!commuterId || !companion || !livePickupStatus(request, open))
    fail("This shared ride is no longer available.");
  return companionPresenceEffect(request!, companion!, a.p_latitude, a.p_longitude);
};

export const companionPresenceEffect = (
  request: Row,
  companion: Row,
  latitude: number,
  longitude: number,
): boolean => {
  const [lat, lng] = pickupPoint(request);
  const radius = pickupArrivalRadius(request.request_id);
  const distance = meters(lat, lng, latitude, longitude);
  const arrivedAt =
    distance <= radius
      ? (companion.arrived_at ?? iso())
      : distance > Math.max(150, radius + 50)
        ? null
        : (companion.arrived_at ?? null);
  patch("pickup_companion", companion, { arrived_at: arrivedAt });
  if (arrivedAt) tryBroadcastPickup(String(request.request_id));
  else if (request.request_status === "pending" && request.arrived_at)
    patch("request", request, { arrived_at: null });
  return arrivedAt !== null;
};

const getRideParty = (a: any) => {
  const commuterId = myCommuterId();
  const request = requestOf(a.p_request_id);
  if (!request || !livePickupStatus(request, open)) return [];
  if (request.commuter_id !== commuterId && !acceptedCompanion(a.p_request_id, commuterId))
    return [];
  const members = [
    {
      commuter_id: request.commuter_id,
      is_owner: true,
      arrived: !!request.owner_present_at,
      sort: 0,
      added: 0,
    },
    ...companionsOf(a.p_request_id)
      .filter((c) => c.companion_status === "accepted")
      .map((c) => ({
        commuter_id: c.commuter_id,
        is_owner: false,
        arrived: !!c.arrived_at,
        sort: 1,
        added: timeOf(c.added_at),
      })),
  ];
  return members
    .sort((x, y) => x.sort - y.sort || x.added - y.added)
    .flatMap((m) => {
      const p = profileByCommuter(m.commuter_id);
      return p && p.user_id !== uid()
        ? [
            {
              user_id: p.user_id,
              first_name: p.first_name,
              last_name: p.last_name,
              profile_picture: p.profile_picture ?? null,
              is_owner: m.is_owner,
              arrived: m.arrived,
            },
          ]
        : [];
    });
};

const searchAvailableCommuters = (a: any) => {
  const query = String(a.p_query ?? "").trim();
  if (!uid() || query.length < 2) return [];
  const lower = query.toLowerCase();
  return db.tables.profile
    .filter((p) => {
      if (p.user_id === uid() || p.user_type !== "commuter") return false;
      const email = String(
        db.tables.user.find((u) => u.user_id === p.user_id)?.user_email ?? "",
      ).toLowerCase();
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ").toLowerCase();
      if (!name.includes(lower) && email !== lower) return false;
      const commuter = commuterOf(p.user_id);
      if (!commuter) return true;
      const busyOwn = db.tables.request.some(
        (r) => r.commuter_id === commuter.commuter_id && livePickupStatus(r, live),
      );
      const busyCompanion = db.tables.pickup_companion.some(
        (c) =>
          c.commuter_id === commuter.commuter_id &&
          open.includes(String(c.companion_status)) &&
          live.includes(String(requestOf(c.request_id)?.request_status)),
      );
      return !busyOwn && !busyCompanion;
    })
    .sort(
      (x, y) =>
        String(x.first_name).localeCompare(String(y.first_name)) ||
        String(x.last_name).localeCompare(String(y.last_name)),
    )
    .slice(0, 10)
    .map((p) => ({
      user_id: p.user_id,
      first_name: p.first_name,
      last_name: p.last_name,
      profile_picture: p.profile_picture ?? null,
    }));
};

const riderRow = (p: Row | undefined, owner: boolean) => ({
  user_id: p?.user_id,
  first_name: p?.first_name ?? null,
  last_name: p?.last_name ?? null,
  profile_picture: p?.profile_picture ?? null,
  is_owner: owner,
  is_me: p?.user_id === uid(),
});

const getMyBookings = () => {
  const commuterId = myCommuterId();
  const mine = (r: Row) =>
    r.commuter_id === commuterId ||
    (!!commuterId && !!acceptedCompanion(r.request_id, commuterId));
  return db.tables.request
    .filter((r) => r.request_status === "completed" && mine(r))
    .sort(newestFirst)
    .map((r) => {
      const pickup = pickupOf(r.request_id);
      const rental = db.tables.charter_rental.find((c) => c.request_id === r.request_id);
      const vehicle = vehicleOf(pickup?.vehicle_id ?? rental?.vehicle_id);
      const driver = driverProfile(r.driver_id);
      const ratings = db.tables.rating.filter((x) => x.request_id === r.request_id);
      const units = db.tables.charter_rental_unit
        .filter((u) => u.request_id === r.request_id)
        .sort((x, y) => num(x.position) - num(y.position));
      const unitDrivers = units.filter((u) => u.driver_id);
      const feedback =
        ratings
          .filter((x) => x.feedback != null)
          .sort((x, y) => timeOf(y.rated_at) - timeOf(x.rated_at))[0]?.feedback ?? null;
      const drivers = unitDrivers.length
        ? unitDrivers.map((u) => {
            const p = driverProfile(u.driver_id);
            return {
              driver_id: u.driver_id,
              first_name: p?.first_name ?? null,
              last_name: p?.last_name ?? null,
              profile_picture: p?.profile_picture ?? null,
              vehicle_type: u.vehicle_type ?? null,
              plate_number: vehicleOf(u.vehicle_id)?.plate_number ?? null,
              score: ratings.find((x) => x.driver_id === u.driver_id)?.score ?? null,
            };
          })
        : r.driver_id
          ? [
              {
                driver_id: r.driver_id,
                first_name: driver?.first_name ?? null,
                last_name: driver?.last_name ?? null,
                profile_picture: driver?.profile_picture ?? null,
                vehicle_type: vehicle?.vehicle_type ?? null,
                plate_number: vehicle?.plate_number ?? null,
                score: null,
              },
            ]
          : [];
      const riders =
        r.request_type === "Pickup"
          ? [
              riderRow(profileByCommuter(r.commuter_id), true),
              ...companionsOf(r.request_id)
                .filter((c) => c.companion_status === "accepted")
                .sort((x, y) => timeOf(x.added_at) - timeOf(y.added_at))
                .map((c) => riderRow(profileByCommuter(c.commuter_id), false)),
            ]
          : null;
      return {
        request_id: r.request_id,
        request_type: r.request_type,
        request_date: r.request_date,
        destination: pickup?.pickup_destination ?? rental?.rental_destination ?? null,
        passengers: pickup?.number_of_passengers ?? rental?.number_of_passengers ?? null,
        rental_date: rental?.rental_date ?? null,
        purpose: rental?.purpose ?? null,
        plate_number: vehicle?.plate_number ?? null,
        vehicle_type: vehicle?.vehicle_type ?? null,
        driver_name: fullName(driver),
        rating_score: ratings.length
          ? Math.round(ratings.reduce((s, x) => s + num(x.score), 0) / ratings.length)
          : null,
        rating_feedback: feedback,
        drivers_total: new Set(
          units.filter((u) => u.status === "completed" && u.driver_id).map((u) => u.driver_id),
        ).size,
        drivers_rated: ratings.length,
        boarded_at: pickup?.boarded_at ?? null,
        dropped_at: pickup?.dropped_at ?? null,
        dropoff_name: pickup?.dropoff_name ?? null,
        drivers,
        riders,
        shared_by:
          r.commuter_id === commuterId
            ? null
            : (profileByCommuter(r.commuter_id)?.first_name ?? null),
      };
    });
};

export const pickupHandlers: Record<string, (args: any) => unknown> = {
  save_pickup_draft: savePickupDraft,
  set_pickup_route: setPickupRoute,
  publish_pickup_draft: publishPickupDraft,
  mark_pickup_arrived: markPickupArrived,
  mark_pickup_away: markPickupAway,
  get_my_pickup_draft: getMyPickupDraft,
  get_my_pickup_driver: getMyPickupDriver,
  get_my_ride_progress: getMyRideProgress,
  complete_my_ride: completeMyRide,
  report_ride_emergency: reportRideEmergency,
  add_pickup_companions: addPickupCompanions,
  remove_pickup_companion: removePickupCompanion,
  get_pickup_companion_statuses: getPickupCompanionStatuses,
  get_my_share_invites: getMyShareInvites,
  respond_to_share_invite: respondToShareInvite,
  get_my_shared_ride: getMySharedRide,
  leave_shared_ride: leaveSharedRide,
  update_companion_presence: updateCompanionPresence,
  get_ride_party: getRideParty,
  search_available_commuters: searchAvailableCommuters,
  get_my_bookings: getMyBookings,
};
