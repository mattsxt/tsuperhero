import * as Location from "expo-location";
import { Platform } from "react-native";

import { getErrorMessage } from "@/api/v1/client";
import { placesApi } from "@/api/v1/places/routes";
import { failure, success, type Result } from "@/api/v1/result";

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
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export async function searchPlaces(
  query: string,
  sessionToken: string,
): Promise<{ suggestions: PlaceSuggestion[]; error?: string }> {
  if (query.trim().length < minPlaceQueryLength) return { suggestions: [] };

  try {
    const response = await placesApi.autocomplete(query.trim(), sessionToken);
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
    if (details.error || !details.location) {
      throw new Error(details.error?.message ?? "Couldn't load that place.");
    }
    return success({
      id: suggestion.id,
      name: details.displayName?.text ?? suggestion.name,
      address: details.formattedAddress ?? suggestion.address,
      lat: details.location.latitude,
      lng: details.location.longitude,
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

    let name = "Current location";
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

    return success({ id: `current-${lat},${lng}`, name, address, lat, lng });
  } catch (error) {
    return failure(getErrorMessage(error));
  }
}
