import { currentUserId } from "@/simulation/auth";
import { db, type Row } from "@/simulation/db";
import { notify } from "@/simulation/rpc/notify";
import { setRequestStatus } from "@/simulation/rpc/pickups";

const fail = (message: string, code = "22023"): never => {
  throw Object.assign(new Error(message), { code });
};

const HOUR = 3600_000;
const iso = () => db.now().toISOString();
const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
const timeOf = (v: unknown) => new Date(String(v)).getTime();
const uid = (): string => currentUserId() ?? "";
const lower = (v: unknown) => String(v).toLowerCase();

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const whenText = (value: unknown): string => {
  const d = new Date(timeOf(value) + 8 * HOUR);
  const h = d.getUTCHours();
  return `${months[d.getUTCMonth()]} ${pad(d.getUTCDate())}, ${pad(h % 12 || 12)}:${pad(d.getUTCMinutes())} ${h < 12 ? "AM" : "PM"}`;
};

const profileOf = (userId: unknown) => db.tables.profile.find((p) => p.user_id === userId);
const commuterRow = (commuterId: unknown) =>
  db.tables.commuter.find((c) => c.commuter_id === commuterId);
const myCommuter = () => db.tables.commuter.find((c) => c.user_id === uid());
const personnelOfUser = (userId: unknown) =>
  db.tables.transit_personnel.find((p) => p.user_id === userId);
const myDriverIds = (): string[] => {
  const personnel = personnelOfUser(uid());
  return db.tables.driver
    .filter((d) => d.personnel_id === personnel?.personnel_id)
    .map((d) => String(d.driver_id));
};
const myDriver = () =>
  db.tables.driver.find(
    (d) => d.personnel_id === personnelOfUser(uid())?.personnel_id && d.vehicle_id,
  );
const myAssignedVehicleId = () => (myDriver()?.vehicle_id as string | undefined) ?? null;
const driverUserId = (driverId: unknown) =>
  db.tables.transit_personnel.find(
    (p) =>
      p.personnel_id === db.tables.driver.find((d) => d.driver_id === driverId)?.personnel_id,
  )?.user_id;
const driverProfile = (driverId: unknown) => profileOf(driverUserId(driverId));
const vehicleOf = (id: unknown) => db.tables.vehicle.find((v) => v.vehicle_id === id);
const requestOf = (id: unknown) => db.tables.request.find((r) => r.request_id === id);
const rentalOf = (id: unknown) => db.tables.charter_rental.find((r) => r.request_id === id);
const unitsOf = (id: unknown) =>
  db.tables.charter_rental_unit
    .filter((u) => u.request_id === id)
    .sort((x, y) => num(x.position) - num(y.position));

const emit = (
  table: "request" | "charter_rental" | "charter_rental_unit",
  row: Row,
  values: Row,
) => {
  Object.assign(row, values);
  db.emit({ table, type: "UPDATE", row });
};

const removeRow = (table: "request" | "charter_rental" | "charter_rental_unit", row: Row) => {
  const rows = db.tables[table];
  const i = rows.indexOf(row);
  if (i >= 0) rows.splice(i, 1);
  db.emit({ table, type: "DELETE", row });
};

const pickupTime = (rental: Row) => timeOf(rental.pickup_time ?? rental.rental_date);

const vehicleBusy = (
  vehicleId: unknown,
  start: number,
  end: number | null,
  ignore: unknown,
): boolean =>
  db.tables.charter_rental.some((rental) => {
    const request = requestOf(rental.request_id);
    if (!request || !["pending", "accepted"].includes(String(request.request_status)))
      return false;
    if (request.request_id === ignore) return false;
    const mine =
      rental.vehicle_id === vehicleId ||
      unitsOf(rental.request_id).some((u) => u.vehicle_id === vehicleId && u.status === "booked");
    if (!mine) return false;
    const from = pickupTime(rental);
    const to = rental.return_time ? timeOf(rental.return_time) : from;
    return from - HOUR <= (end ?? start) + HOUR && to + HOUR >= start - HOUR;
  });

