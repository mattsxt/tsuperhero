import { Image } from "expo-image";
import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import MapIcon from "lucide-react-native/icons/map";
import MapPin from "lucide-react-native/icons/map-pin";
import Users from "lucide-react-native/icons/users";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { markNotificationsRead } from "@/api/v1/notifications/controllers";
import {
  loadShareInvites,
  respondToShareInvite,
  type ShareInvite,
} from "@/api/v1/pickups/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { LocationSettingsButton } from "@/components/location-settings-button";
import { moduleColors } from "@/components/module-ui";
import { useNotifications } from "@/hooks/use-notifications";
import { WaitingAreaDirectionsMap } from "@/pages/commuter/pickup/waiting-area-directions-map";
import { Routes } from "@/constants/routes";
import { getDistanceMeters } from "@/utils/geo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErrorAlert } from "@/components/error-alert";

const { brandBlue, mutedText, softBlue, text } = moduleColors;

const inviteTypes = new Set(["pickup_shared", "pickup_location_changed"]);

const formatDistance = (meters: number) =>
  meters < 1000
    ? `${Math.round(meters / 10) * 10} m away`
    : `${(meters / 1000).toFixed(1)} km away`;

const passengerLabel = (count: number) =>
  `${count} ${count === 1 ? "passenger" : "passengers"}`;

