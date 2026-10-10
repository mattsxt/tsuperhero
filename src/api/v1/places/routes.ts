<<<<<<< HEAD
import { googleMapsApiKey } from "@/constants/google-maps";

const placesBaseUrl = "https://places.googleapis.com/v1";

const searchCenter = { latitude: 13.6218, longitude: 123.1948 };
const searchRadiusMeters = 50000;

type AutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      text?: { text: string };
      structuredFormat?: {
        mainText?: { text: string };
        secondaryText?: { text: string };
      };
    };
  }[];
  error?: { message: string };
};

type PlaceDetailsResponse = {
  id?: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  error?: { message: string };
};

function requireKey() {
  if (!googleMapsApiKey) throw new Error("Missing Google Maps API key.");
  return googleMapsApiKey;
=======
import { mapboxToken } from "@/constants/mapbox";

const searchBaseUrl = "https://api.mapbox.com/search/searchbox/v1";

const searchCenter = { latitude: 13.6218, longitude: 123.1948 };
const maxSuggestions = 8;

type SuggestResponse = {
  suggestions?: {
    mapbox_id: string;
    name: string;
    full_address?: string;
    place_formatted?: string;
  }[];
  message?: string;
};

type RetrieveResponse = {
  features?: {
    geometry?: { coordinates: [number, number] };
    properties?: {
      name?: string;
      full_address?: string;
      place_formatted?: string;
      coordinates?: { latitude: number; longitude: number };
    };
  }[];
  message?: string;
};

function requireToken() {
  if (!mapboxToken) throw new Error("Missing Mapbox token.");
  return encodeURIComponent(mapboxToken);
>>>>>>> origin/mapbox
}

export const placesApi = {
  autocomplete: async (
    input: string,
    sessionToken: string,
<<<<<<< HEAD
  ): Promise<AutocompleteResponse> => {
    const response = await fetch(`${placesBaseUrl}/places:autocomplete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": requireKey(),
      },
      body: JSON.stringify({
        input,
        sessionToken,
        includedRegionCodes: ["ph"],
        locationBias: {
          circle: { center: searchCenter, radius: searchRadiusMeters },
        },
      }),
    });
=======
  ): Promise<SuggestResponse> => {
    const response = await fetch(
      `${searchBaseUrl}/suggest?q=${encodeURIComponent(input)}` +
        `&session_token=${encodeURIComponent(sessionToken)}` +
        `&country=ph&language=en&limit=${maxSuggestions}` +
        `&proximity=${searchCenter.longitude},${searchCenter.latitude}` +
        `&access_token=${requireToken()}`,
    );
>>>>>>> origin/mapbox
    return response.json();
  },

  details: async (
    placeId: string,
    sessionToken: string,
<<<<<<< HEAD
  ): Promise<PlaceDetailsResponse> => {
    const response = await fetch(
      `${placesBaseUrl}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`,
      {
        headers: {
          "X-Goog-Api-Key": requireKey(),
          "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
        },
      },
=======
  ): Promise<RetrieveResponse> => {
    const response = await fetch(
      `${searchBaseUrl}/retrieve/${encodeURIComponent(placeId)}` +
        `?session_token=${encodeURIComponent(sessionToken)}` +
        `&access_token=${requireToken()}`,
>>>>>>> origin/mapbox
    );
    return response.json();
  },
};