const hasActivePickup = (commuterId: unknown): boolean =>
  db.tables.request.some(
    (r) =>
      r.request_type === "Pickup" &&
      ["pending", "accepted", "riding"].includes(String(r.request_status)) &&
      ((r.commuter_id === commuterId &&
        (r.is_draft === false ||
          db.tables.pickup_companion.some(
            (c) =>
              c.request_id === r.request_id &&
              ["pending", "accepted"].includes(String(c.companion_status)),
          ))) ||
        db.tables.pickup_companion.some(
          (c) =>
            c.request_id === r.request_id &&
            c.commuter_id === commuterId &&
            c.companion_status === "accepted",
        )),
  );

const hasActiveRental = (commuterId: unknown): boolean =>
  db.tables.request.some((r) => {
    if (r.commuter_id !== commuterId || r.request_type !== "Charter_Rental") return false;
    const rental = rentalOf(r.request_id);
    if (!rental) return false;
    const now = db.now().getTime();
    if (r.request_status === "pending") return pickupTime(rental) > now;
    if (r.request_status === "accepted")
      return (
        timeOf(rental.return_time ?? rental.pickup_time ?? rental.rental_date) + 12 * HOUR > now
      );
    return false;
  });

const contactOf = (p?: Row) => (p?.contact_number as string | undefined) ?? null;
const joinName = (p?: Row) => [p?.first_name, p?.last_name].filter(Boolean).join(" ") || null;

const rentalJson = (requestId: unknown, contacts: boolean): Row => {
  const request = requestOf(requestId)!;
  const rental = rentalOf(requestId)!;
  const status = String(request.request_status);
  const vehicle = vehicleOf(rental.vehicle_id);
  const dProfile = driverProfile(request.driver_id);
  const cProfile = profileOf(commuterRow(request.commuter_id)?.user_id);
  const mine = myDriverIds();
  const units = unitsOf(requestId);
  const ratings = db.tables.rating.filter((r) => r.request_id === requestId);
  const feedback = ratings
    .filter((r) => r.feedback != null)
    .sort((x, y) => timeOf(y.rated_at) - timeOf(x.rated_at))[0]?.feedback;
  return {
    request_id: requestId,
    status,
    requested_at: request.request_date,
    pickup_location: rental.pickup_location ?? null,
    pickup_latitude: request.device_latitude,
    pickup_longitude: request.device_longitude,
    destination: rental.rental_destination,
    pickup_time: rental.pickup_time ?? rental.rental_date,
    trip_type: rental.trip_type ?? "one_way",
    return_time: rental.return_time ?? null,
    purpose: rental.purpose,
    passengers: rental.number_of_passengers,
    notes: rental.notes ?? null,
    plate_number: vehicle?.plate_number ?? null,
    vehicle_type: vehicle?.vehicle_type ?? rental.requested_vehicle_type ?? null,
    requested_vehicle_type: rental.requested_vehicle_type ?? null,
    driver_assigned: request.driver_id != null,
    driver_name: joinName(dProfile),
    driver_contact: contacts && status === "accepted" ? contactOf(dProfile) : null,
    commuter_name: joinName(cProfile),
    commuter_contact:
      contacts &&
      (status === "pending" || status === "accepted") &&
      units.some(
        (u) =>
          (u.status === "booked" || u.status === "completed") &&
          mine.includes(String(u.driver_id)),
      )
        ? contactOf(cProfile)
        : null,
    rating_score: ratings.length
      ? Math.round(ratings.reduce((s, r) => s + num(r.score), 0) / ratings.length)
      : null,
    rating_feedback: feedback ?? null,
    units: units.map((u) => {
      const p = driverProfile(u.driver_id);
      return {
        unit_id: u.unit_id,
        vehicle_type: u.vehicle_type,
        status: u.status,
        driver_id: u.driver_id ?? null,
        is_mine: u.driver_id != null && mine.includes(String(u.driver_id)),
        driver_name: joinName(p),
        plate_number: vehicleOf(u.vehicle_id)?.plate_number ?? null,
        driver_contact:
          contacts && (u.status === "booked" || u.status === "completed") ? contactOf(p) : null,
        my_score:
          u.driver_id != null
            ? (ratings.find((r) => r.driver_id === u.driver_id)?.score ?? null)
            : null,
      };
    }),
  };
};

