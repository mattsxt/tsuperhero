import { routes } from "@/simulation/seed/geography";
import { roadGeometry } from "@/simulation/seed/road-geometry.generated";
import type { LatLngPair } from "@/utils/geo";

export function roadPath(routeId: unknown): LatLngPair[] | null {
  const baked = roadGeometry[String(routeId)]?.path;
  if (baked && baked.length > 1) return baked;
  const raw = routes.find((r) => r.route_id === routeId)?.path;
  return Array.isArray(raw) && raw.length > 1 ? (raw as LatLngPair[]) : null;
}
