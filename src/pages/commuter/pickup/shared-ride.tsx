import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import BusFront from "lucide-react-native/icons/bus-front";
import LogOut from "lucide-react-native/icons/log-out";
import MapPin from "lucide-react-native/icons/map-pin";
import Users from "lucide-react-native/icons/users";
import UsersRound from "lucide-react-native/icons/users-round";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  updateCompanionPresence,
  type SharedRide,
} from "@/api/v1/pickups/controllers";
import { formatDistance } from "@/api/v1/waiting-areas/controllers";
import { StatusPill, type PillTone } from "@/components/card-badges";
import { ConfirmModal } from "@/components/confirm-modal";
import { ErrorAlert } from "@/components/error-alert";
import { LoadingLogo } from "@/components/LoadingLogo";
import { LocationSettingsButton } from "@/components/location-settings-button";
import { ModuleHeader, moduleColors } from "@/components/module-ui";
import { getDistanceMeters } from "@/utils/geo";

import { WaitingAreaDirectionsMap } from "./waiting-area-directions-map";
import { palette } from "@/constants/colors";

const { brandBlue, error, mutedText, softBlue, text } = moduleColors;

const presenceIntervalMs = 15_000;
const arriveMeters = 60;
const leaveMeters = 150;

const stages: Record<
  SharedRide["stage"],
  { label: string; tone: PillTone; message: (ride: SharedRide) => string }
> = {
  "waiting-confirmation": {
    label: "Waiting for confirmation",
    tone: "pending",
    message: (ride) =>
      `${ride.owner.name} hasn’t confirmed the pickup yet. Drivers will see it once they do.`,
  },
  "waiting-driver": {
    label: "Waiting for a driver",
    tone: "live",
    message: (ride) =>
      ride.ownerArrived
        ? "Drivers nearby can see the pickup. Head to the pickup point."
        : `The pickup is confirmed. Drivers will see it once ${ride.owner.name} reaches the pickup point.`,
  },
  "driver-on-the-way": {
    label: "Driver on the way",
    tone: "accepted",
    message: (ride) =>
      ride.plateNumber
        ? `${ride.plateNumber} accepted the pickup. Be at the pickup point.`
        : "A driver accepted the pickup. Be at the pickup point.",
  },
};

