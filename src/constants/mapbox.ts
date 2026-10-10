import Constants from "expo-constants";

export const mapboxToken: string | undefined =
  Constants.expoConfig?.extra?.mapboxToken;

export const mapStyleUrl = "mapbox://styles/mapbox/streets-v12";