const postCharterRental = (a: any) => {
  const commuter = myCommuter();
  if (!commuter) return fail("Sign in as a commuter to rent a vehicle.", "42501");
  const commuterId = commuter.commuter_id;
  if (hasActivePickup(commuterId))
    fail("Finish or cancel your pickup request before posting a rental.");
  if (hasActiveRental(commuterId))
    fail("You already have an active rental request. Cancel it before posting another.");
  const vehicles: string[] = a.p_vehicles ?? [];
  const count = vehicles.length;
  const pickup = a.p_pickup_time ? timeOf(a.p_pickup_time) : null;
  if (count < 1) fail("Choose at least one vehicle to rent.");
  if (count > 10) fail("You can rent up to 10 vehicles at a time.");
  if (pickup === null || pickup <= db.now().getTime())
    return fail("Choose a pickup time in the future.");
  if (a.p_trip_type === "round_trip" && (!a.p_return_time || timeOf(a.p_return_time) <= pickup))
    fail("The return pickup must be after your pickup.");
  if (!String(a.p_pickup_location ?? "").trim() || !String(a.p_destination ?? "").trim())
    fail("Choose your pickup location and destination.");
  if (a.p_passengers == null || a.p_passengers < 1) fail("Add at least one passenger.");
  let seats = 0;
  for (const type of vehicles) {
    const capacities = db.tables.vehicle
      .filter((v) => v.vehicle_type === type)
      .map((v) => num(v.max_capacity));
    if (!capacities.length) fail(`There are no ${lower(type)} vehicles to rent right now.`);
    seats += Math.max(...capacities);
  }
  if (a.p_passengers > seats)
    fail(
      `These vehicles seat up to ${seats} passengers. Add another vehicle or choose bigger ones.`,
    );

  const destination = String(a.p_destination).trim();
  const roundTrip = a.p_trip_type === "round_trip";
  const requestId = db.id();
  const request: Row = {
    request_id: requestId,
    commuter_id: commuterId,
    driver_id: null,
    request_type: "Charter_Rental",
    request_status: "pending",
    request_date: iso(),
    device_latitude: a.p_pickup_latitude,
    device_longitude: a.p_pickup_longitude,
    is_draft: false,
    arrived_at: null,
    owner_present_at: null,
  };
  db.tables.request.push(request);
  db.emit({ table: "request", type: "INSERT", row: request });
  const rental: Row = {
    rental_id: db.id(),
    request_id: requestId,
    vehicle_id: null,
    requested_vehicle_type: vehicles[0],
    rental_destination: destination,
    rental_date: new Date(pickup + 8 * HOUR).toISOString().slice(0, 10),
    number_of_passengers: a.p_passengers,
    purpose: String(a.p_purpose ?? "").trim() || "Other",
    pickup_location: String(a.p_pickup_location).trim(),
    pickup_time: new Date(pickup).toISOString(),
    destination_latitude: a.p_destination_latitude,
    destination_longitude: a.p_destination_longitude,
    trip_type: roundTrip ? "round_trip" : "one_way",
    return_time: roundTrip ? a.p_return_time : null,
    notes: String(a.p_notes ?? "").trim() || null,
  };
  db.tables.charter_rental.push(rental);
  db.emit({ table: "charter_rental", type: "INSERT", row: rental });
  vehicles.forEach((type, i) => {
    const unit: Row = {
      unit_id: db.id(),
      request_id: requestId,
      position: i + 1,
      vehicle_type: type,
      driver_id: null,
      vehicle_id: null,
      status: "open",
      booked_at: null,
    };
    db.tables.charter_rental_unit.push(unit);
    db.emit({ table: "charter_rental_unit", type: "INSERT", row: unit });
  });

  const end = roundTrip ? timeOf(a.p_return_time) : null;
  const body =
    (count === 1 ? "" : `${count} vehicles needed · `) +
    `${a.p_passengers} ${a.p_passengers === 1 ? "passenger" : "passengers"} to ${destination} on ${whenText(pickup)}. Open the job board to take it.`;
  const recipients = new Set<unknown>();
  for (const driver of db.tables.driver) {
    const vehicle = vehicleOf(driver.vehicle_id);
    const personnel = db.tables.transit_personnel.find(
      (p) => p.personnel_id === driver.personnel_id,
    );
    if (!vehicle || !personnel) continue;
    if (!vehicles.includes(String(vehicle.vehicle_type))) continue;
    if ((personnel.employment_status ?? "Active") !== "Active") continue;
    if (vehicleBusy(vehicle.vehicle_id, pickup, end, requestId)) continue;
    recipients.add(personnel.user_id);
  }
  for (const userId of recipients)
    notify(userId, "rental_request", "New rental job", body, { request_id: requestId });
  return requestId;
};

