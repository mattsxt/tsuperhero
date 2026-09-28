import { transitRouteApi, type LatLng } from "@/api/v1/transit-routes/routes";

export type { LatLng };

export type VehicleType = "bus" | "jeep" | "tricy" | "van";

export type TransitRoute = {
  id: string;
  name: string;
  waypoints: LatLng[];
};

export type RouteVehicle = {
  id: string;
  plate: string;
  type: VehicleType;
  maxCapacity: number;
  currentCapacity: number;
  status: string;
  lat: number;
  lng: number;
};

export const vehicleTypeLabels: Record<VehicleType, string> = {
  bus: "Bus",
  jeep: "Jeepney",
  tricy: "Tricycle",
  van: "Van",
};

export const transitRoutes: TransitRoute[] = [
  {
    id: "naga-pili",
    name: "Naga Centro – Pili",
    waypoints: [
      [13.624, 123.185],
      [13.619, 123.2],
      [13.598, 123.24],
      [13.556, 123.275],
    ],
  },
  {
    id: "naga-canaman",
    name: "Naga Centro – Canaman",
    waypoints: [
      [13.624, 123.185],
      [13.6435, 123.1715],
    ],
  },
  {
    id: "naga-camaligan",
    name: "Naga Centro – Camaligan",
    waypoints: [
      [13.624, 123.185],
      [13.6203, 123.1633],
    ],
  },
];

const maxCapacity: Record<VehicleType, number> = {
  bus: 50,
  jeep: 24,
  tricy: 6,
  van: 14,
};

const platePrefix: Record<VehicleType, string> = {
  bus: "BUS",
  jeep: "JPA",
  tricy: "TRC",
  van: "VAN",
};

const statuses = [
  "In Transit",
  "In Transit",
  "In Transit",
  "Boarding",
  "Stopped",
];

const fleetTemplate: [VehicleType, number][] = [
  ["bus", 0.04],
  ["jeep", 0.12],
  ["jeep", 0.2],
  ["tricy", 0.28],
  ["van", 0.33],
  ["jeep", 0.36],
  ["bus", 0.39],
  ["jeep", 0.5],
  ["tricy", 0.6],
  ["van", 0.68],
  ["jeep", 0.75],
  ["bus", 0.82],
  ["tricy", 0.9],
  ["jeep", 0.96],
];

export function getOccupancyLevel(current: number, max: number) {
  const ratio = current / max;
  if (ratio >= 1) return "Full";
  if (ratio >= 0.8) return "Almost Full";
  if (ratio >= 0.5) return "Moderate";
  return "Available";
}

export async function loadRouteGeometry(
  route: TransitRoute,
): Promise<LatLng[]> {
  try {
    const response = await transitRouteApi.drivingRoute(route.waypoints);
    const coordinates =
      response.routes?.[0]?.polyline?.geoJsonLinestring?.coordinates;
    if (!coordinates?.length) throw new Error(response.error?.message);
    return coordinates.map(([lng, lat]) => [lat, lng]);
  } catch {
    return route.waypoints;
  }
}

function pointAlong(path: LatLng[], fraction: number): LatLng {
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

export function getRouteVehicles(route: TransitRoute, path: LatLng[]) {
  if (path.length < 2) return [];
  const counters: Record<VehicleType, number> = {
    bus: 0,
    jeep: 0,
    tricy: 0,
    van: 0,
  };
  const routeNumber = transitRoutes.indexOf(route) + 1;

  return fleetTemplate.map(([type, fraction], index): RouteVehicle => {
    counters[type] += 1;
    const [lat, lng] = pointAlong(path, fraction);
    const max = maxCapacity[type];
    return {
      id: `${route.id}-${index}`,
      plate: `${platePrefix[type]}-${routeNumber}${String(counters[type]).padStart(2, "0")}`,
      type,
      maxCapacity: max,
      currentCapacity: Math.round(
        (max * ((index * 37 + routeNumber * 11) % 100)) / 100,
      ),
      status: statuses[(index + routeNumber) % statuses.length],
      lat,
      lng,
    };
  });
}
