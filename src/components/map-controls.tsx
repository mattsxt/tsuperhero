import LocateFixed from "lucide-react-native/icons/locate-fixed";
import Minus from "lucide-react-native/icons/minus";
import Plus from "lucide-react-native/icons/plus";
import { Pressable, StyleSheet, View } from "react-native";

import { palette } from "@/constants/colors";

/** Zoom in / zoom out / re-center buttons drawn over a map. */
export function MapControls({
  onZoomIn,
  onZoomOut,
  onRecenter,
  top = 10,
}: {
  top?: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
}) {
  const buttons = [
    { label: "Zoom in", icon: Plus, onPress: onZoomIn },
    { label: "Zoom out", icon: Minus, onPress: onZoomOut },
    { label: "Re-center the map", icon: LocateFixed, onPress: onRecenter },
  ];
  return (
    <View style={[styles.column, { top }]} pointerEvents="box-none">
      {buttons.map(({ label, icon: Icon, onPress }) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={label}
          hitSlop={4}
          onPress={onPress}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Icon color={palette.brand} size={18} strokeWidth={2.5} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { position: "absolute", right: 10, gap: 8 },
  button: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    elevation: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  pressed: { opacity: 0.75 },
});
