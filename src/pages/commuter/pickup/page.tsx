import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import LocateFixed from "lucide-react-native/icons/locate-fixed";
import MapPin from "lucide-react-native/icons/map-pin";
import Search from "lucide-react-native/icons/search";
import UserRound from "lucide-react-native/icons/user-round";
import Users from "lucide-react-native/icons/users";
import UsersRound from "lucide-react-native/icons/users-round";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ModuleButton,
  ModuleHeader,
  moduleColors,
  PassengerStepper,
  SectionTitle,
  SoftField,
  VehiclePicker,
  type Vehicle,
} from "@/components/module-ui";
import { Routes } from "@/constants/routes";

const { brandBlue, softBlue } = moduleColors;

const minPassengers = 1;
const maxPassengers = 10;

export default function PickupScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle>("bus");
  const [shareQuery, setShareQuery] = useState("");
  const [passengers, setPassengers] = useState(1);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(Routes.commuterHome);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ModuleHeader
          title="Pickup"
          subtitle="Request a pickup from nearby vehicles and let drivers know you’re waiting."
          icon={<MapPin color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={goBack}
        />

        <View style={styles.body}>
          <SoftField
            value={search}
            onChangeText={setSearch}
            placeholder="Search places..."
            icon={<Search color={brandBlue} size={20} strokeWidth={2} />}
            style={styles.searchField}
            trailing={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Use my current location"
                hitSlop={8}
              >
                <LocateFixed color={brandBlue} size={22} strokeWidth={2} />
              </Pressable>
            }
          />

          <SectionTitle
            icon={<UsersRound color="#ffffff" size={18} strokeWidth={2} />}
            title="Choose which vehicle to ride!"
          />
          <VehiclePicker value={vehicle} onChange={setVehicle} />

          <SectionTitle
            icon={<UserRound color="#ffffff" size={18} strokeWidth={2} />}
            title="Share a Ride?"
          />
          <SoftField
            value={shareQuery}
            onChangeText={setShareQuery}
            placeholder="Search a user..."
            accessibilityLabel="Search a user to share the ride with"
            icon={<UserRound color={brandBlue} size={20} strokeWidth={2} />}
            trailing={
              <ChevronRight color={brandBlue} size={20} strokeWidth={2.5} />
            }
            style={styles.shareField}
          />

          <View style={styles.passengerSection}>
            <View style={styles.passengerIcon}>
              <Users color={brandBlue} size={18} strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.passengerLabel}>Number of Passengers</Text>
              <PassengerStepper
                value={passengers}
                onChange={setPassengers}
                min={minPassengers}
                max={maxPassengers}
              />
            </View>
          </View>

          <ModuleButton label="CONFIRM" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  body: { paddingHorizontal: 12, paddingTop: 18 },
  searchField: { gap: 10 },
  shareField: { gap: 14, paddingHorizontal: 16 },
  passengerSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginTop: 22,
  },
  passengerIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: softBlue,
  },
  passengerLabel: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 11,
    marginBottom: 8,
  },
});
