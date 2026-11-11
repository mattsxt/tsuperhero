import { StatusBar } from "expo-status-bar";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Flag from "lucide-react-native/icons/flag";
import RadioTower from "lucide-react-native/icons/radio-tower";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  completeMyRide,
  formatEta,
  loadRideProgress,
  type PickupRequest,
  type RideProgress,
} from "@/api/v1/pickups/controllers";
import { watchLocation } from "@/api/v1/places/controllers";
import { findRoute } from "@/api/v1/transit-routes/controllers";
import { ConfirmModal } from "@/components/confirm-modal";
import { ErrorAlert } from "@/components/error-alert";
import { ModuleButton, moduleColors } from "@/components/module-ui";
import { TransitMap, type TransitMapState } from "@/components/transit-map";
import { useNow } from "@/hooks/use-now";
import { usePolling } from "@/hooks/use-polling";
import {
  choosePathFor,
  dropoffArrivalMeters,
  reachedDropoff,
  rideStats,
  straightRideStats,
  type Coordinates,
} from "@/utils/geo";

const { brandBlue, mutedText, softBlue, text } = moduleColors;

/** Ride ends automatically after this many readings in a row at B. */
const dropoffArrivalReadings = 2;
/** Older vehicle locations fall back to the commuter's own GPS. */
const vehicleStaleMs = 30_000;
const progressPollMs = 5_000;
const etaSpeedKmh = 18;

function formatKm(meters: number) {
  return meters < 1000
    ? `${Math.max(0, Math.round(meters / 10) * 10)} m left`
    : `${(meters / 1000).toFixed(1)} km left`;
}

/**
 * The commuter is on board: a minimal A -> B journey map with live progress.
 * Ends when the commuter reaches drop-off point B (or taps "I've been dropped
 * off"). Companions follow the owner's ride and can't end it themselves.
 */
