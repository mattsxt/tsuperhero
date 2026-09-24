import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, StyleSheet } from "react-native";

import { BrandHeader } from "@/components/brand-header";
import { Routes } from "@/constants/routes";

const backgroundColor = "#1b3caf";

export default function LandingScreen() {
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          router.replace(Routes.login);
        }
      });
    }, 2500);

    return () => clearTimeout(fadeTimer);
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
