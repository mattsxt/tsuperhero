import { readCache, writeCache } from "@/api/v1/cache";
import { getDistanceMeters, type Coordinates } from "@/utils/geo";

type TripDistance = {
  active: boolean;
  meters: number;
  anchor: Coordinates | null;
};

const storageKey = "trip-distance";
const movedMeters = 15;
const maxAccuracyMeters = 50;

let state: TripDistance = readCache<TripDistance>(storageKey) ?? {
  active: false,
  meters: 0,
  anchor: null,
};

function save(next: TripDistance) {
  state = next;
  writeCache(storageKey, state);
}

export function startTripDistance() {
  save({ active: true, meters: 0, anchor: null });
}

export function resumeTripDistance() {
  if (!state.active) save({ ...state, active: true });
}

export function stopTripDistance() {
  save({ active: false, meters: 0, anchor: null });
}

export function addTripPoint(
  latitude: number,
  longitude: number,
  accuracy?: number | null,
) {
  if (!state.active) return;
  if (accuracy != null && accuracy > maxAccuracyMeters) return;
  const point = { lat: latitude, lng: longitude };
  if (!state.anchor) {
    save({ ...state, anchor: point });
    return;
  }
  const moved = getDistanceMeters(state.anchor, point);
  if (moved < movedMeters) return;
  save({ ...state, meters: state.meters + moved, anchor: point });
}

export const tripDistanceMeters = () => state.meters;

export type TripPassengers = { count: number; full: boolean };

const passengersKey = "trip-passengers";

export function saveTripPassengers(passengers: TripPassengers) {
  writeCache(passengersKey, passengers);
}

export const savedTripPassengers = () =>
  readCache<TripPassengers>(passengersKey);

export function clearTripPassengers() {
  writeCache(passengersKey, null);
}
