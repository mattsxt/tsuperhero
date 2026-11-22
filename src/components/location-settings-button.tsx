import Settings from "lucide-react-native/icons/settings";
import { Pressable, StyleSheet, Text } from "react-native";

import {
  canOpenAppSettings,
  openAppSettings,
} from "@/api/v1/places/controllers";

export function LocationSettingsButton({
  color = "#ffffff",
  background = "rgba(255, 255, 255, 0.16)",
}: {
  color?: string;
  background?: string;
}) {
  if (!canOpenAppSettings) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open settings to allow location access"
      onPress={openAppSettings}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        pressed && styles.pressed,
      ]}
    >
      <Settings color={color} size={14} strokeWidth={2.2} />
      <Text style={[styles.text, { color }]}>OPEN SETTINGS</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  text: { fontFamily: "SoraBold", fontSize: 10, letterSpacing: 0.5 },
  pressed: { opacity: 0.75 },
});
