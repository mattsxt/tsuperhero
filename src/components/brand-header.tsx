import { StyleSheet, type TextStyle } from "react-native";
import Animated, {
  type CSSTransitionProperties,
} from "react-native-reanimated";

import { BrandLogo } from "@/components/brand-logo";

type Variant = "badge" | "hero" | "splash";

export const brandCompactDuration = 300;

const sizeTransition: CSSTransitionProperties = {
  transitionProperty: ["width", "height", "borderRadius", "marginBottom"],
  transitionDuration: brandCompactDuration,
  transitionTimingFunction: "ease-in-out",
};

const wordmarkTransition: CSSTransitionProperties<TextStyle> = {
  transitionProperty: ["fontSize", "lineHeight", "marginTop"],
  transitionDuration: brandCompactDuration,
  transitionTimingFunction: "ease-in-out",
};

export function BrandHeader({
  variant,
  compact = false,
}: {
  variant: Variant;
  compact?: boolean;
}) {
  const logo = (
    <Animated.View
      style={[
        logoStyles[variant],
        compact && compactLogoStyles[variant],
        sizeTransition,
      ]}
    >
      <BrandLogo />
    </Animated.View>
  );

  return (
    <Animated.View style={styles.container}>
      {variant === "badge" ? (
        <Animated.View
          style={[styles.badge, compact && styles.compactBadge, sizeTransition]}
        >
          {logo}
        </Animated.View>
      ) : (
        logo
      )}
      <Animated.Text
        style={[
          styles.wordmark,
          wordmarkStyles[variant],
          compact && compactWordmarkStyles[variant],
          wordmarkTransition,
        ]}
      >
        Tsuperhero
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center" },
  badge: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1034A6",
    borderRadius: 24,
  },
  compactBadge: { width: 60, height: 60, borderRadius: 16 },
  wordmark: { fontFamily: "WDXLLubrifontSC" },
});

const logoStyles = StyleSheet.create({
  badge: { width: 72, height: 72 },
  hero: { width: 80, height: 80 },
  splash: { width: 54, height: 54, marginBottom: 30 },
});

const compactLogoStyles = StyleSheet.create({
  badge: { width: 42, height: 42 },
  hero: { width: 48, height: 48 },
  splash: { width: 40, height: 40, marginBottom: 16 },
});

const wordmarkStyles = StyleSheet.create({
  badge: { color: "#193caf", fontSize: 43, lineHeight: 49, marginTop: 14 },
  hero: { color: "#ffffff", fontSize: 60, lineHeight: 68, marginTop: 18 },
  splash: { color: "#ffffff", fontSize: 43, lineHeight: 52 },
});

const compactWordmarkStyles = StyleSheet.create({
  badge: { fontSize: 28, lineHeight: 32, marginTop: 6 },
  hero: { fontSize: 36, lineHeight: 42, marginTop: 8 },
  splash: { fontSize: 30, lineHeight: 36 },
});
