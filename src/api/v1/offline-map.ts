import type { TransitRoute } from "@/api/v1/transit-routes/controllers";

// Offline map packs need the native Mapbox SDK, so the web build skips them.
export async function saveOfflineMap(routes: TransitRoute[]): Promise<void> {
  void routes;
}
