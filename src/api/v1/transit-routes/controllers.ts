import AsyncStorage from "@react-native-async-storage/async-storage";

import { unwrapCached } from "@/api/v1/cache";
import { attempt, unwrap, type Result } from "@/api/v1/result";
import {
  routeTableRoutes,
  transitRouteApi,
  type LatLng,
  type LiveVehicleRow,
  type RouteRow,
} from "@/api/v1/transit-routes/routes";
import { distanceToPath, getPairDistanceMeters } from "@/utils/geo";

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

export const toVehicleType = (type: string): VehicleType =>
  type === "Tricycle" ? "tricy" : "jeep";

export const vehicleTypeLabels: Record<VehicleType, string> = {
  jeep: "Jeepney",
  tricy: "Tricycle",
};

let transitRoutes: TransitRoute[] = [];
let selectableRoutes: TransitRoute[] = [];
let routesRequest: Promise<Result<TransitRoute[]>> | null = null;
const routeListeners = new Set<() => void>();

const areaWidePattern = /\b(within|outside)\s+(of\s+)?naga\b/i;

const isAreaWideRoute = (route: TransitRoute) =>
  areaWidePattern.test(route.name) || areaWidePattern.test(route.code);

export const getTransitRoutes = () => selectableRoutes;

export function servesRoute(
  vehicleRouteId: string | null,
  routeId: string | null,
) {
  if (!routeId || vehicleRouteId === routeId) return true;
  const vehicleRoute = findRoute(vehicleRouteId);
  return !!vehicleRoute && isAreaWideRoute(vehicleRoute);
}

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
      (await unwrapCached("routes", routeTableRoutes.listRoutes())) ?? [];
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
    selectableRoutes = transitRoutes.filter((route) => !isAreaWideRoute(route));
    routeListeners.forEach((listener) => listener());
    return transitRoutes;
  }).then((result) => {
    if (!result.ok) routesRequest = null;
    return result;
  });
  return routesRequest;
}

export function reloadTransitRoutes() {
  routesRequest = null;
  return loadTransitRoutes();
}

export function findRoute(id: string | null | undefined) {
  return transitRoutes.find((route) => route.id === id) ?? null;
}

export function searchDestinations(query: string) {
  const needle = query.trim().toLowerCase();
  return selectableRoutes.filter(
    (route) =>
      route.name.toLowerCase().includes(needle) ||
      route.vicinity.some((place) => place.toLowerCase().includes(needle)),
  );
}

export const nearDestinationMeters = 100;

export type RouteNearPlace = { route: TransitRoute; distanceMeters: number };

export function findNearestRoute(
  point: { lat: number; lng: number },
  routes: TransitRoute[] = selectableRoutes,
): RouteNearPlace | null {
  return (
    routes
      .map((route) => ({
        route,
        distanceMeters: Math.min(
          ...[route.waypoints, ...route.alternativePaths]
            .filter((path) => path.length > 0)
            .map((path) => distanceToPath(point, path)),
        ),
      }))
      .filter(({ distanceMeters }) => Number.isFinite(distanceMeters))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] ?? null
  );
}

export function findRoutesNear(point: {
  lat: number;
  lng: number;
}): RouteNearPlace[] {
  return selectableRoutes
    .map((route) => findNearestRoute(point, [route]))
    .filter((item): item is RouteNearPlace => item !== null)
    .filter(({ distanceMeters }) => distanceMeters <= nearDestinationMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export const occupancyLevels = [
  "Available",
  "Moderate",
  "Almost Full",
  "Full",
] as const;

export type OccupancyLevel = (typeof occupancyLevels)[number];

export function getOccupancyLevel(
  current: number,
  max: number,
): OccupancyLevel {
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
  return `road-geometry:v2:${points.length}:${hash}`;
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
      const coordinates = leg.geometry?.coordinates;
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

export type EtaRoute = {
  path: LatLng[];
  durationSeconds: number;
  distanceMeters: number;
};

export async function loadEtaRoute(
  from: LatLng,
  to: LatLng,
): Promise<Result<EtaRoute>> {
  return attempt(async () => {
    const response = await transitRouteApi.etaRoute(from, to);
    const route = response.routes?.[0];
    const seconds = route?.durationSeconds;
    const coordinates = route?.geometry?.coordinates;
    if (!route || seconds === undefined || !coordinates?.length) {
      throw new Error(response.error?.message ?? "No route found.");
    }
    return {
      path: coordinates.map(([lng, lat]): LatLng => [lat, lng]),
      durationSeconds: seconds,
      distanceMeters: route.distanceMeters ?? 0,
    };
  });
}

export async function loadWalkingRoute(
  from: LatLng,
  to: LatLng,
): Promise<Result<EtaRoute>> {
  return attempt(async () => {
    const response = await transitRouteApi.walkingRoute(from, to);
    const route = response.routes?.[0];
    const seconds = route?.durationSeconds;
    const coordinates = route?.geometry?.coordinates;
    if (!route || seconds === undefined || !coordinates?.length) {
      throw new Error(response.error?.message ?? "No walking route found.");
    }
    return {
      path: coordinates.map(([lng, lat]): LatLng => [lat, lng]),
      durationSeconds: seconds,
      distanceMeters: route.distanceMeters ?? 0,
    };
  });
}

export const vehicleStatusLabels: Record<string, string> = {
  "on-trip": "In Transit",
  loading: "Loading/Unloading",
  idle: "Idle",
  offline: "Offline",
};

export type LiveVehicle = {
  id: string;
  type: VehicleType;
  typeLabel: string;
  plateNumber: string;
  status: string;
  maxCapacity: number;
  currentCapacity: number;
  isFull: boolean;
  occupancy: OccupancyLevel;
  lat: number;
  lng: number;
  routeId: string | null;
  routeName: string | null;
};

export function loadLiveVehicles(): Promise<Result<LiveVehicle[]>> {
  return attempt(async () => {
    const rows: LiveVehicleRow[] =
      (await unwrap(routeTableRoutes.listLiveVehicles())) ?? [];
    return rows.map((row) => ({
      id: row.vehicle_id,
      type: toVehicleType(row.vehicle_type),
      typeLabel: row.vehicle_type,
      plateNumber: row.plate_number,
      status: vehicleStatusLabels[row.vehicle_status] ?? row.vehicle_status,
      maxCapacity: row.max_capacity,
      currentCapacity: row.current_capacity,
      isFull: row.is_full,
      occupancy: row.is_full
        ? "Full"
        : getOccupancyLevel(row.current_capacity, row.max_capacity),
      lat: row.latitude,
      lng: row.longitude,
      routeId: row.route_id,
      routeName: row.route_name,
    }));
  });
}
