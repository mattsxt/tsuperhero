import { getSupabaseClient } from "@/api/v1/client";
<<<<<<< HEAD
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
=======
import { mapboxToken } from "@/constants/mapbox";

export type LatLng = [number, number];

type LineString = { coordinates: [number, number][] };

export type DirectionsResponse = {
  routes?: {
    geometry?: LineString;
    distanceMeters?: number;
    durationSeconds?: number;
    legs?: { distanceMeters?: number; geometry?: LineString }[];
>>>>>>> origin/mapbox
  }[];
  error?: { message: string };
};

<<<<<<< HEAD
const routesApiUrl =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

const toWaypoint = ([latitude, longitude]: LatLng) => ({
  location: { latLng: { latitude, longitude } },
});
=======
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

const maxCoordinates = 25;

const toCoordinates = (points: LatLng[]) =>
  points.map(([lat, lng]) => `${lng},${lat}`).join(";");

async function requestDirections(
  profile: "driving" | "driving-traffic" | "walking",
  points: LatLng[],
  params: string,
): Promise<MapboxDirections> {
  if (!mapboxToken) throw new Error("Missing Mapbox token.");
  const response = await fetch(
    `${directionsUrl}/${profile}/${toCoordinates(points)}?${params}&access_token=${encodeURIComponent(mapboxToken)}`,
  );
  return response.json();
}
>>>>>>> origin/mapbox

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
<<<<<<< HEAD
=======
  is_full: boolean;
>>>>>>> origin/mapbox
  latitude: number;
  longitude: number;
  route_id: string | null;
  route_name: string | null;
};

export const routeTableRoutes = {
  listRoutes: () => routeTable().select("*").order("route_name"),
<<<<<<< HEAD
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
=======
  listLiveVehicles: () =>
    getSupabaseClient().rpc("get_live_vehicles_with_full"),
};

export const transitRouteApi = {
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

  walkingRoute: async (from: LatLng, to: LatLng): Promise<DirectionsResponse> => {
    const data = await requestDirections(
      "walking",
      [from, to],
      "geometries=geojson&overview=full",
    );
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route) {
      return { error: { message: data.message ?? "No walking route found." } };
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
>>>>>>> origin/mapbox
  },
};
