import { getSupabaseClient } from "@/api/v1/client";
import { googleMapsApiKey } from "@/constants/google-maps";

export type LatLng = [number, number];

type GooglePolyline = {
  geoJsonLinestring?: { coordinates: [number, number][] };
};

type GoogleRoutesResponse = {
  routes?: {
    polyline?: GooglePolyline;
    distanceMeters?: number;
    duration?: string;
    legs?: { distanceMeters?: number; polyline?: GooglePolyline }[];
  }[];
  error?: { message: string };
};

const routesApiUrl =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

const toWaypoint = ([latitude, longitude]: LatLng) => ({
  location: { latLng: { latitude, longitude } },
});

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
  drivingRoute: (points: LatLng[]): Promise<GoogleRoutesResponse> => {
    if (!googleMapsApiKey || points.length < 2) {
      return Promise.reject(new Error("Missing Google Maps API key."));
    }
    return fetch(routesApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleMapsApiKey,
        "X-Goog-FieldMask":
          "routes.legs.distanceMeters,routes.legs.polyline.geoJsonLinestring",
      },
      body: JSON.stringify({
        origin: toWaypoint(points[0]),
        destination: toWaypoint(points[points.length - 1]),
        intermediates: points.slice(1, -1).map(toWaypoint),
        travelMode: "DRIVE",
        polylineEncoding: "GEO_JSON_LINESTRING",
      }),
    }).then((response) => response.json());
  },

  etaRoute: (from: LatLng, to: LatLng): Promise<GoogleRoutesResponse> => {
    if (!googleMapsApiKey) {
      return Promise.reject(new Error("Missing Google Maps API key."));
    }
    return fetch(routesApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleMapsApiKey,
        "X-Goog-FieldMask":
          "routes.duration,routes.distanceMeters,routes.polyline.geoJsonLinestring",
      },
      body: JSON.stringify({
        origin: toWaypoint(from),
        destination: toWaypoint(to),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        polylineEncoding: "GEO_JSON_LINESTRING",
      }),
    }).then((response) => response.json());
  },
};
