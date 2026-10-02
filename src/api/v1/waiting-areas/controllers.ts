import { attempt, unwrap, type Result } from "@/api/v1/result";
import { waitingAreaRoutes } from "@/api/v1/waiting-areas/routes";
import type { WaitingAreaRow } from "@/api/v1/waiting-areas/types";
import { getDistanceMeters, isNearPath, type Coordinates } from "@/utils/geo";

export type WaitingAreaType = "stop" | "terminal";

export type WaitingArea = {
  id: string;
  name: string;
  type: WaitingAreaType;
  lat: number;
  lng: number;
  routeId: string | null;
  vicinity: string | null;
};

export type NearbyWaitingArea = WaitingArea & {
  distanceMeters: number;
  walkMinutes: number;
};

export const maxWalkMeters = 1000;
export const onRouteMeters = 40;

const walkMetersPerMinute = 80;

export async function loadWaitingAreas(): Promise<Result<WaitingArea[]>> {
  return attempt(async () => {
    const rows: WaitingAreaRow[] =
      (await unwrap(waitingAreaRoutes.listActive())) ?? [];
    return rows.map(({ id, name, lat, lng, route_id, vicinity, type }) => ({
      id,
      name,
      type: type?.trim().toLowerCase() === "terminal" ? "terminal" : "stop",
      lat,
      lng,
      routeId: route_id ?? null,
      vicinity: vicinity?.trim() || null,
    }));
  });
}

export function findWaitingAreasOnRoute(
  areas: WaitingArea[],
  routeId: string,
  paths: [number, number][][],
  routeVicinity: string[] = [],
): WaitingArea[] {
  const vicinities = routeVicinity.map((name) => name.toLowerCase());
  return areas.filter(
    (area) =>
      area.routeId === routeId ||
      (!!area.vicinity && vicinities.includes(area.vicinity.toLowerCase())) ||
      paths.some((path) => isNearPath(area, path, onRouteMeters)),
  );
}

export function findNearestWaitingAreas(
  origin: Coordinates,
  areas: WaitingArea[],
  routeId?: string | null,
): NearbyWaitingArea[] {
  return areas
    .filter((area) => !routeId || area.routeId === routeId)
    .map((area) => {
      const distanceMeters = getDistanceMeters(origin, area);
      return {
        ...area,
        distanceMeters,
        walkMinutes: Math.max(
          1,
          Math.round(distanceMeters / walkMetersPerMinute),
        ),
      };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export function recommendWaitingArea(
  origin: Coordinates,
  areas: WaitingArea[],
  routeId?: string | null,
) {
  const [nearest] = findNearestWaitingAreas(origin, areas, routeId);
  return nearest && nearest.distanceMeters <= maxWalkMeters ? nearest : null;
}

export function formatDistance(meters: number) {
  return meters < 1000
    ? `${Math.round(meters / 10) * 10} m`
    : `${(meters / 1000).toFixed(1)} km`;
}
