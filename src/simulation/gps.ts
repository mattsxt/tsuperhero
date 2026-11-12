import { currentUserId } from "@/simulation/auth";
import { start, userFix, walkTo } from "@/simulation/engine";

export type SimulatedLocation = {
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number | null;
    altitudeAccuracy: number | null;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
};

const FIX_MS = 1_000;

export function currentSimulatedPoint(): { lat: number; lng: number } {
  const { lat, lng } = userFix(currentUserId());
  return { lat, lng };
}

function currentLocation(): SimulatedLocation {
  const fix = userFix(currentUserId());
  return {
    coords: {
      latitude: fix.lat,
      longitude: fix.lng,
      altitude: 0,
      accuracy: 5,
      altitudeAccuracy: 5,
      heading: fix.heading,
      speed: fix.speedMps,
    },
    timestamp: Date.now(),
  };
}

export function watchSimulatedLocation(
  onFix: (location: SimulatedLocation) => void,
): { remove: () => void } {
  start();
  const emit = () => onFix(currentLocation());
  const first = setTimeout(emit, 0);
  const timer = setInterval(emit, FIX_MS);
  return {
    remove() {
      clearTimeout(first);
      clearInterval(timer);
    },
  };
}

export function simulateWalkTo(
  target: { lat: number; lng: number } | null,
  route: [number, number][] | null = null,
): void {
  walkTo(target, route);
}