const getMyRental = (a: any) => {
  const request = requestOf(a.p_request_id);
  const commuter = myCommuter();
  if (
    !request ||
    request.request_type !== "Charter_Rental" ||
    !commuter ||
    request.commuter_id !== commuter.commuter_id ||
    !rentalOf(request.request_id)
  )
    return null;
  return rentalJson(request.request_id, true);
};

const getMyRentals = () => {
  const commuter = myCommuter();
  const now = db.now().getTime();
  return db.tables.request
    .filter(
      (r) =>
        commuter &&
        r.commuter_id === commuter.commuter_id &&
        r.request_type === "Charter_Rental" &&
        !!rentalOf(r.request_id) &&
        (["pending", "accepted"].includes(String(r.request_status)) ||
          (r.request_status === "rejected" && timeOf(r.request_date) > now - 7 * 24 * HOUR)),
    )
    .sort((x, y) => timeOf(y.request_date) - timeOf(x.request_date))
    .map((r) => rentalJson(r.request_id, true));
};

const getMyRentalRequests = () => {
  const mine = myDriverIds();
  const vehicleId = myAssignedVehicleId();
  return db.tables.charter_rental
    .filter((rental) => {
      const request = requestOf(rental.request_id);
      return (
        request?.request_type === "Charter_Rental" &&
        (mine.includes(String(request.driver_id)) ||
          (vehicleId !== null && rental.vehicle_id === vehicleId) ||
          unitsOf(rental.request_id).some((u) => mine.includes(String(u.driver_id))))
      );
    })
    .sort((x, y) => pickupTime(x) - pickupTime(y))
    .map((rental) => rentalJson(rental.request_id, true));
};

const getRentalJobBoard = () => {
  const vehicle = vehicleOf(myAssignedVehicleId());
  if (!vehicle) return [];
  const mine = myDriverIds();
  const now = db.now().getTime();
  const out: { request: Row; row: Row }[] = [];
  const seen = new Set<unknown>();
  for (const unit of [...db.tables.charter_rental_unit].sort(
    (x, y) => num(x.position) - num(y.position),
  )) {
    if (
      unit.vehicle_type !== vehicle.vehicle_type ||
      unit.status !== "open" ||
      unit.driver_id != null ||
      seen.has(unit.request_id)
    )
      continue;
    seen.add(unit.request_id);
    const request = requestOf(unit.request_id);
    const rental = rentalOf(unit.request_id);
    if (!request || !rental) continue;
    if (request.request_type !== "Charter_Rental" || request.request_status !== "pending")
      continue;
    if (pickupTime(rental) <= now) continue;
    if (unitsOf(request.request_id).some((u) => mine.includes(String(u.driver_id)))) continue;
    if (((rental.dismissed_by as string[] | undefined) ?? []).some((id) => mine.includes(id)))
      continue;
    const end = rental.return_time ? timeOf(rental.return_time) : null;
    out.push({
      request,
      row: {
        ...rentalJson(request.request_id, false),
        unit_id: unit.unit_id,
        unit_vehicle_type: vehicle.vehicle_type,
        schedule_conflict: vehicleBusy(
          vehicle.vehicle_id,
          pickupTime(rental),
          end,
          request.request_id,
        ),
      },
    });
  }
  return out
    .sort((x, y) => timeOf(y.request.request_date) - timeOf(x.request.request_date))
    .map((o) => o.row);
};

