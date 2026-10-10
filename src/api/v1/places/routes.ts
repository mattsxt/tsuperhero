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
}

export const placesApi = {
  autocomplete: async (
    input: string,
    sessionToken: string,
  ): Promise<SuggestResponse> => {
    const response = await fetch(
      `${searchBaseUrl}/suggest?q=${encodeURIComponent(input)}` +
        `&session_token=${encodeURIComponent(sessionToken)}` +
        `&country=ph&language=en&limit=${maxSuggestions}` +
        `&proximity=${searchCenter.longitude},${searchCenter.latitude}` +
        `&access_token=${requireToken()}`,
    );
    return response.json();
  },

  details: async (
    placeId: string,
    sessionToken: string,
  ): Promise<RetrieveResponse> => {
    const response = await fetch(
      `${searchBaseUrl}/retrieve/${encodeURIComponent(placeId)}` +
        `?session_token=${encodeURIComponent(sessionToken)}` +
        `&access_token=${requireToken()}`,
    );
    return response.json();
  },
};
