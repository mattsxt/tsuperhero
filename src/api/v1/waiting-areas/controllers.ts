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

type PathPosition = {
  distanceMeters: number;
  alongPathMeters: number;
};

function measurePathPosition(
  point: Coordinates,
  path: [number, number][],
): PathPosition | null {
  if (path.length === 0) return null;
  if (path.length === 1) {
    return {
      distanceMeters: getDistanceMeters(point, {
        lat: path[0][0],
        lng: path[0][1],
      }),
      alongPathMeters: 0,
    };
  }

  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const metersPerLatitude = 111_320;
  let traversedMeters = 0;
  let nearest: PathPosition = {
    distanceMeters: Number.POSITIVE_INFINITY,
    alongPathMeters: 0,
  };

  for (let index = 1; index < path.length; index += 1) {
    const [startLat, startLng] = path[index - 1];
    const [endLat, endLng] = path[index];
    const metersPerLongitude =
      metersPerLatitude * Math.cos(radians(point.lat));
    const pointX = (point.lng - startLng) * metersPerLongitude;
    const pointY = (point.lat - startLat) * metersPerLatitude;
    const endX = (endLng - startLng) * metersPerLongitude;
    const endY = (endLat - startLat) * metersPerLatitude;
    const lengthSquared = endX * endX + endY * endY;
    const fraction = lengthSquared
      ? Math.max(0, Math.min(1, (pointX * endX + pointY * endY) / lengthSquared))
      : 0;
    const projected = {
      lat: startLat + (endLat - startLat) * fraction,
      lng: startLng + (endLng - startLng) * fraction,
    };
    const distanceMeters = getDistanceMeters(point, projected);
    const segmentMeters = getDistanceMeters(
      { lat: startLat, lng: startLng },
      { lat: endLat, lng: endLng },
    );

    if (distanceMeters < nearest.distanceMeters) {
      nearest = {
        distanceMeters,
        alongPathMeters: traversedMeters + segmentMeters * fraction,
      };
    }
    traversedMeters += segmentMeters;
  }

  return nearest;
}

export function findFirstWaitingAreaAlongPath(
  path: [number, number][],
  areas: WaitingArea[],
  destinationId: string,
  maxDistanceMeters = 40,
): WaitingArea | null {
  const destination = areas.find((area) => area.id === destinationId);
  if (!destination) return null;

  const destinationPosition = measurePathPosition(destination, path);
  if (!destinationPosition) return null;

  return areas
    .filter((area) => area.id !== destinationId)
    .map((area) => ({
      area,
      position: measurePathPosition(area, path),
    }))
    .filter(
      (
        candidate,
      ): candidate is { area: WaitingArea; position: PathPosition } =>
        !!candidate.position &&
        candidate.position.distanceMeters <= maxDistanceMeters &&
        candidate.position.alongPathMeters <
          destinationPosition.alongPathMeters - maxDistanceMeters,
    )
    .sort(
      (left, right) =>
        left.position.alongPathMeters - right.position.alongPathMeters,
    )[0]?.area ?? null;
}

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
