import {
  findRoute,
  vehicleTypeLabels,
  type LatLng,
  type VehicleType,
} from "@/api/v1/transit-routes/controllers";

// Operator assignments are managed by the transport cooperative in the admin
// dashboard. Transit personnel can only view them in the app.

export type OperationArea = {
  id: string;
  name: string;
  description: string;
  center: LatLng;
  radiusMeters: number;
  barangays: string[];
};

export const operationAreas: OperationArea[] = [
  {
    id: "downtown-naga",
    name: "Downtown Naga",
    description: "Naga City's central business district and nearby barangays.",
    center: [13.6235, 123.186],
    radiusMeters: 1400,
    barangays: [
      "Abella",
      "Dinaga",
      "Igualdad Interior",
      "Lerma",
      "San Francisco",
      "Santa Cruz",
      "Tabuco",
    ],
  },
  {
    id: "upper-barangays",
    name: "Upper Barangays",
    description: "The upland barangays of Naga City along the Mt. Isarog foothills.",
    center: [13.655, 123.262],
    radiusMeters: 4200,
    barangays: ["Carolina", "Cararayan", "Pacol", "Panicuason", "San Isidro"],
  },
];

export type Cooperative = { name: string };

export type OperatorVehicle = {
  vehicle_type: VehicleType;
  plate_number: string;
  max_capacity: number;
};

// Buses, vans and jeepneys run on exactly one route. Tricycles are not tied to
// a route and operate anywhere inside an operation area instead.
export type OperatorAssignment = {
  cooperative: Cooperative;
} & (
  | {
      vehicle: OperatorVehicle & { vehicle_type: Exclude<VehicleType, "tricy"> };
      routeId: string;
    }
  | {
      vehicle: OperatorVehicle & { vehicle_type: "tricy" };
      areaId: string;
    }
);

const sampleAssignments = {
  jeepney: {
    cooperative: { name: "SAFETRASCO - San Felipe Transport Cooperative" },
    vehicle: { vehicle_type: "jeep", plate_number: "JPA-001", max_capacity: 24 },
    routeId: "naga-san-felipe",
  },
  tricycle: {
    cooperative: { name: "Naga City Tricycle Operators and Drivers Association" },
    vehicle: { vehicle_type: "tricy", plate_number: "TRC-214", max_capacity: 6 },
    areaId: "downtown-naga",
  },
} satisfies Record<string, OperatorAssignment>;

// Switch to "tricycle" to preview the operation-area flow.
const demoAssignment: keyof typeof sampleAssignments = "jeepney";

export async function loadOperatorAssignment(): Promise<OperatorAssignment> {
  return sampleAssignments[demoAssignment];
}

export type AssignmentDetails = {
  assignment: OperatorAssignment;
  vehicleLabel: string;
  coverageTitle: string;
  route: ReturnType<typeof findRoute>;
  area: OperationArea | null;
};

export function describeAssignment(
  assignment: OperatorAssignment,
): AssignmentDetails {
  const route = "routeId" in assignment ? findRoute(assignment.routeId) : null;
  const area =
    "areaId" in assignment
      ? (operationAreas.find((option) => option.id === assignment.areaId) ??
        null)
      : null;

  return {
    assignment,
    vehicleLabel: vehicleTypeLabels[assignment.vehicle.vehicle_type],
    coverageTitle: route?.name ?? area?.name ?? "Unassigned",
    route,
    area,
  };
}
