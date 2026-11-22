import { StatusBar } from "expo-status-bar";
import LocateFixed from "lucide-react-native/icons/locate-fixed";
import MapPin from "lucide-react-native/icons/map-pin";
import Navigation from "lucide-react-native/icons/navigation";
import RadioTower from "lucide-react-native/icons/radio-tower";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ModuleButton,
  ModuleHeader,
  moduleColors,
} from "@/components/module-ui";

const { brandBlue, mutedText, softBlue, text } = moduleColors;

export function LocationPrimer({
  onAllow,
  onSkip,
  onBack,
}: {
  onAllow: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ModuleHeader
        title="Pickup"
        subtitle="Request a pickup from nearby vehicles and let drivers know you’re waiting."
        icon={<MapPin color="#ffffff" size={44} strokeWidth={1.8} />}
        onBack={onBack}
      />
      <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.hero}>
          <LocateFixed color={brandBlue} size={40} strokeWidth={1.8} />
        </View>
        <Text style={styles.title}>Allow your location</Text>
        <Text style={styles.lead}>
          Pickups work best when Tsuperhero knows where you are.
        </Text>
        <Reason
          icon={<Navigation color={brandBlue} size={18} strokeWidth={2} />}
          text="Show the walking route to your pickup point."
        />
        <Reason
          icon={<RadioTower color={brandBlue} size={18} strokeWidth={2} />}
          text="Confirm you’ve arrived, so nearby drivers can see your request."
        />
        <Reason
          icon={<MapPin color={brandBlue} size={18} strokeWidth={2} />}
          text="Use where you are as your pickup location."
        />
        <Text style={styles.note}>
          You can change this anytime in your phone’s settings.
        </Text>

        <ModuleButton label="ALLOW LOCATION" onPress={onAllow} />
        <Pressable
          accessibilityRole="button"
          onPress={onSkip}
          style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
        >
          <Text style={styles.skipText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Reason({ icon, text: label }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.reason}>
      <View style={styles.reasonIcon}>{icon}</View>
      <Text style={styles.reasonText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  body: { flex: 1, gap: 12, paddingHorizontal: 20, paddingTop: 28 },
  hero: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    borderRadius: 40,
    backgroundColor: softBlue,
  },
  title: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 20,
    textAlign: "center",
  },
  lead: {
    marginBottom: 6,
    color: text,
    fontFamily: "Sora",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  reason: { flexDirection: "row", alignItems: "center", gap: 12 },
  reasonIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: softBlue,
  },
  reasonText: {
    flex: 1,
    color: text,
    fontFamily: "Sora",
    fontSize: 12,
    lineHeight: 18,
  },
  note: {
    marginTop: 4,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  skip: { alignItems: "center", paddingVertical: 12 },
  skipText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 12 },
  pressed: { opacity: 0.75 },
});
