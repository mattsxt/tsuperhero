import { attempt, unwrap, type Result } from "@/api/v1/result";
import { waitingAreaRoutes } from "@/api/v1/waiting-areas/routes";
import type { WaitingAreaRow } from "@/api/v1/waiting-areas/types";

export type WaitingArea = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  routeId: string | null;
  vicinity: string | null;
};

export type NearbyWaitingArea = WaitingArea & {
  distanceMeters: number;
  walkMinutes: number;
};

type Coordinates = { lat: number; lng: number };

export const maxWalkMeters = 1000;
export const onRouteMeters = 40;

const earthRadiusMeters = 6_371_000;
const walkMetersPerMinute = 80;

export async function loadWaitingAreas(): Promise<Result<WaitingArea[]>> {
  return attempt(async () => {
    const rows: WaitingAreaRow[] =
      (await unwrap(waitingAreaRoutes.listActive())) ?? [];
    return rows.map(({ id, name, lat, lng, route_id, vicinity, route }) => {
      const areaVicinity = vicinity?.trim() || null;
      const matchingRouteVicinity =
        areaVicinity && Array.isArray(route?.vicinity)
          ? route.vicinity.find(
              (item) => item.toLowerCase() === areaVicinity.toLowerCase(),
            )
          : null;

      return {
        id,
        name,
        lat,
        lng,
        routeId: route_id,
        vicinity: matchingRouteVicinity ?? areaVicinity,
      };
    });
  });
}

export function getDistanceMeters(from: Coordinates, to: Coordinates) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDelta = radians(to.lat - from.lat);
  const lngDelta = radians(to.lng - from.lng);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(from.lat)) *
      Math.cos(radians(to.lat)) *
      Math.sin(lngDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a));
}

function getSegmentDistanceMeters(
  point: Coordinates,
  [startLat, startLng]: [number, number],
  [endLat, endLng]: [number, number],
) {
  const metersPerLat = 111_320;
  const metersPerLng = metersPerLat * Math.cos((point.lat * Math.PI) / 180);
  const pointX = (point.lng - startLng) * metersPerLng;
  const pointY = (point.lat - startLat) * metersPerLat;
  const endX = (endLng - startLng) * metersPerLng;
  const endY = (endLat - startLat) * metersPerLat;
  const lengthSquared = endX * endX + endY * endY;
  const along = lengthSquared
    ? Math.max(0, Math.min(1, (pointX * endX + pointY * endY) / lengthSquared))
    : 0;
  return Math.hypot(pointX - endX * along, pointY - endY * along);
}

export function findWaitingAreasOnRoute(
  areas: WaitingArea[],
  routeId: string,
  paths: [number, number][][],
): WaitingArea[] {
  return areas.filter(
    (area) =>
      area.routeId === routeId ||
      paths.some((path) =>
        path
          .slice(1)
          .some(
            (end, index) =>
              getSegmentDistanceMeters(area, path[index], end) <=
              onRouteMeters,
          ),
      ),
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
        walkMinutes: Math.max(1, Math.round(distanceMeters / walkMetersPerMinute)),
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
