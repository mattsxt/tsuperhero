import AsyncStorage from "@react-native-async-storage/async-storage";

import { attempt, unwrap, type Result } from "@/api/v1/result";
import {
  routeTableRoutes,
  transitRouteApi,
  type LatLng,
  type RouteRow,
} from "@/api/v1/transit-routes/routes";
import { getPairDistanceMeters } from "@/utils/geo";

export type { LatLng };

export type VehicleType = "jeep" | "tricy";

export type TransitRoute = {
  id: string;
  name: string;
  code: string;
  waypoints: LatLng[];
  alternativePaths: LatLng[][];
  vicinity: string[];
};

export type RouteVehicle = {
  id: string;
  plate: string;
  type: VehicleType;
  maxCapacity: number;
  currentCapacity: number;
  status: string;
  towards: string;
  lat: number;
  lng: number;
};

export type Terminal = {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  routeCodes: string[];
};

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export const vehicleTypeLabels: Record<VehicleType, string> = {
  jeep: "Jeepney",
  tricy: "Tricycle",
};

let transitRoutes: TransitRoute[] = [];
let routesRequest: Promise<Result<TransitRoute[]>> | null = null;
const routeListeners = new Set<() => void>();

export const getTransitRoutes = () => transitRoutes;

export function subscribeToTransitRoutes(listener: () => void) {
  routeListeners.add(listener);
  return () => {
    routeListeners.delete(listener);
  };
}

function parsePath(path: unknown): LatLng[] {
  if (!Array.isArray(path)) return [];
  return path.flatMap((point): LatLng[] => {
    const [lat, lng] = Array.isArray(point)
      ? point
      : [
          point?.lat ?? point?.latitude,
          point?.lng ?? point?.lon ?? point?.longitude,
        ];
    return typeof lat === "number" && typeof lng === "number"
      ? [[lat, lng]]
      : [];
  });
}

function parseAlternativePaths(paths: unknown): LatLng[][] {
  if (!Array.isArray(paths)) return [];
  const single = parsePath(paths);
  const list = single.length > 0 ? [single] : paths.map(parsePath);
  return list.filter((path) => path.length > 1);
}

export function loadTransitRoutes(): Promise<Result<TransitRoute[]>> {
  routesRequest ??= attempt(async () => {
    const rows: RouteRow[] =
      (await unwrap(routeTableRoutes.listRoutes())) ?? [];
    transitRoutes = rows.map((row) => ({
      id: row.route_id,
      name: row.route_name,
      code: row.route_code,
      waypoints: parsePath(row.path),
      alternativePaths: parseAlternativePaths(row.alternative_paths),
      vicinity: Array.isArray(row.vicinity)
        ? row.vicinity.filter((item) => typeof item === "string")
        : [],
    }));
    routeListeners.forEach((listener) => listener());
    return transitRoutes;
  }).then((result) => {
    if (!result.ok) routesRequest = null;
    return result;
  });
  return routesRequest;
}

export const terminals: Terminal[] = [];

export function findRoute(id: string | null | undefined) {
  return transitRoutes.find((route) => route.id === id) ?? null;
}

export function findTerminal(id: string | null | undefined) {
  return terminals.find((terminal) => terminal.id === id) ?? null;
}

export function getRouteTerminals(routeId: string) {
  const code = findRoute(routeId)?.code;
  return code
    ? terminals.filter((terminal) => terminal.routeCodes.includes(code))
    : [];
}

export type DestinationResults = {
  terminals: (Terminal & { routes: TransitRoute[] })[];
  routes: TransitRoute[];
};

export function searchDestinations(query: string): DestinationResults {
  const needle = query.trim().toLowerCase();
  const matches = (value: string) => value.toLowerCase().includes(needle);

  const matchingTerminals = terminals
    .filter(
      (terminal) => !needle || matches(terminal.name) || matches(terminal.city),
    )
    .map((terminal) => ({
      ...terminal,
      routes: transitRoutes.filter((route) =>
        terminal.routeCodes.includes(route.code),
      ),
    }));

  return {
    terminals: matchingTerminals,
    routes: needle ? transitRoutes.filter((route) => matches(route.name)) : [],
  };
}

