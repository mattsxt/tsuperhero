import { getSupabaseClient } from "@/api/v1/client";

export type AssignmentRow = {
  role: "driver" | "conductor";
  vehicle: {
    vehicle_id: string;
    plate_number: string;
    vehicle_type: "Bus" | "Jeepney" | "Tricycle" | "Van";
    vehicle_status: string;
    max_capacity: number;
    is_modern: boolean;
    documents_checked: string[] | null;
    verified_at: string | null;
  };
  operator: { operator_type: string; name: string } | null;
  route_id: string | null;
};

export const operatorRoutes = {
  findMyAssignment: () => getSupabaseClient().rpc("get_my_vehicle_assignment"),
};
