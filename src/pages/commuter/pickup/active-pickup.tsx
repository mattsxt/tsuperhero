import { StatusBar } from "expo-status-bar";
import ClockFading from "lucide-react-native/icons/clock-fading";
import MapPin from "lucide-react-native/icons/map-pin";
import Users from "lucide-react-native/icons/users";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  formatEta,
  loadPickupDriver,
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
<<<<<<< HEAD
=======
import type { WaitingArea } from "@/api/v1/waiting-areas/controllers";

import { PickupAlert } from "./pickup-alert";
import {
  waitingAreaArrivalMeters,
  WaitingAreaDirectionsMap,
} from "./waiting-area-directions-map";
>>>>>>> origin/mapbox

const panelNavy = "#1d3354";
const routeCyan = "#7fd4f7";
const cancelRed = "#e5383b";

const driverPollMs = 3_000;
const rerouteMeters = 40;
const rerouteMs = 30_000;
const arrivingMeters = 30;
const roadFactor = 1.3;
const fallbackKmh = 15;

type Coordinates = { lat: number; lng: number };

function estimateSeconds(from: Coordinates, to: Coordinates, speedKmh: number) {
  const meters = getDistanceMeters(from, to) * roadFactor;
  return meters / (Math.max(speedKmh, fallbackKmh) / 3.6);
}

export function ActivePickup({
  request,
  busy,
  problem,
<<<<<<< HEAD
=======
  problemSource,
>>>>>>> origin/mapbox
  onCancel,
  onBack,
}: {
  request: PickupRequest;
  busy: boolean;
  problem: string;
<<<<<<< HEAD
=======
  problemSource: string;
>>>>>>> origin/mapbox
  onCancel: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(140);
  const [cardHeight, setCardHeight] = useState(200);
  const [me, setMe] = useState<Coordinates | null>(null);
  const [driver, setDriver] = useState<PickupDriver | null>(null);
  const [eta, setEta] = useState<EtaRoute | null>(null);
  const lastRouted = useRef<{ at: number; from: Coordinates } | null>(null);

  const matched = request.status === "accepted";
  const pickupPoint = useMemo(
    () => ({ lat: request.lat, lng: request.lng }),
    [request.lat, request.lng],
  );
  const driverLocation = matched ? (driver?.location ?? null) : null;
<<<<<<< HEAD

  useEffect(() => {
=======
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
    [request.id, request.pickupName, request.waitingAreaType, request.lat, request.lng],
  );

  useEffect(() => {
    if (request.vehicle === "jeep") return;
>>>>>>> origin/mapbox
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
<<<<<<< HEAD
  }, []);
=======
  }, [request.vehicle]);
>>>>>>> origin/mapbox

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
      focus: null,
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
  ]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
<<<<<<< HEAD
      <TransitMap state={mapState} />
=======
      {request.vehicle === "jeep" ? (
        <WaitingAreaDirectionsMap
          area={waitingArea}
          onLocationChange={setMe}
          padTop={headerHeight + 30}
          padBottom={cardHeight + 30}
        />
      ) : (
        <TransitMap state={mapState} />
      )}
>>>>>>> origin/mapbox

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
          <MatchedDetails driver={driver} etaText={etaText} />
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
              <LoadingLogo
                color={routeCyan}
                size={24}
                label="Waiting for a driver"
              />
            </View>
<<<<<<< HEAD
            {!!problem && <Text style={styles.problem}>{problem}</Text>}
=======
            {request.vehicle === "jeep" && (
              <Text style={styles.waitingAreaMessage}>
                {!me
                  ? `Your pickup is at ${request.pickupName}. Enable location to confirm you’re at the waiting area.`
                  : getDistanceMeters(me, pickupPoint) <= waitingAreaArrivalMeters
                    ? `You’re at ${request.pickupName}. Stay here for your driver.`
                    : `Please go to ${request.pickupName} and stay there so your driver can find you.`}
              </Text>
            )}
            {!!problem && (
              <PickupAlert
                source={problemSource}
                message={problem}
                compact
              />
            )}
>>>>>>> origin/mapbox
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel pickup request"
              disabled={busy}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.cancelButton,
                (pressed || busy) && styles.pressed,
              ]}
            >
              <Text style={styles.cancelText}>
                {busy ? "CANCELLING..." : "CANCEL REQUEST"}
              </Text>
            </Pressable>
          </>
        )}
      </View>
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
<<<<<<< HEAD
  problem: {
    color: "#fca5a5",
    fontFamily: "Sora",
    fontSize: 10,
    marginTop: 12,
    textAlign: "center",
=======
  waitingAreaMessage: {
    color: "#ffffff",
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 12,
>>>>>>> origin/mapbox
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
  etaLabel: { color: "#ffffff", fontFamily: "Sora", fontSize: 7 },
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
  vehicleText: { color: "#ffffff", fontFamily: "Sora", fontSize: 8 },
  vehicleLoading: { marginTop: 16, alignSelf: "flex-start" },
});
