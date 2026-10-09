import { getSupabaseClient } from "@/api/v1/client";
import { mapboxToken } from "@/constants/mapbox";

export type LatLng = [number, number];

type LineString = { coordinates: [number, number][] };

export type DirectionsResponse = {
  routes?: {
    geometry?: LineString;
    distanceMeters?: number;
    durationSeconds?: number;
    legs?: { distanceMeters?: number; geometry?: LineString }[];
  }[];
  error?: { message: string };
};

type MapboxDirections = {
  code?: string;
  message?: string;
  routes?: {
    geometry?: LineString;
    distance?: number;
    duration?: number;
    legs?: {
      distance?: number;
      steps?: { geometry?: LineString }[];
    }[];
  }[];
};

const directionsUrl = "https://api.mapbox.com/directions/v5/mapbox";

// Directions accepts at most 25 coordinates per request.
const maxCoordinates = 25;

const toCoordinates = (points: LatLng[]) =>
  points.map(([lat, lng]) => `${lng},${lat}`).join(";");

async function requestDirections(
  profile: "driving" | "driving-traffic",
  points: LatLng[],
  params: string,
): Promise<MapboxDirections> {
  if (!mapboxToken) throw new Error("Missing Mapbox token.");
  const response = await fetch(
    `${directionsUrl}/${profile}/${toCoordinates(points)}?${params}&access_token=${encodeURIComponent(mapboxToken)}`,
  );
  return response.json();
}

export type RouteRow = {
  route_id: string;
  route_name: string;
  route_code: string;
  path: unknown;
  alternative_paths?: unknown;
  vicinity?: unknown;
};

const routeTable = () => getSupabaseClient().from("route");

export type LiveVehicleRow = {
  vehicle_id: string;
  vehicle_type: string;
  plate_number: string;
  vehicle_status: string;
  max_capacity: number;
  current_capacity: number;
  latitude: number;
  longitude: number;
  route_id: string | null;
  route_name: string | null;
};

export const routeTableRoutes = {
  listRoutes: () => routeTable().select("*").order("route_name"),
  listLiveVehicles: () => getSupabaseClient().rpc("get_live_vehicles"),
};

export const transitRouteApi = {
  // One leg per consecutive pair of points. Mapbox returns each leg's shape
  // as its steps, so a leg's line is its steps joined together.
  drivingRoute: async (points: LatLng[]): Promise<DirectionsResponse> => {
    if (points.length < 2) throw new Error("A route needs two points.");
    const legs: NonNullable<DirectionsResponse["routes"]>[number]["legs"] = [];
    for (let start = 0; start < points.length - 1; start += maxCoordinates - 1) {
      const chunk = points.slice(start, start + maxCoordinates);
      const data = await requestDirections(
        "driving",
        chunk,
        "geometries=geojson&overview=false&steps=true",
      );
      const route = data.routes?.[0];
      if (data.code !== "Ok" || !route?.legs) {
        return { error: { message: data.message ?? "No route found." } };
      }
      legs.push(
        ...route.legs.map((leg) => ({
          distanceMeters: leg.distance,
          geometry: {
            coordinates: (leg.steps ?? []).flatMap(
              (step) => step.geometry?.coordinates ?? [],
            ),
          },
        })),
      );
    }
    return { routes: [{ legs }] };
  },

  etaRoute: async (from: LatLng, to: LatLng): Promise<DirectionsResponse> => {
    const data = await requestDirections(
      "driving-traffic",
      [from, to],
      "geometries=geojson&overview=full",
    );
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route) {
      return { error: { message: data.message ?? "No route found." } };
    }
    return {
      routes: [
        {
          geometry: route.geometry,
          distanceMeters: route.distance,
          durationSeconds: route.duration,
        },
      ],
    };
  },
};
