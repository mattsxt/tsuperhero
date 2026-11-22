import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const publicMapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  const simulation = process.env.APP_VARIANT === "simulation";

  return {
    ...(config as ExpoConfig),
    ...(simulation && {
      name: "TsuperHero Simulation",
      scheme: "tsuperhero-sim",
      icon: "./src/assets/images/icon-simulation.png",
      android: {
        ...config.android,
        package: "com.xorti.tsuperhero.simulation",
        adaptiveIcon: {
          ...config.android?.adaptiveIcon,
          foregroundImage:
            "./src/assets/images/android-icon-foreground-simulation.png",
        },
      },
    }),
    extra: {
      ...config.extra,
      ...(simulation && { simulation: true }),
      supabaseUrl: simulation ? undefined : process.env.SUPABASE_URL,
      supabasePublishableKey: simulation
        ? undefined
        : process.env.SUPABASE_PUBLISHABLE_KEY,
      mapboxToken: publicMapboxToken?.startsWith("pk.")
        ? publicMapboxToken
        : undefined,
    },
  };
};
