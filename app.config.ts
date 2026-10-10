import type { ConfigContext, ExpoConfig } from "expo/config";

<<<<<<< HEAD
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    supabaseUrl: process.env.SUPABASE_URL,
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    googleMapsApiKey:
      process.env.VITE_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY,
  },
});
=======
export default ({ config }: ConfigContext): ExpoConfig => {
  const publicMapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

  return {
    ...(config as ExpoConfig),
    extra: {
      ...config.extra,
      supabaseUrl: process.env.SUPABASE_URL,
      supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
      mapboxToken: publicMapboxToken?.startsWith("pk.")
        ? publicMapboxToken
        : undefined,
    },
  };
};
>>>>>>> origin/mapbox
