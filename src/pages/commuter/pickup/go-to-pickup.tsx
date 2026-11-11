import { StatusBar } from "expo-status-bar";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import CircleCheck from "lucide-react-native/icons/circle-check";
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
import { palette } from "@/constants/colors";
import { getDistanceMeters, type Coordinates } from "@/utils/geo";

import {
  WaitingAreaDirectionsMap,
  waitingAreaArrivalMeters,
} from "./waiting-area-directions-map";

const { brandBlue, mutedText, softBlue, text } = moduleColors;
const walkingMetersPerMinute = 5000 / 60;

const isPlusCode = (name: string) => /^[23456789CFGHJMPQRVWX]{2,8}\+/i.test(name);

export function GoToPickup({
  target,
  routeName,
  riders,
  busy,
  problem,
  onHere,
  onBack,
}: {
  target: { name: string; lat: number; lng: number };
  routeName: string | null;
  riders: Rider[];
  busy: boolean;
  problem: string;
  onHere: (location: Coordinates) => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [cardHeight, setCardHeight] = useState(260);

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
  const ready = here && notArrived.length === 0 && !busy;

  const placeName = isPlusCode(target.name)
    ? routeName
      ? `On the ${routeName} route`
      : "Your pinned location"
    : target.name;
  const placeDetail =
    !isPlusCode(target.name) && routeName ? `${routeName} route` : null;

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
        <View style={styles.titlePill}>
          <Text style={styles.topTitle}>GO TO YOUR PICKUP POINT</Text>
        </View>
      </View>

      <View
        style={[styles.card, { paddingBottom: insets.bottom + 16 }]}
        onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
      >
        {here ? (
          <View style={[styles.statusRow, styles.hereRow]}>
            <CircleCheck color={palette.success} size={22} strokeWidth={2.2} />
            <Text style={[styles.statusTitle, { color: palette.success }]}>
              You’re at the pickup point
            </Text>
          </View>
        ) : distance === null ? (
          <View style={styles.statusRow}>
            <Text style={styles.distanceMeta}>Finding your location…</Text>
          </View>
        ) : (
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatDistance(distance)}</Text>
              <Text style={styles.statLabel}>AWAY</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {Math.max(1, Math.round(distance / walkingMetersPerMinute))} min
              </Text>
              <Text style={styles.statLabel}>WALK</Text>
            </View>
          </View>
        )}

        <View style={styles.place}>
          <View style={styles.placeIcon}>
            <MapPin color={brandBlue} size={16} strokeWidth={2.2} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.placeName} numberOfLines={1}>
              {placeName}
            </Text>
            {!!placeDetail && (
              <Text style={styles.placeDetail} numberOfLines={1}>
                {placeDetail}
              </Text>
            )}
          </View>
        </View>

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
          label={busy ? "SENDING…" : "I AM HERE"}
          disabled={!ready}
          style={[styles.button, !ready && styles.buttonDisabled]}
          onPress={() => {
            if (me) onHere(me);
          }}
        />
        <Text style={styles.footnote}>
          {ready
            ? "Tap to send your request. Nearby drivers will see it right away."
            : here
              ? "You can send the request once everyone has arrived."
              : "Your request is sent when you tap I AM HERE at the pickup point."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  back: {
    position: "absolute",
    left: 0,
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: "#ffffff",
    elevation: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  titlePill: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: brandBlue,
    elevation: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  topTitle: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 11,
    letterSpacing: 0.6,
  },
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 12,
    paddingTop: 20,
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
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hereRow: {
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: palette.successSoft,
  },
  statusTitle: {
    fontFamily: "SoraBold",
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  distanceMeta: { color: mutedText, fontFamily: "Sora", fontSize: 12 },
  stats: { flexDirection: "row", alignItems: "center" },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { color: brandBlue, fontFamily: "SoraBold", fontSize: 22 },
  statLabel: {
    color: mutedText,
    fontFamily: "SoraBold",
    fontSize: 10,
    letterSpacing: 0.8,
  },
  statDivider: { width: 1, alignSelf: "stretch", backgroundColor: "#e2e8f0" },
  place: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
  },
  placeIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: softBlue,
  },
  placeName: { color: text, fontFamily: "SoraBold", fontSize: 13 },
  placeDetail: {
    marginTop: 2,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 11,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  hint: {
    flex: 1,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
  },
  button: { marginTop: 4 },
  buttonDisabled: { backgroundColor: "#94a3b8" },
  footnote: {
    marginTop: -4,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
  },
});
