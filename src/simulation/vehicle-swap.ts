import { currentUserId } from "@/simulation/auth";
import { db, type Row } from "@/simulation/db";
import { vehicleId } from "@/simulation/seed/people";

export type DemoVehicleType = "Jeepney" | "Tricycle";

const demoVehicle: Record<DemoVehicleType, () => string> = {
  Jeepney: () => vehicleId("mario"),
  Tricycle: () => vehicleId("pedro"),
};

const myDriverRow = (): Row | undefined => {
  const personnel = db.tables.transit_personnel.find((p) => p.user_id === currentUserId());
  if (!personnel) return undefined;
  return db.tables.driver.find(
    (d) => d.personnel_id === personnel.personnel_id && d.vehicle_id,
  );
};

const vehicleOf = (id: unknown) => db.tables.vehicle.find((v) => v.vehicle_id === id);

export function myVehicleType(): DemoVehicleType | null {
  const type = vehicleOf(myDriverRow()?.vehicle_id)?.vehicle_type;
  return type === "Jeepney" || type === "Tricycle" ? type : null;
}

const onTrip = (vehicle: unknown) =>
  db.tables.trip.some((t) => t.vehicle_id === vehicle && t.trip_status === "active");

export function swapDemoVehicle(): { ok: boolean; message: string } {
  const mine = myDriverRow();
  const current = myVehicleType();
  if (!mine || !current) return { ok: false, message: "Sign in as a driver first" };
  const next: DemoVehicleType = current === "Jeepney" ? "Tricycle" : "Jeepney";
  const target = demoVehicle[next]();
  const from = mine.vehicle_id;
  if (onTrip(from) || onTrip(target)) return { ok: false, message: "End the trip first" };
  const other = db.tables.driver.find((d) => d.vehicle_id === target && d !== mine);
  Object.assign(mine, { vehicle_id: target });
  db.emit({ table: "driver", type: "UPDATE", row: mine });
  if (other) {
    Object.assign(other, { vehicle_id: from });
    db.emit({ table: "driver", type: "UPDATE", row: other });
  }
  return { ok: true, message: next === "Tricycle" ? "Now driving a tricycle" : "Now driving a jeepney" };
}
