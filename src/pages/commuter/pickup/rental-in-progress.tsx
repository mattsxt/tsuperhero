import { StatusBar } from "expo-status-bar";
import BusFront from "lucide-react-native/icons/bus-front";
import MapPin from "lucide-react-native/icons/map-pin";
import { StyleSheet, Text, View } from "react-native";

import { rentalCooldownMs, type Rental } from "@/api/v1/rentals/controllers";
import {
  ModuleButton,
  ModuleHeader,
  moduleColors,
} from "@/components/module-ui";

const { brandBlue, softBlue, text } = moduleColors;

export function RentalInProgress({
  rental,
  at,
  onOpenRental,
  onBack,
}: {
  rental: Rental;
  /** The rental pickup (or return pickup) that pauses pickups right now. */
  at: Date;
  onOpenRental: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ModuleHeader
        title="Pickup"
        subtitle="Request a pickup from nearby vehicles and let drivers know you’re waiting."
        icon={<MapPin color="#ffffff" size={44} strokeWidth={1.8} />}
        onBack={onBack}
      />
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <BusFront color={brandBlue} size={26} strokeWidth={2} />
          </View>
          <Text style={styles.title}>Pickups are paused for your rental</Text>
          <Text style={styles.text}>
            Your rental to {rental.destination} picks you up at {clock(at)}.
            Pickups are paused from{" "}
            {clock(new Date(at.getTime() - rentalCooldownMs))} to{" "}
            {clock(new Date(at.getTime() + rentalCooldownMs))}, so the trips
            don&apos;t overlap.
          </Text>
          <ModuleButton
            label="VIEW MY RENTAL"
            onPress={onOpenRental}
            style={styles.button}
          />
        </View>
      </View>
    </View>
  );
}

const clock = (date: Date) =>
  date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const styles = StyleSheet.create({
  // Full width: in the centred card it would shrink and the arrow would cover the label.
  button: { alignSelf: "stretch", marginTop: 16 },
  screen: { flex: 1, backgroundColor: "#ffffff" },
  body: { paddingHorizontal: 16, paddingTop: 24 },
  card: {
    alignItems: "center",
    gap: 8,
    padding: 20,
    borderRadius: 20,
    backgroundColor: softBlue,
  },
  icon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: "#ffffff",
  },
  title: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 16,
    textAlign: "center",
  },
  text: {
    color: text,
    fontFamily: "Sora",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