const acceptRentalJob = (a: any) => {
  const driver = myDriver();
  const vehicle = vehicleOf(myAssignedVehicleId());
  if (!driver || !vehicle)
    return fail("Only drivers with an assigned vehicle can take rental jobs.", "42501");
  const unit = db.tables.charter_rental_unit.find((u) => u.unit_id === a.p_unit_id);
  if (!unit) return fail("This job is no longer available.");
  if (unit.status !== "open") fail("Another driver already took this vehicle.");
  const request = requestOf(unit.request_id);
  if (!request || request.request_status !== "pending")
    return fail("This job is no longer available.");
  if (unitsOf(unit.request_id).some((u) => u.driver_id === driver.driver_id))
    fail("You already took a vehicle on this rental.");
  const rental = rentalOf(unit.request_id)!;
  if (!rental.pickup_time || timeOf(rental.pickup_time) <= db.now().getTime())
    fail("The pickup time for this job has already passed.");
  if (unit.vehicle_type !== vehicle.vehicle_type)
    fail(`This vehicle is a ${lower(unit.vehicle_type)}.`);
  const end = rental.return_time ? timeOf(rental.return_time) : null;
  if (vehicleBusy(vehicle.vehicle_id, timeOf(rental.pickup_time), end, unit.request_id))
    fail("You already have a rental on these dates.");

  emit("charter_rental_unit", unit, {
    status: "booked",
    driver_id: driver.driver_id,
    vehicle_id: vehicle.vehicle_id,
    booked_at: iso(),
  });
  const units = unitsOf(unit.request_id);
  const total = units.length;
  const booked = units.filter((u) => u.status !== "open").length;
  if (request.driver_id == null) request.driver_id = driver.driver_id;
  if (rental.vehicle_id == null) emit("charter_rental", rental, { vehicle_id: vehicle.vehicle_id });
  db.emit({ table: "request", type: "UPDATE", row: request });
  if (booked >= total) setRequestStatus(String(unit.request_id), "accepted");

  const driverName = String(profileOf(uid())?.first_name || "") || "A driver";
  const when = whenText(rental.pickup_time);
  notify(
    commuterRow(request.commuter_id)?.user_id,
    "rental_accepted",
    booked >= total ? "Rental booked" : "Driver found",
    `${driverName} (${vehicle.plate_number}) accepted ${
      total === 1
        ? "your rental"
        : `a ${lower(unit.vehicle_type)} (${booked} of ${total} vehicles booked)`
    } to ${rental.rental_destination} on ${when}.`,
    { request_id: unit.request_id },
  );
  notify(
    uid(),
    "rental_job_booked",
    "Job booked",
    `You're booked to drive to ${rental.rental_destination} on ${when}. It's saved in My jobs.`,
    { request_id: unit.request_id },
  );
  return null;
};

const reopenUnit = (unit: Row, requestId: unknown, rental: Row) => {
  const request = requestOf(requestId)!;
  const droppedDriver = unit.driver_id;
  const droppedVehicle = unit.vehicle_id;
  emit("charter_rental_unit", unit, {
    status: "open",
    driver_id: null,
    vehicle_id: null,
    booked_at: null,
  });
  const next = unitsOf(requestId).find((u) => u.status === "booked");
  const values: Row = {};
  if (request.driver_id === droppedDriver) values.driver_id = next?.driver_id ?? null;
  emit("request", request, values);
  setRequestStatus(String(requestId), "pending");
  if (rental.vehicle_id === droppedVehicle)
    emit("charter_rental", rental, { vehicle_id: next?.vehicle_id ?? null });
  return droppedDriver;
};

const dropRentalJob = (a: any) => {
  const mine = myDriverIds();
  const unit = db.tables.charter_rental_unit.find(
    (u) =>
      u.request_id === a.p_request_id &&
      mine.includes(String(u.driver_id)) &&
      u.status === "booked",
  );
  if (!unit) return fail("You are not booked on this rental.");
  const request = requestOf(a.p_request_id);
  if (!request || !["pending", "accepted"].includes(String(request.request_status)))
    return fail("This rental can no longer be dropped.");
  const rental = rentalOf(a.p_request_id)!;
  if (timeOf(rental.pickup_time) <= db.now().getTime())
    fail("The pickup time has passed, so this job can't be dropped.");
  const plate = vehicleOf(unit.vehicle_id)?.plate_number;
  const name = String(profileOf(uid())?.first_name || "") || "Your driver";
  reopenUnit(unit, a.p_request_id, rental);
  notify(
    commuterRow(request.commuter_id)?.user_id,
    "rental_driver_left",
    "A driver dropped your rental",
    `${name}${plate ? ` (${plate})` : ""} can no longer drive your rental to ${rental.rental_destination} on ${whenText(rental.pickup_time)}. The ${lower(unit.vehicle_type)} is back on the job board for other drivers.`,
    { request_id: a.p_request_id },
  );
  return null;
};

