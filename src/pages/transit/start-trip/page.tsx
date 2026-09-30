import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Check from "lucide-react-native/icons/check";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import MapPin from "lucide-react-native/icons/map-pin";
import Minus from "lucide-react-native/icons/minus";
import Plus from "lucide-react-native/icons/plus";
import Users from "lucide-react-native/icons/users";
import X from "lucide-react-native/icons/x";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  describeAssignment,
  loadOperatorAssignment,
  type AssignmentDetails,
} from "@/api/v1/operator/controllers";
import {
  getOccupancyLevel,
  loadRouteGeometry,
  pointAlong,
  type LatLng,
} from "@/api/v1/transit-routes/controllers";
import { ModuleHeader, vehicleOptions } from "@/components/module-ui";
import { TransitMap, type TransitMapState } from "@/components/transit-map";
import { Routes } from "@/constants/routes";

const panelNavy = "#1d3354";
const routeCyan = "#7fd4f7";
const counterBlue = "#7dd3f5";
const circleNavy = "#1034A6";

// Seconds the simulated vehicle takes to cover its route or area loop once.
const routeLoopSeconds = 300;
const areaLoopSeconds = 180;
const requestDelayMs = 10_000;
const pickupTravelMs = 6_000;
const toastMs = 4_000;
const requestSizes = [4, 2, 3, 1];

type ToastTone = "danger" | "success" | "info";

type Toast = {
  id: number;
  text: string;
  tone: ToastTone;
  side: "left" | "right";
  dismissible: boolean;
};

type Pickup = {
  id: number;
  passengers: number;
  position: LatLng;
  accepted: boolean;
};

function nextToast(
  text: string,
  tone: ToastTone,
  side: Toast["side"],
  dismissible = true,
) {
  return (current: Toast | null): Toast => ({
    id: (current?.id ?? 0) + 1,
    text,
    tone,
    side,
    dismissible,
  });
}

function areaLoop(center: LatLng, radiusMeters: number): LatLng[] {
  const [lat, lng] = center;
  const latRadius = (radiusMeters * 0.45) / 111_320;
  const lngRadius = latRadius / Math.cos((lat * Math.PI) / 180);
  return Array.from({ length: 25 }, (_, index) => {
    const angle = (index / 24) * Math.PI * 2;
    return [lat + latRadius * Math.sin(angle), lng + lngRadius * Math.cos(angle)];
  });
}

export default function TripScreen() {
  const [details, setDetails] = useState<AssignmentDetails | null>(null);

  useEffect(() => {
    let active = true;
    loadOperatorAssignment().then((assignment) => {
      if (active) setDetails(describeAssignment(assignment));
    });
    return () => {
      active = false;
    };
  }, []);

  if (!details) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={circleNavy} />
      </View>
    );
  }

  return <Trip details={details} />;
}