export function SharedRideScreen({
  ride,
  busy,
  problem,
  onLeave,
  onBack,
}: {
  ride: SharedRide;
  busy: boolean;
  problem: string;
  onLeave: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const stage = stages[ride.stage];
  const [locationError, setLocationError] = useState<string | null>(null);
  const [arrived, setArrived] = useState(ride.meArrived);
  const lastReport = useRef<{ at: number; near: boolean } | null>(null);

  useEffect(() => {
    if (!me) return;
    const distance = getDistanceMeters(me, ride);
    const near = distance <= arriveMeters;
    const far = distance > leaveMeters;
    const last = lastReport.current;
    const crossed = !last || (near && !last.near) || (far && last.near);
    if (!crossed && Date.now() - last.at < presenceIntervalMs) return;
    lastReport.current = {
      at: Date.now(),
      near: near || (!far && !!last?.near),
    };
    void updateCompanionPresence(ride.requestId, me).then((result) => {
      if (result.ok) setArrived(result.data);
    });
  }, [me, ride]);

  const trackLocationError = useCallback(
    (message: string | null) => setLocationError(message),
    [],
  );

  const [confirmingLeave, setConfirmingLeave] = useState(false);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <WaitingAreaDirectionsMap
        area={{
          id: `shared-ride-${ride.requestId}`,
          name: ride.pickupName,
          type: "stop",
          lat: ride.lat,
          lng: ride.lng,
          routeId: null,
          vicinity: null,
        }}
        onLocationChange={setMe}
        onLocationError={trackLocationError}
        locateTop={157}
        padTop={145}
        padBottom={300 + insets.bottom}
      />

      <View style={styles.headerWrap}>
        <ModuleHeader
          title="Your shared ride"
          subtitle="You joined another commuter’s pickup. Follow the route to the pickup point."
          icon={<UsersRound color="#ffffff" size={42} strokeWidth={1.8} />}
          onBack={onBack}
        />
      </View>

      <View style={[styles.card, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.ownerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{ride.owner.initials}</Text>
            {!!ride.owner.picture && (
              <Image
                source={{ uri: ride.owner.picture }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            )}
          </View>
          <View style={styles.flex}>
            <Text style={styles.label}>SHARED RIDE WITH</Text>
            <Text style={styles.ownerName} numberOfLines={1}>
              {ride.owner.name}
            </Text>
          </View>
          <StatusPill label={stage.label} tone={stage.tone} />
        </View>

        <Text style={styles.message}>{stage.message(ride)}</Text>
        {locationError ? (
          <View>
            <ErrorAlert title="Your location" message={locationError} />
            <LocationSettingsButton color={brandBlue} background={softBlue} />
          </View>
        ) : (
          <View
            style={[
              styles.presence,
              arrived ? styles.presenceHere : styles.presenceAway,
            ]}
          >
            <Text
              style={[
                styles.presenceText,
                { color: arrived ? palette.success : "#92400e" },
              ]}
            >
              {arrived
                ? "YOU’RE AT THE PICKUP POINT"
                : "HEAD TO THE PICKUP POINT"}
            </Text>
          </View>
        )}

        <View style={styles.detail}>
          <MapPin color={brandBlue} size={15} strokeWidth={2} />
          <Text style={styles.detailText} numberOfLines={2}>
            Pickup at {ride.pickupName}
            {me ? ` · ${formatDistance(getDistanceMeters(me, ride))} away` : ""}
          </Text>
        </View>
        <View style={styles.detail}>
          {ride.stage === "driver-on-the-way" ? (
            <BusFront color={brandBlue} size={15} strokeWidth={2} />
          ) : (
            <Users color={brandBlue} size={15} strokeWidth={2} />
          )}
          <Text style={styles.detailText}>
            {ride.passengers}{" "}
            {ride.passengers === 1 ? "passenger" : "passengers"} ·{" "}
            {ride.vehicle === "jeep" ? "Jeepney" : "Tricycle"}
            {ride.plateNumber ? ` · ${ride.plateNumber}` : ""}
          </Text>
        </View>

        {!!problem && <ErrorAlert title="Shared ride" message={problem} />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave this shared ride"
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={() => setConfirmingLeave(true)}
          style={({ pressed }) => [
            styles.leaveButton,
            (pressed || busy) && styles.pressed,
          ]}
        >
          {busy ? (
            <LoadingLogo color={error} size={18} />
          ) : (
            <>
              <LogOut color={error} size={16} strokeWidth={2.2} />
              <Text style={styles.leaveText}>LEAVE SHARED RIDE</Text>
            </>
          )}
        </Pressable>
      </View>

      <ConfirmModal
        visible={confirmingLeave}
        title="Leave this shared ride?"
        message={`${ride.owner.name} will be notified, and the pickup will be for one passenger fewer.`}
        confirmLabel="Leave ride"
        cancelLabel="Stay"
        destructive
        icon={<LogOut color="#ffffff" size={22} strokeWidth={2.2} />}
        onCancel={() => setConfirmingLeave(false)}
        onConfirm={() => {
          setConfirmingLeave(false);
          onLeave();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  presence: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  presenceHere: { backgroundColor: "#dcfce7" },
  presenceAway: { backgroundColor: "#fef3c7" },
  presenceText: { fontFamily: "SoraBold", fontSize: 10 },
  screen: { flex: 1, backgroundColor: "#e8eaed" },
  flex: { flex: 1 },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0 },
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 10,
    paddingTop: 18,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#ffffff",
    elevation: 8,
  },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: softBlue,
  },
  avatarText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 14 },
  label: { color: mutedText, fontFamily: "SoraBold", fontSize: 10 },
  ownerName: { color: brandBlue, fontFamily: "SoraBold", fontSize: 15 },
  message: { color: text, fontFamily: "Sora", fontSize: 11, lineHeight: 16 },
  detail: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailText: { flex: 1, color: text, fontFamily: "Sora", fontSize: 11 },
  leaveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: error,
    borderRadius: 12,
  },
  leaveText: { color: error, fontFamily: "SoraBold", fontSize: 11 },
  pressed: { opacity: 0.75 },
});
