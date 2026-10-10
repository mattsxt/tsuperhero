import type { ConfigContext, ExpoConfig } from "expo/config";

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
