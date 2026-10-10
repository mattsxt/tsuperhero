import { StatusBar } from "expo-status-bar";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import MapPin from "lucide-react-native/icons/map-pin";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  formatDistance,
  type WaitingAreaRecommendation,
} from "@/api/v1/waiting-areas/controllers";
import { ModuleButton, ModuleHeader, moduleColors } from "@/components/module-ui";
import { getDistanceMeters } from "@/utils/geo";

import { PickupAlert } from "./pickup-alert";
import {
  waitingAreaArrivalMeters,
  WaitingAreaDirectionsMap,
} from "./waiting-area-directions-map";

const { brandBlue, mutedText, text } = moduleColors;

export function WaitingAreaConfirmation({
  area,
  busy,
  problem,
  problemSource,
  onRequest,
  onBack,
}: {
  area: WaitingAreaRecommendation;
  busy: boolean;
  problem: string;
  problemSource: string;
  onRequest: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locationError, setLocationError] = useState<string | null>(null);
  const distance = useMemo(
    () => (location ? getDistanceMeters(location, area) : null),
    [location, area],
  );
  const arrived = distance !== null && distance <= waitingAreaArrivalMeters;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <WaitingAreaDirectionsMap
        area={area}
        onLocationChange={setLocation}
        onLocationError={setLocationError}
        padTop={145}
        padBottom={230 + insets.bottom}
      />

      <View style={styles.headerWrap}>
        <ModuleHeader
          title="Head to your pickup point"
          subtitle="Follow the route to your pickup point."
          icon={<MapPin color="#ffffff" size={42} strokeWidth={1.8} />}
          titleStyle={styles.headerTitle}
        />
      </View>

      <View style={[styles.card, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.label}>RECOMMENDED WAITING AREA</Text>
        <Text style={styles.areaName}>{area.name}</Text>
        {distance === null ? (
          <>
            <Text style={styles.message}>
              {locationError
                ? "We couldn’t get your location to show directions."
                : "Finding your location to show directions to the waiting area…"}
            </Text>
            {!!locationError && (
              <PickupAlert
                source="Current location"
                message={locationError}
                compact
              />
            )}
          </>
        ) : arrived ? (
          <Text style={styles.arrivedMessage}>
            You’re at the waiting area. You can now send your pickup request to
            nearby drivers.
          </Text>
        ) : (
          <Text style={styles.message}>
            You’re {formatDistance(distance)} away. Please go to this waiting
            area. Your pickup request will not be shown to drivers until you’re
            there.
          </Text>
        )}
        {!!problem && (
          <PickupAlert
            source={problemSource}
            message={problem}
            compact
          />
        )}
        <ModuleButton
          label={busy ? "SENDING REQUEST..." : "REQUEST PICKUP"}
          disabled={!arrived || busy}
          onPress={onRequest}
        />
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <ArrowLeft color={brandBlue} size={16} strokeWidth={2.5} />
          <Text style={styles.backText}>CHANGE PICKUP LOCATION</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#e8eaed" },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0 },
  headerTitle: { fontSize: 23, lineHeight: 29 },
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 8,
    paddingTop: 18,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#ffffff",
    elevation: 8,
  },
  label: { color: mutedText, fontFamily: "SoraBold", fontSize: 9 },
  areaName: { color: brandBlue, fontFamily: "SoraBold", fontSize: 16 },
  message: {
    color: text,
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
  },
  arrivedMessage: {
    color: "#15803d",
    fontFamily: "SoraBold",
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  backText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 9 },
  pressed: { opacity: 0.75 },
});
