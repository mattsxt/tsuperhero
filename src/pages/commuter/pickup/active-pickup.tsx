import { StatusBar } from "expo-status-bar";
import ClockFading from "lucide-react-native/icons/clock-fading";
import Footprints from "lucide-react-native/icons/footprints";
import LocateFixed from "lucide-react-native/icons/locate-fixed";
import MapPin from "lucide-react-native/icons/map-pin";
import MapPinX from "lucide-react-native/icons/map-pin-x";
import RadioTower from "lucide-react-native/icons/radio-tower";
import Users from "lucide-react-native/icons/users";
import Hourglass from "lucide-react-native/icons/hourglass";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  formatEta,
  loadPickupCompanionStatuses,
  loadPickupDriver,
  markPickupArrived,
  markPickupAway,
  type Rider,
  type PickupDriver,
  type PickupRequest,
} from "@/api/v1/pickups/controllers";
import { watchLocation } from "@/api/v1/places/controllers";
import {
  loadEtaRoute,
  vehicleTypeLabels,
  type EtaRoute,
  type LatLng,
} from "@/api/v1/transit-routes/controllers";
import { VehicleIcon } from "@/components/module-icons";
import { ModuleHeader } from "@/components/module-ui";
import { TransitMap, type TransitMapState } from "@/components/transit-map";
import { usePolling } from "@/hooks/use-polling";
import { getDistanceMeters } from "@/utils/geo";
import { BrandLogo } from "@/components/brand-logo";
import { LoadingLogo } from "@/components/LoadingLogo";
import type { WaitingArea } from "@/api/v1/waiting-areas/controllers";

import {
  waitingAreaArrivalMeters,
  WaitingAreaDirectionsMap,
} from "./waiting-area-directions-map";
import { ConfirmModal } from "@/components/confirm-modal";
import { CompanionAvatars } from "./companion-avatars";
import { ErrorAlert } from "@/components/error-alert";
import { formatDistance } from "@/api/v1/waiting-areas/controllers";
import { LocationSettingsButton } from "@/components/location-settings-button";
import { useNow } from "@/hooks/use-now";
import { palette } from "@/constants/colors";

const panelNavy = palette.navy;
const routeCyan = palette.cyan;
const cancelRed = palette.danger;

const driverPollMs = 3_000;
const rerouteMeters = 40;
const rerouteMs = 30_000;
const arrivingMeters = 30;
const roadFactor = 1.3;
const fallbackKmh = 15;
const arrivalRetryMs = 10_000;
const awayMeters = 150;
const awayGraceMs = 2 * 60_000;
const noDriverMs = 10 * 60_000;
const companionPollMs = 5_000;

type Coordinates = { lat: number; lng: number };

function estimateSeconds(from: Coordinates, to: Coordinates, speedKmh: number) {
  const meters = getDistanceMeters(from, to) * roadFactor;
  return meters / (Math.max(speedKmh, fallbackKmh) / 3.6);
}

