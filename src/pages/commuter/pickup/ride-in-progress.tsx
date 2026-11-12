import { StatusBar } from "expo-status-bar";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import BusFront from "lucide-react-native/icons/bus-front";
import Flag from "lucide-react-native/icons/flag";
import RadioTower from "lucide-react-native/icons/radio-tower";
import Siren from "lucide-react-native/icons/siren";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  completeMyRide,
  loadRideProgress,
  reportRideEmergency,
  type PickupRequest,
  type RideProgress,
} from "@/api/v1/pickups/controllers";
import { watchLocation } from "@/api/v1/places/controllers";
import {
  findRoute,
  loadAlternativeGeometry,
  loadEtaRoute,
  loadRouteGeometry,
  type LatLng,
} from "@/api/v1/transit-routes/controllers";
import { ConfirmModal } from "@/components/confirm-modal";
import { ErrorAlert } from "@/components/error-alert";
import { isSimulation } from "@/simulation/flag";
import { moduleColors } from "@/components/module-ui";
import { TransitMap, type TransitMapState } from "@/components/transit-map";
import { useNow } from "@/hooks/use-now";
import { usePolling } from "@/hooks/use-polling";
import {
  choosePathFor,
  createPositionThrottle,
  dropoffArrivalMeters,
  reachedDropoff,
  rideStats,
  straightRideStats,
  type Coordinates,
} from "@/utils/geo";

const { brandBlue, mutedText, softBlue, text } = moduleColors;
const pickupGreen = "#16a34a";
const dropoffRed = "#dc2626";

const dropoffArrivalReadings = 2;
const vehicleStaleMs = 30_000;
const progressPollMs = 5_000;
const etaSpeedKmh = 18;

const genericPlaceNames = /^(pinned location|current location|dropped pin)$/i;
const isPlusCode = (name: string) => /^[23456789CFGHJMPQRVWX]{2,8}\+/i.test(name);

function placeLabel(name: string | null | undefined) {
  if (!name || genericPlaceNames.test(name.trim()) || isPlusCode(name.trim())) {
    return "Your drop-off point";
  }
  return name;
}

