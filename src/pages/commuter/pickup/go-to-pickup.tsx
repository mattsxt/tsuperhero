import { StatusBar } from "expo-status-bar";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import MapPin from "lucide-react-native/icons/map-pin";
import Users from "lucide-react-native/icons/users";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Rider } from "@/api/v1/pickups/controllers";
import {
  formatDistance,
  type WaitingArea,
} from "@/api/v1/waiting-areas/controllers";
import { ErrorAlert } from "@/components/error-alert";
import { ModuleButton, moduleColors } from "@/components/module-ui";
import { getDistanceMeters, type Coordinates } from "@/utils/geo";

import {
  WaitingAreaDirectionsMap,
  waitingAreaArrivalMeters,
} from "./waiting-area-directions-map";

const { brandBlue, mutedText, text } = moduleColors;

/**
 * Before a "pick me up at my selected location" request is sent, the commuter
 * (and every companion who accepted) must be at pickup point A on the route.
 * "I AM HERE" sends the request once everyone is within 60 m of it.
 */
export function GoToPickup({
  target,
  riders,
  busy,
  problem,
  onHere,
  onBack,
}: {
  target: { name: string; lat: number; lng: number };
  riders: Rider[];
  busy: boolean;
  problem: string;
  onHere: (location: Coordinates) => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [cardHeight, setCardHeight] = useState(240);

  const area = useMemo<WaitingArea>(
    () => ({
      id: "pickup-point",
      name: target.name,
      type: "stop",
      lat: target.lat,
      lng: target.lng,
      routeId: null,
      vicinity: null,
    }),
    [target.name, target.lat, target.lng],
  );
  const handleLocation = useCallback(
    (location: Coordinates | null) => setMe(location),
    [],
  );

  const distance = me ? getDistanceMeters(me, target) : null;
  const here = distance !== null && distance <= waitingAreaArrivalMeters;
  const companions = riders.filter((rider) => rider.inviteStatus === "accepted");
  const notArrived = companions
    .filter((rider) => !rider.arrived)
    .map((rider) => rider.name.split(" ")[0]);

  const label = busy
    ? "SENDING REQUEST..."
    : distance === null
      ? "FINDING YOUR LOCATION..."
      : !here
        ? `WALK ${formatDistance(distance).toUpperCase()} TO YOUR PICKUP POINT`
        : notArrived.length === 1
          ? `WAITING FOR ${notArrived[0].toUpperCase()} TO ARRIVE`
          : notArrived.length > 1
            ? `WAITING FOR ${notArrived.length} COMPANIONS TO ARRIVE`
            : "I AM HERE";

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <WaitingAreaDirectionsMap
        area={area}
        onLocationChange={handleLocation}
        onLocationError={setLocationError}
        locateTop={insets.top + 70}
        padTop={insets.top + 80}
        padBottom={cardHeight + 30}
      />

      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back without sending the request"
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <ArrowLeft color={brandBlue} size={20} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.topTitle}>GO TO YOUR PICKUP POINT</Text>
      </View>

      <View
        style={[styles.card, { paddingBottom: insets.bottom + 16 }]}
        onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
      >
        <View style={styles.row}>
          <MapPin color={brandBlue} size={16} strokeWidth={2.2} />
          <Text style={styles.name} numberOfLines={2}>
            {target.name}
          </Text>
        </View>
        <Text style={styles.hint}>
          Your request is sent once you’re at the pickup point on the route.
          {distance !== null && !here
            ? ` You’re ${formatDistance(distance)} away.`
            : ""}
        </Text>
        {companions.length > 0 && (
          <View style={styles.row}>
            <Users color={mutedText} size={14} strokeWidth={2} />
            <Text style={styles.hint}>
              {notArrived.length
                ? `Waiting for ${notArrived.join(", ")} to reach the pickup point.`
                : "Everyone in your shared ride is here."}
            </Text>
          </View>
        )}
        {!!locationError && (
          <ErrorAlert title="Location" message={locationError} />
        )}
        {!!problem && <ErrorAlert title="Pickup request" message={problem} />}
        <ModuleButton
          label={label}
          disabled={busy || !here || notArrived.length > 0 || !me}
          onPress={() => {
            if (me) onHere(me);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  pressed: { opacity: 0.8 },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  back: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: "#ffffff",
    elevation: 4,
  },
  topTitle: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 11,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 10,
    paddingTop: 18,
    paddingHorizontal: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#ffffff",
    elevation: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, color: text, fontFamily: "SoraBold", fontSize: 14 },
  hint: {
    flex: 1,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
  },
});