export function RideInProgress({
  request,
  onArrived,
  onBack,
  isCompanion = false,
}: {
  request: Pick<
    PickupRequest,
    "id" | "lat" | "lng" | "dropoff" | "routeId" | "vehicle"
  >;
  onArrived: () => void;
  onBack: () => void;
  isCompanion?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [ride, setRide] = useState<RideProgress | null>(null);
  const [me, setMe] = useState<Coordinates | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [cardHeight, setCardHeight] = useState(260);
  const now = useNow(progressPollMs);
  const arrivalReadings = useRef(0);
  const finished = useRef(false);

  usePolling(async () => {
    const result = await loadRideProgress();
    if (result.ok && result.data) setRide(result.data);
  }, progressPollMs);

  useEffect(() => {
    let active = true;
    let subscription: { remove: () => void } | null = null;
    watchLocation(({ coords }) =>
      setMe({ lat: coords.latitude, lng: coords.longitude }),
    ).then((result) => {
      if (!result.ok) return;
      if (active) subscription = result.data;
      else result.data.remove();
    });
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  const pickupLat = ride?.pickup.lat ?? request.lat;
  const pickupLng = ride?.pickup.lng ?? request.lng;
  const pickup = useMemo(
    () => ({ lat: pickupLat, lng: pickupLng }),
    [pickupLat, pickupLng],
  );
  const dropoff = ride?.dropoff ?? request.dropoff;
  const routeId = ride?.routeId ?? request.routeId;

  const vehicleLive =
    !!ride?.vehicle && now - ride.vehicle.recordedAt.getTime() <= vehicleStaleMs;
  const position: Coordinates | null =
    vehicleLive && ride?.vehicle ? ride.vehicle : me;

  const path = useMemo(() => {
    const route = findRoute(routeId);
    if (!route || !dropoff) return null;
    return choosePathFor(
      [route.waypoints, ...route.alternativePaths],
      pickup,
      dropoff,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, pickup.lat, pickup.lng, dropoff?.lat, dropoff?.lng]);

  const stats = useMemo(
    () =>
      !dropoff
        ? null
        : path
          ? rideStats(path, pickup, dropoff, position)
          : // Tricycles have no fixed route: measure point to point.
            straightRideStats(pickup, dropoff, position),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, pickup.lat, pickup.lng, dropoff?.lat, dropoff?.lng, position?.lat, position?.lng],
  );

  const finish = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    setBusy(true);
    setProblem("");
    const result = await completeMyRide(request.id);
    setBusy(false);
    if (!result.ok) {
      finished.current = false;
      setProblem(result.error);
      return;
    }
    onArrived();
  }, [request.id, onArrived]);

  // Auto drop-off: two readings in a row within 50 m of B along the route (or
  // already past it). Re-checked on every tick, so a vehicle parked at B counts.
  useEffect(() => {
    if (isCompanion || !dropoff || !position) return;
    if (reachedDropoff(stats, position, dropoff)) {
      arrivalReadings.current += 1;
      if (arrivalReadings.current >= dropoffArrivalReadings) void finish();
    } else {
      arrivalReadings.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, position?.lat, position?.lng, stats, isCompanion]);

  const mapState = useMemo<TransitMapState>(() => {
    const points: [number, number][] = [[pickup.lat, pickup.lng]];
    if (dropoff) points.push([dropoff.lat, dropoff.lng]);
    if (position) points.push([position.lat, position.lng]);
    return {
      routeId: routeId ?? null,
      route: stats?.ahead ?? null,
      alternativeRoutes: stats?.travelled.length ? [stats.travelled] : [],
      vehicles:
        vehicleLive && ride?.vehicle
          ? [
              {
                id: "ride-vehicle",
                lat: ride.vehicle.lat,
                lng: ride.vehicle.lng,
                type: request.vehicle,
                label: ride.plateNumber,
              },
            ]
          : [],
      pickups: [
        { id: "ride-a", lat: pickup.lat, lng: pickup.lng, badge: "A" },
        ...(dropoff
          ? [
              {
                id: "ride-b",
                lat: dropoff.lat,
                lng: dropoff.lng,
                badge: "B",
                label: dropoff.name,
              },
            ]
          : []),
      ],
      userLocation: vehicleLive ? null : me,
      focus: null,
      fit: { key: `${request.id}:${dropoff ? 1 : 0}`, points },
      padTop: insets.top + 80,
      padBottom: cardHeight + 30,
    };
  }, [
    pickup,
    dropoff,
    position,
    routeId,
    stats,
    vehicleLive,
    ride,
    me,
    request.id,
    request.vehicle,
    insets.top,
    cardHeight,
  ]);

  const remaining = stats?.remainingMeters ?? null;
  const etaText =
    remaining === null
      ? null
      : remaining <= dropoffArrivalMeters
        ? "Arriving now"
        : `Arriving ${formatEta(remaining / ((etaSpeedKmh * 1000) / 3600))}`;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <TransitMap state={mapState} />

      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <ArrowLeft color={brandBlue} size={20} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.topTitle}>ON THE WAY</Text>
      </View>

      <View
        style={[styles.card, { paddingBottom: insets.bottom + 16 }]}
        onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
      >
        <View style={styles.destinationRow}>
          <View style={styles.destinationIcon}>
            <Flag color="#ffffff" size={16} strokeWidth={2.2} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.label}>DROP-OFF</Text>
            <Text style={styles.destination} numberOfLines={2}>
              {dropoff?.name || "Your drop-off point"}
            </Text>
          </View>
        </View>

        {stats && (
          <>
            <View style={styles.track}>
              <View
                style={[
                  styles.trackFill,
                  { width: `${Math.round(stats.progress * 100)}%` },
                ]}
              />
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.statStrong}>
                {formatKm(stats.remainingMeters)}
              </Text>
              {etaText && <Text style={styles.stat}>{etaText}</Text>}
            </View>
          </>
        )}

        {(ride?.driverName || ride?.plateNumber) && (
          <Text style={styles.driver}>
            {[ride.driverName, ride.plateNumber].filter(Boolean).join(" · ")}
          </Text>
        )}

        {!vehicleLive && (
          <View style={styles.liveNote}>
            <RadioTower color={mutedText} size={14} strokeWidth={2} />
            <Text style={styles.liveNoteText}>
              Live vehicle location unavailable
            </Text>
          </View>
        )}

        {!!problem && (
          <ErrorAlert
            title="Drop-off"
            message={problem}
            style={{ marginTop: 10 }}
          />
        )}

        {!isCompanion && (
          <ModuleButton
            label={busy ? "FINISHING..." : "I'VE BEEN DROPPED OFF"}
            disabled={busy}
            onPress={() => setConfirmOpen(true)}
          />
        )}
      </View>

      <ConfirmModal
        visible={confirmOpen}
        title="Dropped off?"
        message="This ends your ride. Only confirm once you've gotten off the vehicle."
        confirmLabel="Yes, I'm off"
        cancelLabel="Still riding"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void finish();
        }}
      />
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
  destinationRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  destinationIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: brandBlue,
  },
  label: { color: mutedText, fontFamily: "SoraBold", fontSize: 10 },
  destination: {
    color: text,
    fontFamily: "SoraBold",
    fontSize: 15,
    marginTop: 2,
  },
  track: {
    height: 8,
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: softBlue,
  },
  trackFill: { height: 8, borderRadius: 4, backgroundColor: brandBlue },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statStrong: { color: brandBlue, fontFamily: "SoraBold", fontSize: 12 },
  stat: { color: mutedText, fontFamily: "Sora", fontSize: 11 },
  driver: { color: text, fontFamily: "Sora", fontSize: 11 },
  liveNote: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveNoteText: { color: mutedText, fontFamily: "Sora", fontSize: 10 },
});