const dismissRentalJob = (a: any) => {
  const rental = rentalOf(a.p_request_id);
  if (rental)
    rental.dismissed_by = [
      ...new Set([...((rental.dismissed_by as string[] | undefined) ?? []), ...myDriverIds()]),
    ];
  return null;
};

const completeRental = (a: any) => {
  const commuter = myCommuter();
  const request = requestOf(a.p_request_id);
  if (
    !request ||
    !commuter ||
    request.commuter_id !== commuter.commuter_id ||
    request.request_type !== "Charter_Rental"
  )
    return fail("Only the commuter who posted this rental can complete it.", "42501");
  if (
    !["pending", "accepted"].includes(String(request.request_status)) ||
    !unitsOf(request.request_id).some((u) => u.status === "booked")
  )
    return fail("Only rentals with a booked driver can be completed.");
  for (const unit of unitsOf(request.request_id)) {
    if (unit.status === "booked") emit("charter_rental_unit", unit, { status: "completed" });
    else if (unit.status === "open") removeRow("charter_rental_unit", unit);
  }
  setRequestStatus(String(request.request_id), "completed");
  notify(
    commuter.user_id,
    "rate_trip",
    "How was your trip?",
    "Rate your rental to help other commuters and your driver.",
    { request_id: request.request_id },
  );
  const destination =
    (rentalOf(request.request_id)?.rental_destination as string) ?? "their destination";
  const recipients = new Set(
    unitsOf(request.request_id)
      .filter((u) => u.driver_id)
      .map((u) => driverUserId(u.driver_id)),
  );
  for (const userId of recipients)
    notify(
      userId,
      "rental_job_completed",
      "Rental completed",
      `The commuter marked the rental to ${destination} as completed. Thanks for driving!`,
      { request_id: request.request_id },
    );
  return null;
};

const cancelMyRental = (a: any) => {
  const commuter = myCommuter();
  const request = requestOf(a.p_request_id);
  if (
    !request ||
    !commuter ||
    request.commuter_id !== commuter.commuter_id ||
    request.request_type !== "Charter_Rental" ||
    !["pending", "accepted"].includes(String(request.request_status))
  )
    return fail("This rental can no longer be cancelled.");
  const rental = rentalOf(request.request_id);
  const destination = (rental?.rental_destination as string | undefined) ?? "their destination";
  const units = unitsOf(request.request_id);
  const recipients = new Set<unknown>();
  for (const id of new Set([request.driver_id, ...units.map((u) => u.driver_id)]))
    if (id) recipients.add(driverUserId(id));
  for (const userId of recipients)
    notify(
      userId,
      "rental_cancelled",
      "Rental cancelled",
      `The commuter cancelled their rental to ${destination}.`,
      { request_id: request.request_id },
    );
  if (rental) removeRow("charter_rental", rental);
  removeRow("request", request);
  for (const unit of units) removeRow("charter_rental_unit", unit);
  return null;
};

