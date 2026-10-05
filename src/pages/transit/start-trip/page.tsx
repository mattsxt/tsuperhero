import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import BusFront from "lucide-react-native/icons/bus-front";
import MapPin from "lucide-react-native/icons/map-pin";
import Minus from "lucide-react-native/icons/minus";
import Plus from "lucide-react-native/icons/plus";
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
import { EmptyState } from "@/components/empty-state";
import { ModuleHeader, vehicleOptions } from "@/components/module-ui";
import { TransitMap, type TransitMapState } from "@/components/transit-map";
import { Routes } from "@/constants/routes";
import { goBackOr } from "@/utils/navigation";

const panelNavy = "#1d3354";
const routeCyan = "#7fd4f7";
const counterBlue = "#7dd3f5";
const circleNavy = "#1034A6";

const routeLoopSeconds = 300;
const toastMs = 4_000;

type ToastTone = "danger" | "success" | "info";

type Toast = {
  id: number;
  text: string;
  tone: ToastTone;
  side: "left" | "right";
  dismissible: boolean;
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

export default function TripScreen() {
  const [details, setDetails] = useState<AssignmentDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadOperatorAssignment().then((assignment) => {
      if (!active) return;
      setDetails(assignment ? describeAssignment(assignment) : null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={circleNavy} />
      </View>
    );
  }

  if (!details) {
    return (
      <View style={styles.emptyScreen}>
        <StatusBar style="light" />
        <ModuleHeader
          title="Trip"
          subtitle="Start a trip and track your passengers along your route."
          icon={<MapPin color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={() => goBackOr(Routes.transitHome)}
        />
        <EmptyState
          icon={<BusFront color={circleNavy} size={32} strokeWidth={1.8} />}
          message="You can start a trip once your transport cooperative assigns you a vehicle and a route."
          style={styles.emptyBody}
        />
      </View>
    );
  }

  return <Trip details={details} />;
}

function Trip({ details }: { details: AssignmentDetails }) {
  const insets = useSafeAreaInsets();
  const { assignment, route, vehicleLabel, coverageTitle } = details;
  const { vehicle } = assignment;
  const capacity = vehicle.max_capacity;
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
  const [toast, setToast] = useState<Toast | null>(null);

  const full = markedFull || count >= capacity;
  const path = useMemo(
    () => (route ? (routePath ?? route.waypoints) : []),
    [route, routePath],
  );
  const fraction = progress <= 1 ? progress : 2 - progress;
  const position = useMemo<LatLng | null>(
    () => (path.length > 1 ? pointAlong(path, fraction) : null),
    [path, fraction],
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
      setProgress((current) => (current + 1 / routeLoopSeconds) % 2);
    }, 1000);
    return () => clearInterval(timer);
  }, [inTransit]);

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
    goBackOr(Routes.transitHome);
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
    if (next >= capacity)
      setToast(nextToast("Vehicle is Full!", "danger", "left"));
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

  const mapState = useMemo<TransitMapState>(
    () => ({
      routeId: route?.id ?? null,
      route: route ? routePath : null,
      vehicles: position
        ? [
            {
              id: "my-vehicle",
              lat: position[0],
              lng: position[1],
              type: vehicle.vehicle_type,
            },
          ]
        : [],
      focus: null,
      padTop: headerHeight + 30,
      padBottom: panelHeight + 30,
    }),
    [
      route,
      routePath,
      position,
      vehicle,
      headerHeight,
      panelHeight,
    ],
  );

  const occupancy = markedFull ? "Full" : getOccupancyLevel(count, capacity);
  const overlayBottom = panelHeight + 10;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <TransitMap state={mapState} />

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
          <Text
            style={[styles.toastText, { color: toastTones[toast.tone].color }]}
          >
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
  emptyScreen: { flex: 1, backgroundColor: "#ffffff" },
  emptyBody: { marginTop: 32 },
  screen: { flex: 1, backgroundColor: "#e8eaed" },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0 },
  pressed: { opacity: 0.7 },
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
