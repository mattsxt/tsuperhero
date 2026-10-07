import CloudOff from "lucide-react-native/icons/cloud-off";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useOnline } from "@/hooks/use-online";

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const online = useOnline();

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 6 }]}>
      {!online && (
        <Animated.View
          entering={FadeInUp.duration(220)}
          exiting={FadeOutUp.duration(180)}
          style={styles.pill}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <CloudOff color="#ffffff" size={13} strokeWidth={2.4} />
          <Text style={styles.text}>
            You&apos;re offline · showing saved data
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
    elevation: 100,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(17, 24, 39, 0.92)",
  },
  text: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 10 },
});
