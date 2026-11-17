import { transitRouteApi } from "@/api/v1/transit-routes/routes";
import type { RoadRouter } from "@/simulation/engine";

const ROUTE_TIMEOUT_MS = 8_000;

export const mapboxRoadRouter: RoadRouter = async (from, to) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ROUTE_TIMEOUT_MS);
  });
  const routed = transitRouteApi
    .etaRoute(from, to)
    .then((response) => {
      const coordinates = response.routes?.[0]?.geometry?.coordinates;
      if (!coordinates?.length) return null;
      return coordinates.map(([lng, lat]): [number, number] => [lat, lng]);
    })
    .catch(() => null);
  const path = await Promise.race([routed, timeout]);
  clearTimeout(timer);
  return path;
};
