import * as Location from "expo-location";
import { Platform } from "react-native";

import { readCache, writeCache } from "@/api/v1/cache";
import { getErrorMessage } from "@/api/v1/client";
import { placesApi } from "@/api/v1/places/routes";
import { attempt, failure, success, type Result } from "@/api/v1/result";

export type Place = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export type PlaceSuggestion = {
  id: string;
  name: string;
  address: string;
};

export const minPlaceQueryLength = 2;

export function createPlacesSession() {
<<<<<<< HEAD
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
=======
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
>>>>>>> origin/mapbox
}

export async function searchPlaces(
  query: string,
  sessionToken: string,
): Promise<{ suggestions: PlaceSuggestion[]; error?: string }> {
  if (query.trim().length < minPlaceQueryLength) return { suggestions: [] };

  try {
    const response = await placesApi.autocomplete(query.trim(), sessionToken);
<<<<<<< HEAD
    if (response.error) throw new Error(response.error.message);

    const remote = (response.suggestions ?? []).flatMap(
      ({ placePrediction }): PlaceSuggestion[] =>
        placePrediction
          ? [
              {
                id: placePrediction.placeId,
                name:
                  placePrediction.structuredFormat?.mainText?.text ??
                  placePrediction.text?.text ??
                  "",
                address:
                  placePrediction.structuredFormat?.secondaryText?.text ?? "",
              },
            ]
          : [],
=======
    if (!response.suggestions) {
      throw new Error(response.message ?? "Place search failed.");
    }

    const remote = response.suggestions.map(
      (suggestion): PlaceSuggestion => ({
        id: suggestion.mapbox_id,
        name: suggestion.name,
        address: suggestion.place_formatted ?? suggestion.full_address ?? "",
      }),
>>>>>>> origin/mapbox
    );
    return { suggestions: remote };
  } catch (error) {
    return { suggestions: [], error: getErrorMessage(error) };
  }
}

export async function resolvePlace(
  suggestion: PlaceSuggestion,
  sessionToken: string,
): Promise<Result<Place>> {
  try {
    const details = await placesApi.details(suggestion.id, sessionToken);
<<<<<<< HEAD
    if (details.error || !details.location) {
      throw new Error(details.error?.message ?? "Couldn't load that place.");
    }
    return success({
      id: suggestion.id,
      name: details.displayName?.text ?? suggestion.name,
      address: details.formattedAddress ?? suggestion.address,
      lat: details.location.latitude,
      lng: details.location.longitude,
=======
    const feature = details.features?.[0];
    const properties = feature?.properties;
    const lng =
      properties?.coordinates?.longitude ?? feature?.geometry?.coordinates[0];
    const lat =
      properties?.coordinates?.latitude ?? feature?.geometry?.coordinates[1];
    if (lat === undefined || lng === undefined) {
      throw new Error(details.message ?? "Couldn't load that place.");
    }
    return success({
      id: suggestion.id,
      name: properties?.name ?? suggestion.name,
      address:
        properties?.full_address ??
        properties?.place_formatted ??
        suggestion.address,
      lat,
      lng,
>>>>>>> origin/mapbox
    });
  } catch (error) {
    return failure(getErrorMessage(error));
  }
}

function describeAddress(address: Location.LocationGeocodedAddress) {
  const street = [address.streetNumber, address.street]
    .filter(Boolean)
    .join(" ");
  const name = address.name || street || address.district;
  const area = [address.district, address.city, address.region]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(", ");
  return { name: name || area || "Current location", area };
}

const positionTimeoutMs = 10_000;

async function getPosition() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), positionTimeoutMs);
  });
  const current = await Promise.race([
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }).catch(() => null),
    timeout,
  ]);
  clearTimeout(timer);
  return current ?? (await Location.getLastKnownPositionAsync());
}

export async function getCurrentPlace(): Promise<Result<Place>> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      return failure("Allow location access to use your current location.");
    }

    if (!(await Location.hasServicesEnabledAsync())) {
      return failure(
        "Turn on Location in your device settings, then try again.",
      );
    }

    const position = await getPosition();
    if (!position) {
      return failure(
        "Couldn't get your location. Move somewhere with a clearer signal and try again.",
      );
    }
    const { latitude: lat, longitude: lng } = position.coords;
    rememberPosition(lat, lng);
    return success(await describePoint(lat, lng, "Current location"));
  } catch (error) {
    return failure(getErrorMessage(error));
  }
}

export async function describePoint(
  lat: number,
  lng: number,
  fallbackName = "Pinned location",
): Promise<Place> {
  let name = fallbackName;
  let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  if (Platform.OS !== "web") {
    const [match] = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lng,
    }).catch(() => []);
    if (match) {
      const described = describeAddress(match);
      name = described.name;
      address = described.area || address;
    }
  }
  return { id: `point-${lat},${lng}`, name, address, lat, lng };
}

export async function getLastKnownPoint(): Promise<{
  lat: number;
  lng: number;
} | null> {
  const permission = await Location.getForegroundPermissionsAsync().catch(
    () => null,
  );
  if (!permission?.granted) return readCache<Coordinates>(lastPositionKey);
  const position = await Location.getLastKnownPositionAsync().catch(() => null);
  if (!position) return readCache<Coordinates>(lastPositionKey);
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

type Coordinates = { lat: number; lng: number };

const lastPositionKey = "last-position";
const positionSaveMs = 15_000;
let lastPositionSavedAt = 0;

function rememberPosition(lat: number, lng: number) {
  const now = Date.now();
  if (now - lastPositionSavedAt < positionSaveMs) return;
  lastPositionSavedAt = now;
  writeCache<Coordinates>(lastPositionKey, { lat, lng });
}

export async function watchLocation(
  onFix: (location: Location.LocationObject) => void,
): Promise<Result<Location.LocationSubscription>> {
  const permission = await Location.requestForegroundPermissionsAsync().catch(
    () => null,
  );
  if (!permission?.granted) {
    return failure("Allow location access to show where you are.");
  }
  if (!(await Location.hasServicesEnabledAsync().catch(() => false))) {
    return failure("Turn on Location in your device settings.");
  }
  return attempt(() =>
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1_000,
        distanceInterval: 0,
      },
      (location) => {
        rememberPosition(location.coords.latitude, location.coords.longitude);
        onFix(location);
      },
    ),
  );
}