export function ActivePickup({
  request,
  busy,
  problem,
  problemSource,
  onCancel,
  onBack,
  onArrived,
  onLeft,
}: {
  request: PickupRequest;
  busy: boolean;
  problem: string;
  problemSource: string;
  onCancel: () => void;
  onBack: () => void;
  onArrived: () => void;
  onLeft: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(140);
  const [cardHeight, setCardHeight] = useState(200);
  const [me, setMe] = useState<Coordinates | null>(null);
  const [driver, setDriver] = useState<PickupDriver | null>(null);
  const [eta, setEta] = useState<EtaRoute | null>(null);
  const lastRouted = useRef<{ at: number; from: Coordinates } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [arrivalProblem, setArrivalProblem] = useState("");
  const lastArrivalAttempt = useRef(0);
  const lastAwayReport = useRef(0);
  const mounted = useRef(true);
  const [awaySince, setAwaySince] = useState<number | null>(null);
  const [recenters, setRecenters] = useState(0);
  const [companions, setCompanions] = useState<Rider[]>([]);

  const matched = request.status === "accepted";
  const pickupPoint = useMemo(
    () => ({ lat: request.lat, lng: request.lng }),
    [request.lat, request.lng],
  );
  const driverLocation = matched ? (driver?.location ?? null) : null;
  const handleLocation = useCallback(
    (location: Coordinates | null) => {
      setMe(location);
      if (!location) return;
      const away = getDistanceMeters(location, pickupPoint) > awayMeters;
      setAwaySince((since) => (away ? (since ?? Date.now()) : null));
    },
    [pickupPoint],
  );
  const waitingArea = useMemo<WaitingArea>(
    () => ({
      id: `pickup-waiting-area-${request.id}`,
      name: request.pickupName,
      type: request.waitingAreaType ?? "stop",
      lat: request.lat,
      lng: request.lng,
      routeId: null,
      vicinity: null,
    }),
    [
      request.id,
      request.pickupName,
      request.waitingAreaType,
      request.lat,
      request.lng,
    ],
  );

  useEffect(() => {
    if (request.vehicle === "jeep" || !matched) return;
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
  }, [request.vehicle, matched]);

  const distance = me ? getDistanceMeters(me, pickupPoint) : null;
  const withinRange = distance !== null && distance <= waitingAreaArrivalMeters;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (matched || request.arrived || !withinRange || !me) return;
    if (Date.now() - lastArrivalAttempt.current < arrivalRetryMs) return;
    lastArrivalAttempt.current = Date.now();
    markPickupArrived(request.id, me).then((result) => {
      if (!mounted.current) return;
      if (result.ok) {
        setArrivalProblem("");
        onArrived();
      } else {
        setArrivalProblem(result.error);
      }
    });
  }, [matched, request.arrived, request.id, withinRange, me, onArrived]);

  const now = useNow(5_000, !matched);
  const awayMs = request.arrived && awaySince !== null ? now - awaySince : 0;
  const awayTooLong = awayMs >= awayGraceMs;
  useEffect(() => {
    if (matched || !request.arrived || !awayTooLong || !me) return;
    if (Date.now() - lastAwayReport.current < arrivalRetryMs) return;
    lastAwayReport.current = Date.now();
    markPickupAway(request.id, me).then((result) => {
      if (mounted.current && result.ok && !result.data) onLeft();
    });
  }, [matched, request.arrived, request.id, awayTooLong, me, onLeft]);

  const waitingMs =
    request.arrived && request.arrivedAt
      ? now - request.arrivedAt.getTime()
      : 0;
  const noDriverYet = !matched && waitingMs >= noDriverMs;

  usePolling(async () => {
    const result = await loadPickupCompanionStatuses(request.id);
    if (result.ok) {
      setCompanions(
        result.data.filter((rider) => rider.inviteStatus === "accepted"),
      );
    }
  }, companionPollMs);

  usePolling(
    async () => {
      const result = await loadPickupDriver();
      if (result.ok) setDriver(result.data);
    },
    driverPollMs,
    matched,
  );

  useEffect(() => {
    if (!driverLocation) return;
    const last = lastRouted.current;
    const due =
      !last ||
      Date.now() - last.at >= rerouteMs ||
      getDistanceMeters(last.from, driverLocation) >= rerouteMeters;
    if (!due) return;
    lastRouted.current = { at: Date.now(), from: driverLocation };
    let active = true;
    const from: LatLng = [driverLocation.lat, driverLocation.lng];
    loadEtaRoute(from, [pickupPoint.lat, pickupPoint.lng]).then((result) => {
      if (active && result.ok) setEta(result.data);
    });
    return () => {
      active = false;
    };
  }, [driverLocation, pickupPoint]);

  const etaText = useMemo(() => {
    if (!driverLocation) return "Waiting for the driver's location";
    if (getDistanceMeters(driverLocation, pickupPoint) <= arrivingMeters)
      return "Arriving now";
    const seconds =
      eta?.durationSeconds ??
      estimateSeconds(driverLocation, pickupPoint, driverLocation.speedKmh);
    return formatEta(seconds);
  }, [driverLocation, pickupPoint, eta]);

  const mapState = useMemo<TransitMapState>(() => {
    const points: [number, number][] = [[pickupPoint.lat, pickupPoint.lng]];
    if (me) points.push([me.lat, me.lng]);
    if (driverLocation) points.push([driverLocation.lat, driverLocation.lng]);
    return {
      routeId: null,
      route: null,
      vehicles:
        driverLocation && driver
          ? [
              {
                id: "pickup-driver",
                lat: driverLocation.lat,
                lng: driverLocation.lng,
                type: driver.vehicleType,
              },
            ]
          : [],
      pickups: [{ id: "pickup-point", ...pickupPoint }],
      pickupLine: driverLocation
        ? (eta?.path ?? [
            [driverLocation.lat, driverLocation.lng],
            [pickupPoint.lat, pickupPoint.lng],
          ])
        : null,
      userLocation: me,
      focus:
        recenters > 0 && me
          ? { key: `me-${recenters}`, lat: me.lat, lng: me.lng, zoom: 17 }
          : null,
      fit: {
        key: `${request.id}:${me ? 1 : 0}:${driverLocation ? 1 : 0}`,
        points,
      },
      padTop: headerHeight + 30,
      padBottom: cardHeight + 30,
    };
  }, [
    request.id,
    pickupPoint,
    me,
    driver,
    driverLocation,
    eta,
    headerHeight,
    cardHeight,
    recenters,
  ]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {!matched || request.vehicle === "jeep" ? (
        <WaitingAreaDirectionsMap
          area={waitingArea}
          onLocationChange={handleLocation}
          onLocationError={setLocationError}
          locateTop={headerHeight + 12}
          padTop={headerHeight + 30}
          padBottom={cardHeight + 30}
        />
      ) : (
        <>
          <TransitMap state={mapState} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Center the map on your location"
            accessibilityState={{ disabled: !me }}
            disabled={!me}
            onPress={() => setRecenters((count) => count + 1)}
            style={({ pressed }) => [
              styles.locateButton,
              { top: headerHeight + 12 },
              pressed && styles.pressed,
            ]}
          >
            <LocateFixed
              color={palette.brand}
              size={20}
              strokeWidth={2.2}
              style={!me && styles.locateIdle}
            />
          </Pressable>
        </>
      )}

      <View
        style={styles.headerWrap}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <ModuleHeader
          title="Pickup"
          subtitle="Request a pickup from nearby vehicles and let drivers know you’re waiting."
          icon={<MapPin color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={onBack}
        />
      </View>

      <View
        style={[styles.card, { paddingBottom: insets.bottom + 18 }]}
        onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
      >
        {matched ? (
          <>
            <MatchedDetails driver={driver} etaText={etaText} />
            <CompanionAvatars companions={companions} />
          </>
        ) : (
          <>
            <View style={styles.waitingRow}>
              <View style={styles.infoIcon} accessibilityLabel="Pickup point">
                <MapPin color={panelNavy} size={16} strokeWidth={2.4} />
              </View>
              <Text style={styles.pickupName} numberOfLines={2}>
                {request.pickupName}
              </Text>
              <View style={styles.infoIcon} accessibilityLabel="Passengers">
                <Users color={panelNavy} size={16} strokeWidth={2.4} />
              </View>
              <Text style={styles.passengerCount}>{request.passengers}</Text>
              {request.arrived ? (
                <LoadingLogo
                  color={routeCyan}
                  size={24}
                  label="Waiting for a driver"
                />
              ) : (
                <Footprints color={routeCyan} size={22} strokeWidth={2.2} />
              )}
            </View>
            <ArrivalGuide
              arrived={request.arrived}
              located={!!me}
              locationError={locationError}
              distance={distance}
              withinRange={withinRange}
              awayMs={awayMs}
              waitingMs={waitingMs}
            />
            <CompanionAvatars companions={companions} />
            {noDriverYet && (
              <View style={styles.noDriver}>
                <Hourglass color="#92400e" size={16} strokeWidth={2.2} />
                <View style={styles.flex}>
                  <Text style={styles.noDriverTitle}>No driver yet</Text>
                  <Text style={styles.noDriverBody}>
                    Drivers nearby may be full or on another route. You can keep
                    waiting, or cancel and request a different vehicle.
                  </Text>
                </View>
              </View>
            )}
            {problem ? (
              <ErrorAlert title={problemSource} message={problem} />
            ) : (
              !!arrivalProblem &&
              withinRange && (
                <ErrorAlert title="Arrival" message={arrivalProblem} />
              )
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel pickup request"
              disabled={busy}
              onPress={() => setConfirmCancel(true)}
              style={({ pressed }) => [
                styles.cancelButton,
                (pressed || busy) && styles.pressed,
              ]}
            >
              <Text style={styles.cancelText}>
                {busy
                  ? "CANCELLING..."
                  : noDriverYet
                    ? "CANCEL AND TRY ANOTHER VEHICLE"
                    : "CANCEL REQUEST"}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <ConfirmModal
        visible={confirmCancel}
        title="Cancel this pickup request?"
        message="Your request will be withdrawn and drivers will no longer see it. You can request a new pickup afterwards."
        confirmLabel="Cancel request"
        cancelLabel="Keep request"
        destructive
        icon={<MapPinX color="#ffffff" size={22} strokeWidth={2.2} />}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          onCancel();
        }}
      />
    </View>
  );
}

function ArrivalGuide({
  arrived,
  located,
  locationError,
  distance,
  withinRange,
  awayMs,
  waitingMs,
}: {
  arrived: boolean;
  located: boolean;
  locationError: string | null;
  distance: number | null;
  withinRange: boolean;
  awayMs: number;
  waitingMs: number;
}) {
  const visible = arrived;
  const waitingMinutes = Math.floor(waitingMs / 60_000);
  const awayLeft = Math.max(0, Math.ceil((awayGraceMs - awayMs) / 60_000));
  const [title, body] = arrived
    ? awayMs > 0
      ? [
          "You moved away from the pickup point",
          `Head back within ${awayLeft} ${awayLeft === 1 ? "minute" : "minutes"}, or drivers will stop seeing your request until you return.`,
        ]
      : [
          "You’re at the pickup point",
          waitingMinutes > 0
            ? `Nearby drivers can see your request. You’ve been waiting ${waitingMinutes} ${waitingMinutes === 1 ? "minute" : "minutes"}. Stay here so your driver can find you.`
            : "Nearby drivers can now see your request. Stay here so your driver can find you.",
        ]
    : locationError
      ? [
          "Turn on your location",
          "We need it to confirm you’re at the pickup point. Drivers won’t see your request until then.",
        ]
      : !located
        ? [
            "Finding your location…",
            "Drivers will see your request once you’re at the pickup point.",
          ]
        : withinRange
          ? [
              "Confirming you’ve arrived…",
              "Hold on. We’re letting nearby drivers know you’re here.",
            ]
          : [
              "Head to the pickup point",
              `You’re ${formatDistance(distance ?? 0)} away. Follow the route on the map. Drivers will see your request once you get there.`,
            ];

  return (
    <View style={styles.guide}>
      <View
        style={[
          styles.guideBadge,
          visible ? styles.guideBadgeLive : styles.guideBadgeHidden,
        ]}
      >
        <RadioTower
          color={visible ? palette.success : "#92400e"}
          size={12}
          strokeWidth={2.4}
        />
        <Text
          style={[
            styles.guideBadgeText,
            { color: visible ? palette.success : "#92400e" },
          ]}
        >
          {visible ? "VISIBLE TO DRIVERS" : "NOT VISIBLE TO DRIVERS YET"}
        </Text>
      </View>
      <Text style={styles.guideTitle}>{title}</Text>
      <Text style={styles.guideBody}>{body}</Text>
      {!!locationError && !arrived && <LocationSettingsButton />}
    </View>
  );
}

function MatchedDetails({
  driver,
  etaText,
}: {
  driver: PickupDriver | null;
  etaText: string;
}) {
  return (
    <>
      <View style={styles.matchedTitleRow}>
        <BrandLogo size={34} color={routeCyan} />
        <Text style={styles.matchedTitle}>Matched with a Driver!</Text>
      </View>

      <View style={styles.etaRow}>
        <ClockFading color="#ffffff" size={20} strokeWidth={2.2} />
        <View>
          <Text style={styles.etaLabel}>ESTIMATED TIME OF ARRIVAL</Text>
          <Text style={styles.etaValue}>{etaText}</Text>
        </View>
      </View>

      {driver ? (
        <View style={styles.vehicleRow}>
          <VehicleIcon type={driver.vehicleType} color="#ffffff" size={30} />
          <View style={styles.plateBlock}>
            <Text style={styles.plate} numberOfLines={1}>
              {driver.plateNumber}
            </Text>
            <Text style={styles.vehicleText}>
              {vehicleTypeLabels[driver.vehicleType]}
            </Text>
          </View>
          <View style={styles.vehicleColumn}>
            <Text style={styles.vehicleText} numberOfLines={1}>
              Max Capacity: {driver.maxCapacity}
            </Text>
            <Text style={styles.vehicleText} numberOfLines={1}>
              Current Capacity: {driver.currentCapacity}
            </Text>
          </View>
          <View style={styles.vehicleColumn}>
            <Text style={styles.vehicleText} numberOfLines={1}>
              Occupancy Level: {driver.occupancy}
            </Text>
            <Text style={styles.vehicleText} numberOfLines={1}>
              Status: {driver.status}
            </Text>
          </View>
        </View>
      ) : (
        <LoadingLogo color={routeCyan} style={styles.vehicleLoading} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  locateButton: {
    position: "absolute",
    right: 12,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "rgba(168, 220, 247, 0.85)",
  },
  locateIdle: { opacity: 0.5 },
  screen: { flex: 1, backgroundColor: "#e8eaed" },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0 },
  pressed: { opacity: 0.75 },
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 20,
    paddingHorizontal: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: panelNavy,
  },
  waitingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: routeCyan,
  },
  pickupName: {
    flex: 1,
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 14,
  },
  passengerCount: {
    minWidth: 18,
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 16,
  },
  guide: { gap: 4, marginTop: 14 },
  flex: { flex: 1 },
  companionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  companionName: {
    flex: 1,
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 12,
  },
  companionStatus: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  companionStatusText: { fontFamily: "SoraBold", fontSize: 10 },
  noDriver: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fef3c7",
  },
  noDriverTitle: { color: "#92400e", fontFamily: "SoraBold", fontSize: 12 },
  noDriverBody: {
    color: "#78350f",
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
  },
  guideBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginBottom: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  guideBadgeLive: { backgroundColor: "#dcfce7" },
  guideBadgeHidden: { backgroundColor: "#fef3c7" },
  guideBadgeText: { fontFamily: "SoraBold", fontSize: 10 },
  guideTitle: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 13 },
  guideBody: {
    color: "#d6e2f5",
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
  },
  cancelButton: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: cancelRed,
  },
  cancelText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 14,
    letterSpacing: 1,
  },
  matchedTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  matchedTitle: { color: routeCyan, fontFamily: "SoraBold", fontSize: 18 },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  etaLabel: { color: "#ffffff", fontFamily: "Sora", fontSize: 10 },
  etaValue: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 12 },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },
  plateBlock: { maxWidth: 90 },
  plate: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 15 },
  vehicleColumn: { flex: 1, gap: 2 },
  vehicleText: { color: "#ffffff", fontFamily: "Sora", fontSize: 10 },
  vehicleLoading: { marginTop: 16, alignSelf: "flex-start" },
});