export function ShareInviteModal() {
  const { notifications } = useNotifications();
  const [invites, setInvites] = useState<ShareInvite[]>([]);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [problem, setProblem] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [locationProblem, setLocationProblem] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const trackMe = useCallback(
    (location: { lat: number; lng: number } | null) => setMe(location),
    [],
  );
  const trackLocationProblem = useCallback(
    (message: string | null) => setLocationProblem(message),
    [],
  );

  const shareNotifications = useMemo(
    () => notifications.filter((item) => inviteTypes.has(item.type)),
    [notifications],
  );
  const shareKey = shareNotifications.map((item) => item.id).join(",");
  const cancelledKey = notifications
    .filter((item) => item.type === "pickup_shared_cancelled")
    .map((item) => item.id)
    .join(",");

  const refresh = () =>
    loadShareInvites().then((result) => {
      if (result.ok) setInvites(result.data);
    });

  useEffect(() => {
    if (!shareKey) return;
    let active = true;
    const load = () =>
      loadShareInvites().then((result) => {
        if (active && result.ok) setInvites(result.data);
      });
    load();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") load();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [shareKey, cancelledKey]);

  const invite = shareKey ? invites[0] : undefined;
  if (!invite) return null;

  const respond = async (accept: boolean) => {
    if (busy) return;
    setBusy(accept ? "accept" : "decline");
    setProblem("");
    const result = await respondToShareInvite(invite.requestId, accept);
    setBusy(null);
    if (!result.ok) {
      setProblem(result.error);
      refresh();
      return;
    }
    markNotificationsRead(
      shareNotifications
        .filter((item) => item.data.request_id === invite.requestId)
        .map((item) => item.id),
    );
    setMapOpen(false);
    setInvites((current) =>
      current.filter((item) => item.requestId !== invite.requestId),
    );
    if (accept) router.push(Routes.commuterPickup);
  };

  const { from } = invite;
  const pickupLocation = invite.location;

  if (mapOpen && pickupLocation) {
    return (
      <Modal
        visible
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setMapOpen(false)}
      >
        <View style={styles.mapScreen}>
          <WaitingAreaDirectionsMap
            area={{
              id: `share-invite-${invite.requestId}`,
              name: invite.pickupName,
              type: "stop",
              lat: pickupLocation.lat,
              lng: pickupLocation.lng,
              routeId: null,
              vicinity: null,
            }}
            onLocationChange={trackMe}
            onLocationError={trackLocationProblem}
            locateTop={insets.top + 12}
            padTop={insets.top + 80}
            padBottom={insets.bottom + 150}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to the invitation"
            onPress={() => setMapOpen(false)}
            style={({ pressed }) => [
              styles.mapBack,
              { top: insets.top + 12 },
              pressed && styles.pressed,
            ]}
          >
            <ArrowLeft color={brandBlue} size={18} strokeWidth={2.5} />
            <Text style={styles.mapBackText}>Back to invitation</Text>
          </Pressable>
          <View
            style={[styles.mapPanel, { paddingBottom: insets.bottom + 16 }]}
          >
            <Text style={styles.eyebrow}>PICKUP LOCATION</Text>
            <Text style={styles.mapTitle} numberOfLines={2}>
              {invite.pickupName}
            </Text>
            {locationProblem ? (
              <View>
                <ErrorAlert title="Your location" message={locationProblem} />
                <LocationSettingsButton
                  color={brandBlue}
                  background={softBlue}
                />
              </View>
            ) : (
              <Text style={styles.detailText}>
                {me
                  ? `You’re ${formatDistance(getDistanceMeters(me, pickupLocation))}. Follow the route to the pickup point.`
                  : "Finding your location to show directions…"}
              </Text>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => undefined}
    >
      <View style={styles.root}>
        <View style={styles.card}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>
              {invite.locationChanged
                ? "PICKUP LOCATION CHANGED"
                : "SHARE A RIDE REQUEST"}
            </Text>
            {invites.length > 1 && (
              <Text
                style={styles.queue}
                accessibilityLabel={`Invitation 1 of ${invites.length}`}
              >
                1 OF {invites.length}
              </Text>
            )}
          </View>
          <View style={styles.sender}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{from.initials}</Text>
              {!!from.picture && (
                <Image
                  source={{ uri: from.picture }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              )}
            </View>
            <Text style={styles.title}>
              {invite.locationChanged
                ? `${from.name} changed the pickup location`
                : `${from.name} wants to share a ride with you`}
            </Text>
          </View>

          <View style={styles.detail}>
            <MapPin color={brandBlue} size={16} strokeWidth={2} />
            <Text style={styles.detailText} numberOfLines={2}>
              {invite.locationChanged ? "New pickup at" : "Pickup at"}{" "}
              {invite.pickupName}
            </Text>
          </View>
          {!!pickupLocation && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View the pickup location on the map"
              onPress={() => setMapOpen(true)}
              style={({ pressed }) => [
                styles.mapButton,
                pressed && styles.pressed,
              ]}
            >
              <MapIcon color={brandBlue} size={15} strokeWidth={2} />
              <Text style={styles.mapButtonText}>
                View on map with directions
              </Text>
            </Pressable>
          )}
          <View style={styles.detail}>
            <Users color={brandBlue} size={16} strokeWidth={2} />
            <Text style={styles.detailText}>
              {passengerLabel(invite.passengers)}
              {invite.status === "accepted" ? " · Driver on the way" : ""}
            </Text>
          </View>

          <Text style={styles.helper}>
            {invite.locationChanged
              ? "Accept to keep riding together from the new location. If you decline, you’ll leave this shared ride."
              : `If you decline, the pickup will be for ${passengerLabel(Math.max(1, invite.passengers - 1))}.`}
          </Text>

          {!!problem && (
            <ErrorAlert
              title="Ride invitation"
              message={problem}
              style={styles.problem}
            />
          )}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={!!busy}
              onPress={() => respond(false)}
              style={({ pressed }) => [
                styles.decline,
                (pressed || !!busy) && styles.pressed,
              ]}
            >
              {busy === "decline" ? (
                <LoadingLogo size={18} />
              ) : (
                <Text style={styles.declineText}>Decline</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !!busy, busy: busy === "accept" }}
              disabled={!!busy}
              onPress={() => respond(true)}
              style={({ pressed }) => [
                styles.accept,
                (pressed || !!busy) && styles.pressed,
              ]}
            >
              {busy === "accept" ? (
                <LoadingLogo color="#ffffff" size={18} />
              ) : (
                <Text style={styles.acceptText}>Accept</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  queue: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: softBlue,
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 10,
  },
  root: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#ffffff",
  },
  eyebrow: { color: mutedText, fontFamily: "SoraBold", fontSize: 10 },
  sender: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    marginBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: softBlue,
  },
  avatarText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 16 },
  title: {
    flex: 1,
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 15,
  },
  detail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  detailText: { flex: 1, color: text, fontFamily: "Sora", fontSize: 11 },
  helper: {
    marginTop: 8,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
  },
  problem: { marginTop: 10 },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  decline: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRadius: 12,
  },
  declineText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 13 },
  accept: {
    flex: 1,
    minWidth: 0,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: brandBlue,
  },
  acceptText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 15,
  },
  pressed: { opacity: 0.8 },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 2,
    marginBottom: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: softBlue,
  },
  mapButtonText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 10 },
  mapScreen: { flex: 1, backgroundColor: "#e8eaed" },
  mapBack: {
    position: "absolute",
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    elevation: 4,
  },
  mapBackText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 11 },
  mapPanel: {
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
  mapTitle: { color: brandBlue, fontFamily: "SoraBold", fontSize: 16 },
});