const removeRentalDriver = (a: any) => {
  const unit = db.tables.charter_rental_unit.find((u) => u.unit_id === a.p_unit_id);
  if (!unit) return fail("This vehicle is no longer on your rental.");
  const request = requestOf(unit.request_id);
  const commuter = myCommuter();
  if (!request || !commuter || request.commuter_id !== commuter.commuter_id)
    return fail("Only the commuter who posted this rental can change its drivers.", "42501");
  if (!["pending", "accepted"].includes(String(request.request_status)) || unit.status !== "booked")
    fail("This driver can no longer be removed.");
  const rental = rentalOf(unit.request_id)!;
  const droppedDriver = reopenUnit(unit, unit.request_id, rental);
  const when = whenText(rental.pickup_time);
  notify(
    driverUserId(droppedDriver),
    "rental_driver_removed",
    "Removed from a rental",
    `The commuter removed you from the rental to ${rental.rental_destination} on ${when}. You can take it again from the job board while a vehicle is still open.`,
    {
      request_id: unit.request_id,
      destination: rental.rental_destination,
      pickup_time: rental.pickup_time,
    },
  );
  if (timeOf(rental.pickup_time) > db.now().getTime()) {
    const end = rental.return_time ? timeOf(rental.return_time) : null;
    const recipients = new Set<unknown>();
    for (const driver of db.tables.driver) {
      const vehicle = vehicleOf(driver.vehicle_id);
      const personnel = db.tables.transit_personnel.find(
        (p) => p.personnel_id === driver.personnel_id,
      );
      if (!vehicle || !personnel || vehicle.vehicle_type !== unit.vehicle_type) continue;
      if (driver.driver_id === droppedDriver) continue;
      if ((personnel.employment_status ?? "Active") !== "Active") continue;
      if (unitsOf(unit.request_id).some((u) => u.driver_id === driver.driver_id)) continue;
      if (vehicleBusy(vehicle.vehicle_id, timeOf(rental.pickup_time), end, unit.request_id))
        continue;
      recipients.add(personnel.user_id);
    }
    for (const userId of recipients)
      notify(
        userId,
        "rental_request",
        "Rental job reopened",
        `A ${lower(unit.vehicle_type)} is needed for a rental to ${rental.rental_destination} on ${when}. Open the job board to take it.`,
        { request_id: unit.request_id },
      );
  }
  return null;
};

const rateRentalDriver = (a: any) => {
  const score = a.p_score;
  const feedback = String(a.p_feedback ?? "").trim() || null;
  const tags = [...new Set(((a.p_tags ?? []) as string[]).map((t) => t.trim()).filter(Boolean))];
  if (score == null || score < 1 || score > 5) fail("Choose between 1 and 5 stars.");
  if ((feedback ?? "").length > 500) fail("Keep your feedback under 500 characters.");
  const commuter = myCommuter();
  const request = requestOf(a.p_request_id);
  if (
    !request ||
    !commuter ||
    request.commuter_id !== commuter.commuter_id ||
    request.request_type !== "Charter_Rental"
  )
    return fail("This booking was not found.", "42501");
  if (request.request_status !== "completed")
    fail("You can rate your drivers once the rental is completed.");
  if (
    !unitsOf(request.request_id).some(
      (u) => u.driver_id === a.p_driver_id && u.status === "completed",
    ) &&
    request.driver_id !== a.p_driver_id
  )
    fail("This driver wasn't part of your rental.");
  if (db.tables.rating.some((r) => r.request_id === a.p_request_id && r.driver_id === a.p_driver_id))
    fail("You already rated this driver.");
  const row: Row = {
    rating_id: db.id(),
    history_id: null,
    request_id: a.p_request_id,
    driver_id: a.p_driver_id,
    score,
    feedback,
    tags: tags.length ? tags : null,
    rated_at: iso(),
  };
  db.tables.rating.push(row);
  db.emit({ table: "rating", type: "INSERT", row });
  const destination =
    (rentalOf(a.p_request_id)?.rental_destination as string) ?? "their destination";
  notify(
    driverUserId(a.p_driver_id),
    "rating_received",
    `New ${score}-star rating`,
    feedback
      ? `"${feedback.slice(0, 120)}"`
      : tags.length
        ? tags.join(" · ")
        : `A commuter rated your rental to ${destination}.`,
    { request_id: a.p_request_id, score },
  );
  return null;
};

export const rentalHandlers: Record<string, (args: any) => unknown> = {
  post_charter_rental: postCharterRental,
  get_my_rental: getMyRental,
  get_my_rentals: getMyRentals,
  get_my_rental_requests: getMyRentalRequests,
  get_rental_job_board: getRentalJobBoard,
  accept_rental_job: acceptRentalJob,
  drop_rental_job: dropRentalJob,
  dismiss_rental_job: dismissRentalJob,
  complete_rental: completeRental,
  cancel_my_rental: cancelMyRental,
  remove_rental_driver: removeRentalDriver,
  rate_rental_driver: rateRentalDriver,
};
