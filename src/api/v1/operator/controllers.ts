import { operatorRoutes, type AssignmentRow } from "@/api/v1/operator/routes";
import { unwrap } from "@/api/v1/result";
import {
  findRoute,
  loadTransitRoutes,
  vehicleTypeLabels,
  type VehicleType,
} from "@/api/v1/transit-routes/controllers";

type Cooperative = { name: string; type: string };

type OperatorVehicle = {
  vehicle_type: VehicleType;
  plate_number: string;
  max_capacity: number;
  verified: boolean;
};

export type OperatorAssignment = {
  cooperative: Cooperative | null;
  vehicle: OperatorVehicle;
  routeId: string | null;
};

const toVehicleType = (type: AssignmentRow["vehicle"]["vehicle_type"]) =>
  type === "Tricycle" ? "tricy" : "jeep";

export async function loadOperatorAssignment(): Promise<OperatorAssignment | null> {
  try {
    const [row]: [AssignmentRow | null, unknown] = await Promise.all([
      unwrap(operatorRoutes.findMyAssignment()),
      loadTransitRoutes(),
    ]);
    if (!row) return null;

    return {
      cooperative: row.operator
        ? { name: row.operator.name, type: row.operator.operator_type }
        : null,
      vehicle: {
        vehicle_type: toVehicleType(row.vehicle.vehicle_type),
        plate_number: row.vehicle.plate_number,
        max_capacity: row.vehicle.max_capacity,
        verified: row.vehicle.verified_at !== null,
      },
      routeId: row.route_id,
    };
  } catch {
    return null;
  }
}

export type AssignmentDetails = {
  assignment: OperatorAssignment;
  vehicleLabel: string;
  coverageTitle: string;
  route: ReturnType<typeof findRoute>;
};

export function describeAssignment(
  assignment: OperatorAssignment,
): AssignmentDetails {
  const route = findRoute(assignment.routeId);

  return {
    assignment,
    vehicleLabel: vehicleTypeLabels[assignment.vehicle.vehicle_type],
    coverageTitle: route?.name ?? "Unassigned",
    route,
  };
}
