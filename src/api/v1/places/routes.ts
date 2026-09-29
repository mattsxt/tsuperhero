import { googleMapsApiKey } from "@/constants/google-maps";

const placesBaseUrl = "https://places.googleapis.com/v1";

const searchCenter = { latitude: 13.6218, longitude: 123.1948 };
const searchRadiusMeters = 50000;

export type AutocompleteResponse = {
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

export type PlaceDetailsResponse = {
  id?: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  error?: { message: string };
};

function requireKey() {
  if (!googleMapsApiKey) throw new Error("Missing Google Maps API key.");
  return googleMapsApiKey;
}

export const placesApi = {
  autocomplete: async (
    input: string,
    sessionToken: string,
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
    return response.json();
  },

  details: async (
    placeId: string,
    sessionToken: string,
  ): Promise<PlaceDetailsResponse> => {
    const response = await fetch(
      `${placesBaseUrl}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`,
      {
        headers: {
          "X-Goog-Api-Key": requireKey(),
          "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
        },
      },
    );
    return response.json();
  },
};
