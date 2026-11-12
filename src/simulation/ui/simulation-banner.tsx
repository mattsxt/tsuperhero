import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { palette } from "@/constants/colors";
import { useStatusBarTop } from "@/hooks/use-status-bar-top";

export function SimulationBanner() {
  const insets = useSafeAreaInsets();
  const top = useStatusBarTop();

  if (top <= 0) {
    return (
      <View
        pointerEvents="none"
        style={[styles.pill, { bottom: insets.bottom + 8 }]}
      >
        <Text style={styles.text}>SIMULATION</Text>
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={[styles.bar, { height: top }]}>
      <Text style={styles.text}>SIMULATION · mock data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000,
    alignItems: "flex-start",
    justifyContent: "flex-end",
    paddingLeft: 12,
    paddingBottom: 2,
    backgroundColor: palette.warning,
  },
  pill: {
    position: "absolute",
    left: 8,
    zIndex: 1000,
    elevation: 1000,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: palette.warning,
  },
  text: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 10,
    lineHeight: 14,
  },
});
