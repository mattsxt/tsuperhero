import { googleMapsApiKey } from "@/constants/google-maps";

export type LatLng = [number, number];

export type GoogleRoutesResponse = {
  routes?: {
    polyline?: { geoJsonLinestring?: { coordinates: [number, number][] } };
  }[];
  error?: { message: string };
};

const routesApiUrl =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

const toWaypoint = ([latitude, longitude]: LatLng) => ({
  location: { latLng: { latitude, longitude } },
});

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
        "X-Goog-FieldMask": "routes.polyline.geoJsonLinestring",
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
};
