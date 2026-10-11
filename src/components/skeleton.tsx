import { useEffect } from "react";
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { moduleColors } from "@/components/module-ui";

const { headerBlue } = moduleColors;
const placeholderGrey = "#e6ebf3";

export function SkeletonBlock({
  width = "100%",
  height,
  radius = 10,
  style,
}: {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.45, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: placeholderGrey,
        },
        pulse,
        style,
      ]}
    />
  );
}

export function SkeletonCards({
  count = 3,
  height = 96,
  style,
}: {
  count?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      style={[styles.cards, style]}
    >
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.card}>
          <View style={styles.cardTop}>
            <SkeletonBlock width="55%" height={14} radius={6} />
            <SkeletonBlock width={64} height={18} radius={9} />
          </View>
          <SkeletonBlock width="80%" height={11} radius={5} />
          <SkeletonBlock width="40%" height={11} radius={5} />
          {height > 96 && <SkeletonBlock height={height - 96} radius={8} />}
        </View>
      ))}
    </View>
  );
}

export function HomeSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      style={styles.screen}
    >
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <SkeletonBlock
          width="45%"
          height={22}
          radius={8}
          style={styles.onBlue}
        />
        <SkeletonBlock
          width="70%"
          height={12}
          radius={6}
          style={styles.onBlue}
        />
      </View>
      <View style={styles.body}>
        <SkeletonBlock height={48} radius={14} />
        <View style={styles.actions}>
          {[0, 1, 2].map((index) => (
            <SkeletonBlock
              key={index}
              height={128}
              radius={10}
              style={styles.action}
            />
          ))}
        </View>
        <SkeletonBlock width="35%" height={14} radius={6} />
        <SkeletonCards count={2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 28,
    backgroundColor: headerBlue,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  onBlue: { backgroundColor: "rgba(255, 255, 255, 0.22)" },
  body: { gap: 16, paddingHorizontal: 16, paddingTop: 18 },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
  cards: { gap: 10 },
  card: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eef1f6",
    borderRadius: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
