import { getSupabaseClient } from "@/api/v1/client";

const waitingAreaTable = () => getSupabaseClient().from("waiting_area");

export const waitingAreaRoutes = {
  listActive: () =>
    waitingAreaTable()
      .select("id,name,lat,lng,route_id,vicinity,route:routes(route_name,route_code,vicinity)")
      .eq("is_active", true),
};