function splitDistance(meters: number) {
  return meters < 1000
    ? { value: `${Math.max(0, Math.round(meters / 10) * 10)} m` }
    : { value: `${(meters / 1000).toFixed(1)} km` };
}

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
  const [sosOpen, setSosOpen] = useState(false);
  const [sosNoticeOpen, setSosNoticeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [cardHeight, setCardHeight] = useState(260);
  const [roads, setRoads] = useState<{ key: string; paths: LatLng[][] } | null>(
    null,
  );
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
    const allow = createPositionThrottle();
    watchLocation(({ coords, timestamp }) => {
      const next = { lat: coords.latitude, lng: coords.longitude };
      if (allow({ ...next, at: timestamp })) setMe(next);
    }).then((result) => {
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

  const roadKey = routeId
    ? `route:${routeId}`
    : dropoff
      ? `trip:${pickup.lat},${pickup.lng}>${dropoff.lat},${dropoff.lng}`
      : null;

  useEffect(() => {
    if (!roadKey) return;
    let active = true;
    const route = findRoute(routeId);
    const load: Promise<LatLng[][]> = route
      ? Promise.all([
          loadRouteGeometry(route),
          loadAlternativeGeometry(route),
        ]).then(([main, alternatives]) => [main, ...alternatives])
      : dropoff
        ? loadEtaRoute(
            [pickup.lat, pickup.lng],
            [dropoff.lat, dropoff.lng],
          ).then((result) => (result.ok ? [result.data.path] : []))
        : Promise.resolve([]);
    load
      .then((paths) => {
        if (active) {
          setRoads({
            key: roadKey,
            paths: paths.filter((path) => path.length > 1),
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadKey]);

  const vehicleLive =
    !!ride?.vehicle && now - ride.vehicle.recordedAt.getTime() <= vehicleStaleMs;
  const position: Coordinates | null =
    vehicleLive && ride?.vehicle ? ride.vehicle : me;

  const path = useMemo(() => {
    if (!dropoff) return null;
    const roadPaths = roads?.key === roadKey ? roads.paths : [];
    if (roadPaths.length) return choosePathFor(roadPaths, pickup, dropoff);
    const route = findRoute(routeId);
    return route
      ? choosePathFor([route.waypoints, ...route.alternativePaths], pickup, dropoff)
      : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roads, roadKey, routeId, pickup.lat, pickup.lng, dropoff?.lat, dropoff?.lng]);

  const stats = useMemo(
    () =>
      !dropoff
        ? null
        : path
          ? rideStats(path, pickup, dropoff, position)
          : straightRideStats(pickup, dropoff, position),
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
              },
            ]
          : [],
      pickups: [
        {
          id: "ride-a",
          lat: pickup.lat,
          lng: pickup.lng,
          badge: "A",
          label: "Pickup",
          color: pickupGreen,
        },
        ...(dropoff
          ? [
              {
                id: "ride-b",
                lat: dropoff.lat,
                lng: dropoff.lng,
                badge: "B",
                label: "Drop-off",
                color: dropoffRed,
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
  const arrivingNow = remaining !== null && remaining <= dropoffArrivalMeters;
  const minutes =
    remaining === null
      ? null
      : Math.max(1, Math.round(remaining / ((etaSpeedKmh * 1000) / 60)));
  const progressPercent = Math.round((stats?.progress ?? 0) * 100);

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
        <View style={styles.titlePill}>
          <Text style={styles.topTitle}>ON THE WAY</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="SOS: call 911 and alert TsuperHero"
          hitSlop={6}
          onPress={() => setSosOpen(true)}
          style={({ pressed }) => [styles.sos, pressed && styles.pressed]}
        >
          <Text style={styles.sosText}>SOS</Text>
        </Pressable>
      </View>

      <View
        style={[styles.card, { paddingBottom: insets.bottom + 16 }]}
        onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
      >
        <View style={styles.destinationRow}>
          <View style={styles.destinationIcon}>
            <Flag color="#ffffff" size={18} strokeWidth={2.4} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.label}>DROPPING YOU OFF AT</Text>
            <Text style={styles.destination} numberOfLines={1}>
              {placeLabel(dropoff?.name)}
            </Text>
          </View>
        </View>

        {stats && (
          <>
            {arrivingNow ? (
              <Text style={styles.arriving}>Arriving now</Text>
            ) : (
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{minutes} min</Text>
                  <Text style={styles.statLabel}>TO GO</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>
                    {splitDistance(remaining ?? 0).value}
                  </Text>
                  <Text style={styles.statLabel}>LEFT</Text>
                </View>
              </View>
            )}

            <View
              style={styles.journey}
              accessibilityLabel={`${progressPercent}% of the way to your drop-off`}
            >
              <View style={[styles.journeyDot, { backgroundColor: pickupGreen }]}>
                <Text style={styles.journeyDotText}>A</Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[styles.trackFill, { width: `${progressPercent}%` }]}
                />
              </View>
              <View style={[styles.journeyDot, { backgroundColor: dropoffRed }]}>
                <Text style={styles.journeyDotText}>B</Text>
              </View>
            </View>
          </>
        )}

        {!!ride?.plateNumber && (
          <View style={styles.vehicleRow}>
            <BusFront color={brandBlue} size={18} strokeWidth={2.2} />
            <Text style={styles.vehicleText}>
              Your vehicle:{" "}
              <Text style={styles.plate}>{ride.plateNumber}</Text>
            </Text>
          </View>
        )}

        {!vehicleLive && (
          <View style={styles.liveNote}>
            <RadioTower color={mutedText} size={14} strokeWidth={2} />
            <Text style={styles.liveNoteText}>
              Showing your phone’s location. Live vehicle location unavailable.
            </Text>
          </View>
        )}

        {!!problem && <ErrorAlert title="Drop-off" message={problem} />}

        {!isCompanion && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => setConfirmOpen(true)}
            style={({ pressed }) => [
              styles.offButton,
              (pressed || busy) && styles.pressed,
            ]}
          >
            <Text style={styles.offButtonText}>
              {busy ? "FINISHING…" : "I’VE BEEN DROPPED OFF"}
            </Text>
          </Pressable>
        )}
      </View>

      <ConfirmModal
        visible={sosOpen}
        destructive
        title="Call 911?"
        message="This calls emergency services and sends your live location, driver and plate number to TsuperHero admins."
        confirmLabel="Call 911"
        cancelLabel="Cancel"
        icon={<Siren color="#ffffff" size={22} strokeWidth={2.2} />}
        onCancel={() => setSosOpen(false)}
        onConfirm={() => {
          setSosOpen(false);
          if (isSimulation()) setTimeout(() => setSosNoticeOpen(true), 0);
          else void Linking.openURL("tel:911");
          void reportRideEmergency(request.id, position);
        }}
      />
      <ConfirmModal
        visible={sosNoticeOpen}
        title="Simulation"
        message="Simulation: 911 would be called here. TsuperHero admins were still alerted."
        confirmLabel="OK"
        cancelLabel="OK"
        hideCancel
        onCancel={() => setSosNoticeOpen(false)}
        onConfirm={() => setSosNoticeOpen(false)}
      />
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
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  back: {
    position: "absolute",
    left: 0,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "#ffffff",
    elevation: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  sos: {
    position: "absolute",
    right: 0,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    borderWidth: 3,
    borderColor: "#ffffff",
    backgroundColor: dropoffRed,
    elevation: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  sosText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 12,
    letterSpacing: 0.6,
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
    gap: 14,
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
  destinationRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  destinationIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: dropoffRed,
  },
  label: {
    color: mutedText,
    fontFamily: "SoraBold",
    fontSize: 10,
    letterSpacing: 0.6,
  },
  destination: {
    marginTop: 2,
    color: text,
    fontFamily: "SoraBold",
    fontSize: 17,
  },
  stats: { flexDirection: "row", alignItems: "center" },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { color: brandBlue, fontFamily: "SoraBold", fontSize: 24 },
  statLabel: {
    color: mutedText,
    fontFamily: "SoraBold",
    fontSize: 10,
    letterSpacing: 0.8,
  },
  statDivider: { width: 1, alignSelf: "stretch", backgroundColor: "#e2e8f0" },
  arriving: {
    color: pickupGreen,
    fontFamily: "SoraBold",
    fontSize: 22,
    textAlign: "center",
  },
  journey: { flexDirection: "row", alignItems: "center", gap: 8 },
  journeyDot: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  journeyDotText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 11 },
  track: {
    flex: 1,
    height: 8,
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: softBlue,
  },
  trackFill: { height: 8, borderRadius: 4, backgroundColor: brandBlue },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
  },
  vehicleText: { color: mutedText, fontFamily: "Sora", fontSize: 13 },
  plate: { color: text, fontFamily: "SoraBold", fontSize: 14 },
  liveNote: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveNoteText: {
    flex: 1,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 11,
  },
  offButton: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: brandBlue,
    backgroundColor: "#ffffff",
  },
  offButtonText: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 15,
    letterSpacing: 0.6,
  },
});
