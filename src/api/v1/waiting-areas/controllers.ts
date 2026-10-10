import { unwrapCached } from "@/api/v1/cache";
import { attempt, type Result } from "@/api/v1/result";
import { waitingAreaRoutes } from "@/api/v1/waiting-areas/routes";
import type { WaitingAreaRow } from "@/api/v1/waiting-areas/types";
import {
  parseWaitingAreaType,
  type WaitingAreaType,
} from "@/constants/waiting-area";
import { getDistanceMeters, isNearPath, type Coordinates } from "@/utils/geo";

export type { WaitingAreaType } from "@/constants/waiting-area";

export type WaitingArea = {
  id: string;
  name: string;
  type: WaitingAreaType;
  lat: number;
  lng: number;
  routeId: string | null;
  vicinity: string | null;
};

const onRouteMeters = 40;

let knownWaitingAreas: WaitingArea[] = [];
export const getKnownWaitingAreas = () => knownWaitingAreas;

export async function loadWaitingAreas(): Promise<Result<WaitingArea[]>> {
  const result = await attempt(async (): Promise<WaitingArea[]> => {
    const rows: WaitingAreaRow[] =
      (await unwrapCached("waiting-areas", waitingAreaRoutes.listActive())) ??
      [];
    return rows.map((row) => ({
      id: row.area_id,
      name: row.area_name,
      type: parseWaitingAreaType(row.area_type),
      lat: row.area_latitude,
      lng: row.area_longitude,
      routeId: row.route_id ?? null,
      vicinity: row.vicinity?.trim() || null,
    }));
  });
  if (result.ok) knownWaitingAreas = result.data;
  return result;
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

export type WaitingAreaRecommendation = WaitingArea & {
  distanceMeters: number;
};

export function findNearestWaitingArea(
  origin: Coordinates,
  areas: WaitingArea[],
  routeId: string,
  paths: [number, number][][],
  routeVicinity: string[] = [],
): WaitingAreaRecommendation | null {
  return (
    findWaitingAreasOnRoute(areas, routeId, paths, routeVicinity)
      .map((area) => ({
        ...area,
        distanceMeters: getDistanceMeters(origin, area),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] ?? null
  );
}

export function formatDistance(meters: number) {
  return meters < 1000
    ? `${Math.round(meters / 10) * 10} m`
    : `${(meters / 1000).toFixed(1)} km`;
}
