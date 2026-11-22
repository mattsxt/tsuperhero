import { getSupabaseClient } from "@/api/v1/client";

const waitingAreaTable = () => getSupabaseClient().from("waiting_area");

export const waitingAreaRoutes = {
  listActive: () => waitingAreaTable().select("*").eq("is_active", true),
};