export function isInBounds(
  { lat, lng }: { lat: number; lng: number },
  bounds: MapBounds | null,
) {
  if (!bounds) return true;
  const withinLng =
    bounds.west <= bounds.east
      ? lng >= bounds.west && lng <= bounds.east
      : lng >= bounds.west || lng <= bounds.east;
  return lat >= bounds.south && lat <= bounds.north && withinLng;
}

export const vehicleMaxCapacity: Record<VehicleType, number> = {
  jeep: 24,
  tricy: 6,
};

export function getOccupancyLevel(current: number, max: number) {
  const ratio = current / max;
  if (ratio >= 1) return "Full";
  if (ratio >= 0.8) return "Almost Full";
  if (ratio >= 0.5) return "Moderate";
  return "Available";
}

const isDetour = (roadMeters: number, straightMeters: number) =>
  roadMeters > straightMeters * 1.6 + 60;

const roadCache = new Map<string, Promise<LatLng[]>>();

function getRoadCacheKey(points: LatLng[]) {
  let hash = 5381;
  for (const character of JSON.stringify(points)) {
    hash = ((hash << 5) + hash + character.charCodeAt(0)) | 0;
  }
  return `road-geometry:v1:${points.length}:${hash}`;
}

function followRoads(points: LatLng[]): Promise<LatLng[]> {
  const key = getRoadCacheKey(points);
  const cached = roadCache.get(key);
  if (cached) return cached;

  const request = (async () => {
    const stored = await AsyncStorage.getItem(key).catch(() => null);
    if (stored) return JSON.parse(stored) as LatLng[];

    const roads = await requestRoads(points);
    if (roads) {
      AsyncStorage.setItem(key, JSON.stringify(roads)).catch(() => {});
      return roads;
    }
    roadCache.delete(key);
    return points;
  })();
  roadCache.set(key, request);
  return request;
}

async function requestRoads(points: LatLng[]): Promise<LatLng[] | null> {
  try {
    const response = await transitRouteApi.drivingRoute(points);
    const legs = response.routes?.[0]?.legs;
    if (legs?.length !== points.length - 1) {
      throw new Error(response.error?.message);
    }
    return legs.flatMap((leg, index): LatLng[] => {
      const straight: LatLng[] = [points[index], points[index + 1]];
      const coordinates = leg.polyline?.geoJsonLinestring?.coordinates;
      if (
        !coordinates?.length ||
        isDetour(
          leg.distanceMeters ?? 0,
          getPairDistanceMeters(straight[0], straight[1]),
        )
      ) {
        return straight;
      }
      return coordinates.map(([lng, lat]): LatLng => [lat, lng]);
    });
  } catch {
    return null;
  }
}

export function loadRouteGeometry(route: TransitRoute): Promise<LatLng[]> {
  return followRoads(route.waypoints);
}

export function loadAlternativeGeometry(
  route: TransitRoute,
): Promise<LatLng[][]> {
  return Promise.all(route.alternativePaths.map(followRoads));
}

export function pointAlong(path: LatLng[], fraction: number): LatLng {
  const lengths = path.slice(1).map(([lat, lng], index) => {
    const [prevLat, prevLng] = path[index];
    const x = (lng - prevLng) * Math.cos((lat * Math.PI) / 180);
    return Math.hypot(x, lat - prevLat);
  });
  let remaining = lengths.reduce((sum, length) => sum + length, 0) * fraction;

  for (let index = 0; index < lengths.length; index++) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      const t = lengths[index] ? Math.min(remaining / lengths[index], 1) : 0;
      const [startLat, startLng] = path[index];
      const [endLat, endLng] = path[index + 1];
      return [
        startLat + (endLat - startLat) * t,
        startLng + (endLng - startLng) * t,
      ];
    }
    remaining -= lengths[index];
  }
  return path[0];
}
