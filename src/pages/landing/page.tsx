import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, StyleSheet } from "react-native";

import { getStartupRoute } from "@/api/v1/auth/controllers";
import { BrandHeader } from "@/components/brand-header";
import type { AppRoute } from "@/constants/routes";

const backgroundColor = "#1b3caf";

export default function LandingScreen() {
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let active = true;
    let nextRoute: AppRoute | null = null;
    let fadeFinished = false;

    const leaveWhenReady = () => {
      if (active && nextRoute && fadeFinished) router.replace(nextRoute);
    };

    getStartupRoute().then((route) => {
      nextRoute = route;
      leaveWhenReady();
    });

    const fadeTimer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(({ finished }) => {
        fadeFinished = finished;
        leaveWhenReady();
      });
    }, 2500);

    return () => {
      active = false;
      clearTimeout(fadeTimer);
    };
  }, [opacity]);

  return (
    <Animated.View style={[styles.screen, { opacity }]}>
      <BrandHeader variant="splash" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor,
  },
});