function Trip({ details }: { details: AssignmentDetails }) {
  const insets = useSafeAreaInsets();
  const { assignment, route, area, vehicleLabel, coverageTitle } = details;
  const { vehicle } = assignment;
  const capacity = vehicle.max_capacity;
  const loopSeconds = route ? routeLoopSeconds : areaLoopSeconds;
  const vehicleIcon = vehicleOptions.find(
    (option) => option.value === vehicle.vehicle_type,
  )?.icon;

  const [headerHeight, setHeaderHeight] = useState(140);
  const [panelHeight, setPanelHeight] = useState(240);
  const [routePath, setRoutePath] = useState<LatLng[] | null>(null);
  const [inTransit, setInTransit] = useState(false);
  const [progress, setProgress] = useState(0);
  const [count, setCount] = useState(0);
  const [markedFull, setMarkedFull] = useState(false);
  const [pickup, setPickup] = useState<Pickup | null>(null);
  const [requestNumber, setRequestNumber] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);

  const full = markedFull || count >= capacity;
  const path = useMemo(
    () =>
      route
        ? (routePath ?? route.waypoints)
        : area
          ? areaLoop(area.center, area.radiusMeters)
          : [],
    [route, routePath, area],
  );

  // Routes go back and forth along the line; areas loop around the circle.
  const fraction = route
    ? progress <= 1
      ? progress
      : 2 - progress
    : progress % 1;
  const position = useMemo<LatLng>(
    () =>
      path.length > 1 ? pointAlong(path, fraction) : (area?.center ?? [0, 0]),
    [path, fraction, area],
  );

  useEffect(() => {
    if (!route) return;
    let active = true;
    loadRouteGeometry(route).then((geometry) => {
      if (active) setRoutePath(geometry);
    });
    return () => {
      active = false;
    };
  }, [route]);

  useEffect(() => {
    if (!inTransit) return;
    const timer = setInterval(() => {
      setProgress((current) => (current + 1 / loopSeconds) % 2);
    }, 1000);
    return () => clearInterval(timer);
  }, [inTransit, loopSeconds]);

  // Simulate a commuter along the way requesting a pickup.
  useEffect(() => {
    if (!inTransit || pickup || full || path.length < 2) return;
    const timer = setTimeout(() => {
      const ahead = route
        ? Math.min(Math.max(fraction + (progress <= 1 ? 0.05 : -0.05), 0), 1)
        : (fraction + 0.08) % 1;
      setPickup({
        id: requestNumber,
        passengers: requestSizes[requestNumber % requestSizes.length],
        position: pointAlong(path, ahead),
        accepted: false,
      });
      setRequestNumber((current) => current + 1);
    }, requestDelayMs);
    return () => clearTimeout(timer);
    // Only reschedule when the trip or request state changes, not every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inTransit, pickup, full, path]);

  // After accepting, the driver reaches the commuter and picks them up.
  useEffect(() => {
    if (!pickup?.accepted) return;
    const timer = setTimeout(() => {
      setCount((current) => Math.min(current + pickup.passengers, capacity));
      setPickup(null);
      setToast(nextToast("Passenger Picked Up!", "success", "right"));
    }, pickupTravelMs);
    return () => clearTimeout(timer);
  }, [pickup, capacity]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toastMs);
    return () => clearTimeout(timer);
  }, [toast]);

  const leave = () => {
    if (inTransit) {
      setToast(nextToast("Stop the trip before leaving.", "danger", "left"));
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace(Routes.transitHome);
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!inTransit) return false;
        setToast(nextToast("Stop the trip before leaving.", "danger", "left"));
        return true;
      },
    );
    return () => subscription.remove();
  }, [inTransit]);

  const addPassenger = () => {
    if (count >= capacity) return;
    const next = count + 1;
    setCount(next);
    if (next >= capacity) setToast(nextToast("Vehicle is Full!", "danger", "left"));
  };

  const removePassenger = () => {
    if (count > 0) setCount(count - 1);
  };

  const start = () => {
    setInTransit(true);
    setToast(null);
  };

  const stop = () => {
    setInTransit(false);
    setProgress(0);
    setCount(0);
    setMarkedFull(false);
    setPickup(null);
    setToast(nextToast("Trip Ended!", "info", "left"));
  };

  const toggleFull = () => {
    if (count >= capacity) return;
    if (markedFull) {
      setMarkedFull(false);
      setToast(nextToast("Accepting Passengers Again", "info", "left"));
    } else {
      setMarkedFull(true);
      setToast(nextToast("Marked as Full!", "danger", "left"));
    }
  };

  const acceptPickup = () => {
    if (!pickup) return;
    setPickup({ ...pickup, accepted: true });
    setToast(nextToast("Pickup Accepted", "success", "right", false));
  };

  const rejectPickup = () => {
    setPickup(null);
    setToast(nextToast("Request Rejected!", "info", "left"));
  };

  const mapState = useMemo<TransitMapState>(
    () => ({
      routeId: route?.id ?? null,
      route: route ? routePath : null,
      area: area
        ? {
            id: area.id,
            lat: area.center[0],
            lng: area.center[1],
            radius: area.radiusMeters,
          }
        : null,
      vehicles: [
        {
          id: "my-vehicle",
          lat: position[0],
          lng: position[1],
          type: vehicle.vehicle_type,
        },
      ],
      terminals: [],
      highlightedTerminalId: null,
      selectedId: null,
      focus: null,
      pickups: pickup
        ? [{ id: `pickup-${pickup.id}`, lat: pickup.position[0], lng: pickup.position[1] }]
        : [],
      pickupLine: pickup?.accepted ? [position, pickup.position] : null,
      padTop: headerHeight + 30,
      padBottom: panelHeight + 30,
    }),
    [route, routePath, area, position, vehicle, pickup, headerHeight, panelHeight],
  );

  const occupancy = markedFull ? "Full" : getOccupancyLevel(count, capacity);
  const overlayBottom = panelHeight + 10;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <TransitMap state={mapState} onSelect={() => {}} />

      <View
        style={styles.headerWrap}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <ModuleHeader
          title="Trip"
          subtitle="View active vehicles, their locations and occupancy levels across your selected route."
          icon={<MapPin color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={leave}
        />
      </View>

      {pickup && !pickup.accepted && (
        <View style={[styles.requestCard, { bottom: overlayBottom }]}>
          <View>
            <Text style={styles.requestTitle}>Passengers</Text>
            <View style={styles.requestCount}>
              <Users color="#3b2a14" size={14} strokeWidth={2} />
              <Text style={styles.requestCountText}>{pickup.passengers}</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Accept pickup for ${pickup.passengers} passengers`}
            onPress={acceptPickup}
            style={({ pressed }) => [
              styles.requestButton,
              styles.requestAccept,
              pressed && styles.pressed,
            ]}
          >
            <Check color="#15803d" size={18} strokeWidth={2.5} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reject pickup request"
            onPress={rejectPickup}
            style={({ pressed }) => [
              styles.requestButton,
              styles.requestReject,
              pressed && styles.pressed,
            ]}
          >
            <X color="#dc2626" size={18} strokeWidth={2.5} />
          </Pressable>
        </View>
      )}

      {toast && (
        <View
          style={[
            styles.toast,
            toastTones[toast.tone].container,
            toast.side === "left" ? styles.toastLeft : styles.toastRight,
            { bottom: overlayBottom },
          ]}
        >
          <CircleAlert
            color={toastTones[toast.tone].color}
            size={13}
            strokeWidth={2.5}
          />
          <Text style={[styles.toastText, { color: toastTones[toast.tone].color }]}>
            {toast.text}
          </Text>
          {toast.dismissible && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss message"
              hitSlop={10}
              onPress={() => setToast(null)}
            >
              <X
                color={toastTones[toast.tone].color}
                size={13}
                strokeWidth={3}
              />
            </Pressable>
          )}
        </View>
      )}

      <View
        style={[styles.panel, { paddingBottom: insets.bottom + 16 }]}
        onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}
      >
        <Text style={styles.coverage} numberOfLines={1}>
          {coverageTitle.toUpperCase().replace(" – ", " - ")}
        </Text>

        <View style={styles.infoRow}>
          {vehicleIcon && (
            <View style={styles.vehicleIconBackdrop}>
              <Image
                source={vehicleIcon}
                style={styles.vehicleIcon}
                tintColor="#ffffff"
                contentFit="contain"
              />
            </View>
          )}
          <View style={styles.plateBlock}>
            <Text style={styles.plate} numberOfLines={1}>
              {vehicle.plate_number}
            </Text>
            <Text style={styles.infoText}>{vehicleLabel}</Text>
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoText}>Max Capacity: {capacity}</Text>
            <Text style={styles.infoText}>Current Capacity: {count}</Text>
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoText}>Occupancy Level: {occupancy}</Text>
            <Text style={styles.infoText}>
              Status: {inTransit ? "In Transit" : "Loading"}
            </Text>
          </View>
        </View>

        <View style={styles.controls}>
          <View style={styles.counter}>
            <CounterButton
              label="Remove a passenger"
              disabled={count === 0}
              onPress={removePassenger}
            >
              <Minus color="#ffffff" size={30} strokeWidth={3} />
            </CounterButton>
            <Text style={styles.count}>{count}</Text>
            <CounterButton
              label="Add a passenger"
              disabled={count >= capacity}
              onPress={addPassenger}
            >
              <Plus color="#ffffff" size={30} strokeWidth={3} />
            </CounterButton>
          </View>

          <View style={styles.actions}>
            {inTransit ? (
              <>
                <TripButton label="STOP" tone="stop" onPress={stop} />
                <TripButton
                  label="FULL"
                  tone={full ? "full" : "fullOff"}
                  onPress={toggleFull}
                />
              </>
            ) : (
              <TripButton label="START" tone="start" onPress={start} />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function CounterButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.circle,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const tripButtonTones = {
  start: { backgroundColor: "#a3f7a3", color: "#15803d" },
  stop: { backgroundColor: "#f87e7e", color: "#b91c1c" },
  full: { backgroundColor: "#fcc419", color: "#8a5300" },
  fullOff: { backgroundColor: "#d6d6d6", color: "#a1a1a1" },
};

function TripButton({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone: keyof typeof tripButtonTones;
  onPress: () => void;
}) {
  const colors = tripButtonTones[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tripButton,
        { backgroundColor: colors.backgroundColor },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.tripButtonText, { color: colors.color }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const toastTones = {
  danger: { container: { backgroundColor: "#b91c1c" }, color: "#ffffff" },
  success: { container: { backgroundColor: "#b5f5b5" }, color: "#166534" },
  info: { container: { backgroundColor: "#1e3a6e" }, color: "#ffffff" },
};

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  screen: { flex: 1, backgroundColor: "#e8eaed" },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0 },
  pressed: { opacity: 0.7 },
  requestCard: {
    position: "absolute",
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#fbb574",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  requestTitle: { color: "#3b2a14", fontFamily: "SoraBold", fontSize: 10 },
  requestCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
    marginLeft: 12,
  },
  requestCountText: { color: "#3b2a14", fontFamily: "SoraBold", fontSize: 10 },
  requestButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  requestAccept: { backgroundColor: "#86efac" },
  requestReject: { backgroundColor: "#fca5a5" },
  toast: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 6,
    elevation: 4,
  },
  toastLeft: { left: 12 },
  toastRight: { right: 12 },
  toastText: { fontFamily: "SoraBold", fontSize: 10 },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    paddingHorizontal: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: panelNavy,
  },
  coverage: {
    color: routeCyan,
    fontFamily: "SoraBold",
    fontSize: 12,
    marginLeft: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    marginHorizontal: 6,
  },
  vehicleIconBackdrop: {
    padding: 5,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  vehicleIcon: { width: 28, height: 28 },
  plateBlock: { maxWidth: 76 },
  plate: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 12 },
  infoColumn: { flex: 1 },
  infoText: {
    color: "#ffffff",
    fontFamily: "Sora",
    fontSize: 8,
    lineHeight: 12,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  counter: {
    flex: 1,
    height: 96,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    borderRadius: 18,
    backgroundColor: counterBlue,
  },
  circle: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29,
    backgroundColor: circleNavy,
  },
  count: {
    minWidth: 56,
    color: "#111111",
    fontFamily: "SoraBold",
    fontSize: 32,
    textAlign: "center",
  },
  actions: { width: 76, gap: 8, justifyContent: "center" },
  tripButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  tripButtonText: { fontFamily: "SoraBold", fontSize: 15 },
});
