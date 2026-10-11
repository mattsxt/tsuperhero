import { StatusBar } from "expo-status-bar";
import BusFront from "lucide-react-native/icons/bus-front";
import MapPin from "lucide-react-native/icons/map-pin";
import { StyleSheet, Text, View } from "react-native";

import { formatRentalTime, type Rental } from "@/api/v1/rentals/controllers";
import {
  ModuleButton,
  ModuleHeader,
  moduleColors,
} from "@/components/module-ui";

const { brandBlue, softBlue, text } = moduleColors;

export function RentalInProgress({
  rental,
  onOpenRental,
  onBack,
}: {
  rental: Rental;
  onOpenRental: () => void;
  onBack: () => void;
}) {
  const booked = rental.status === "accepted";
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
          <Text style={styles.title}>You have a rental in progress</Text>
          <Text style={styles.text}>
            Your rental to {rental.destination} on{" "}
            {formatRentalTime(rental.pickupTime)} is{" "}
            {booked ? "booked" : "waiting for a driver"}. You can only have one
            request at a time, so pickups open again once it&apos;s done or
            cancelled.
          </Text>
          <ModuleButton label="VIEW MY RENTAL" onPress={onOpenRental} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
