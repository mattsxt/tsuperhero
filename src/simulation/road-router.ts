import { transitRouteApi } from "@/api/v1/transit-routes/routes";
import type { RoadRouter } from "@/simulation/engine";
import { localRoadPath } from "@/simulation/local-roads";

const ROUTE_TIMEOUT_MS = 4_000;

const onlineRoute: RoadRouter = async (from, to) => {
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

export const mapboxRoadRouter: RoadRouter = async (from, to) =>
  (await onlineRoute(from, to)) ?? localRoadPath(from, to);
