import { StatusBar } from "expo-status-bar";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import BusFront from "lucide-react-native/icons/bus-front";
import Check from "lucide-react-native/icons/check";
import LocateFixed from "lucide-react-native/icons/locate-fixed";
import MapPin from "lucide-react-native/icons/map-pin";
import Minus from "lucide-react-native/icons/minus";
import Plus from "lucide-react-native/icons/plus";
import Users from "lucide-react-native/icons/users";
import X from "lucide-react-native/icons/x";
import type { LocationObject, LocationObjectCoords } from "expo-location";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeOutDown,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  acceptPickup,
  boardPickup,
  describeAssignment,
  endTrip,
  loadNearbyPickups,
  loadOperatorAssignment,
  saveTripState,
  queueTripState,
  startTrip,
  tripStatusLabels,
  type AssignmentDetails,
  type NearbyPickup,
  type TripStatus,
} from "@/api/v1/operator/controllers";
import {
  loadAlternativeGeometry,
  getOccupancyLevel,
  loadRouteGeometry,
  type LatLng,
} from "@/api/v1/transit-routes/controllers";
import {
  startLocationSharing,
  stopLocationSharing,
} from "@/api/v1/operator/location-sharing";
import {
  clearOutbox,
  sendLocation,
  usePendingSync,
} from "@/api/v1/operator/outbox";
import { watchLocation } from "@/api/v1/places/controllers";
import { EmptyState } from "@/components/empty-state";
import { LoadingLogo } from "@/components/LoadingLogo";
import { VehicleIcon } from "@/components/module-icons";
import { ModuleHeader, moduleColors } from "@/components/module-ui";
import { TransitMap, type TransitMapState } from "@/components/transit-map";
import { Routes } from "@/constants/routes";
import { useOnline } from "@/hooks/use-online";
import { getDistanceMeters, getPairDistanceMeters } from "@/utils/geo";
import { goBackOr } from "@/utils/navigation";

const panelNavy = "#1d3354";
const routeCyan = "#7fd4f7";
const counterBlue = "#7dd3f5";
const circleNavy = "#1034A6";
const modalBlue = "#d6ecf8";
const { brandBlue } = moduleColors;
const chipBlue = "#a8dcf7";
const locateBlue = "rgba(168, 220, 247, 0.85)";
const declineRed = "#b91c1c";
const maxPickupCards = 3;

const toastMs = 4_000;
const stationaryMs = 5_000;
const pingMs = 3_000;
const movedMeters = 15;
const movingSpeedMps = 1.5;
const myVehicleZoom = 16;
const pickupPollMs = 5_000;
const overlayLayout = LinearTransition.duration(220);
const overlayEnter = FadeInDown.duration(220);
const overlayExit = FadeOutDown.duration(180);
const boardMeters = 40;
const boardRetryMs = 3_000;

const pathLengthMeters = (path: LatLng[]) =>
  path
    .slice(1)
    .reduce(
      (total, point, index) =>
        total + getPairDistanceMeters(path[index], point),
      0,
    );

type ToastTone = "danger" | "success" | "info";

type Toast = {
  id: number;
  text: string;
  tone: ToastTone;
  dismissible: boolean;
};

function nextToast(text: string, tone: ToastTone, dismissible = true) {
  return (current: Toast | null): Toast => ({
    id: (current?.id ?? 0) + 1,
    text,
    tone,
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
        <LoadingLogo color={circleNavy} />
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

  const [headerHeight, setHeaderHeight] = useState(140);
  const [panelHeight, setPanelHeight] = useState(240);
  const [routePath, setRoutePath] = useState<LatLng[] | null>(null);
  const [alternativePaths, setAlternativePaths] = useState<LatLng[][]>([]);
  const [status, setStatus] = useState<TripStatus>("idle");
  const [starting, setStarting] = useState(false);
  const [backgroundSharing, setBackgroundSharing] = useState(false);
  const [fix, setFix] = useState<LocationObject | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [watchAttempt, setWatchAttempt] = useState(0);
  const [following, setFollowing] = useState(true);
  const [recenters, setRecenters] = useState(0);
  const [zoomAt, setZoomAt] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [markedFull, setMarkedFull] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [pickups, setPickups] = useState<NearbyPickup[]>([]);
  const [accepted, setAccepted] = useState<NearbyPickup[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const latestCoords = useRef<LocationObjectCoords | null>(null);
  const anchor = useRef<LocationObjectCoords | null>(null);
  const lastMovedAt = useRef(0);
  const savedState = useRef<string | null>(null);
  const shareFailing = useRef(false);
  const tripActive = useRef(false);
  const distanceDone = useRef(0);
  const seenPickups = useRef(new Set<string>());
  const passedPickups = useRef(new Set<string>());

  const onTrip = status !== "idle";
  const online = useOnline();
  const pendingSync = usePendingSync();
  const syncing = !online || pendingSync > 0;
  const full = markedFull || count >= capacity;
  const occupancy = markedFull ? "Full" : getOccupancyLevel(count, capacity);

  useEffect(() => {
    if (!route) return;
    let active = true;
    Promise.all([
      loadRouteGeometry(route),
      loadAlternativeGeometry(route),
    ]).then(([geometry, alternatives]) => {
      if (!active) return;
      setRoutePath(geometry);
      setAlternativePaths(alternatives);
    });
    return () => {
      active = false;
    };
  }, [route]);

  useEffect(() => {
    let active = true;
    let subscription: { remove: () => void } | null = null;
    watchLocation((location) => {
      const next = location.coords;
      latestCoords.current = next;
      const moved =
        !anchor.current ||
        (next.speed ?? 0) >= movingSpeedMps ||
        getDistanceMeters(
          { lat: anchor.current.latitude, lng: anchor.current.longitude },
          { lat: next.latitude, lng: next.longitude },
        ) >= movedMeters;
      if (moved) {
        if (anchor.current && tripActive.current) {
          distanceDone.current += getDistanceMeters(
            { lat: anchor.current.latitude, lng: anchor.current.longitude },
            { lat: next.latitude, lng: next.longitude },
          );
        }
        anchor.current = next;
        lastMovedAt.current = Date.now();
      }
      setFix(location);
      setZoomAt((current) => current ?? location.timestamp);
    }).then((result) => {
      if (!result.ok) {
        if (!active) return;
        setLocationError(result.error);
        setToast(nextToast(result.error, "danger"));
        return;
      }
      if (active) subscription = result.data;
      else result.data.remove();
    });
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [watchAttempt]);

  useEffect(() => {
    if (!onTrip || finalizing) return;
    const timer = setInterval(() => {
      const still = Date.now() - lastMovedAt.current >= stationaryMs;
      setStatus(still ? "loading" : "in-transit");
    }, 1000);
    return () => clearInterval(timer);
  }, [onTrip, finalizing]);

  useEffect(() => {
    if (!onTrip || backgroundSharing) return;
    let sending = false;
    const ping = async () => {
      if (sending || !latestCoords.current) return;
      sending = true;
      try {
        const result = await sendLocation(latestCoords.current);
        if (result.status !== "failed") {
          shareFailing.current = false;
        } else if (tripActive.current && !shareFailing.current) {
          shareFailing.current = true;
          setToast(nextToast("Couldn't share your location.", "danger"));
        }
      } finally {
        sending = false;
      }
    };
    ping();
    const timer = setInterval(ping, pingMs);
    return () => clearInterval(timer);
  }, [onTrip, backgroundSharing]);

  useEffect(() => {
    if (!onTrip) return;
    let loading = false;
    const poll = async () => {
      if (loading) return;
      loading = true;
      try {
        const result = await loadNearbyPickups();
        if (!result.ok || !tripActive.current) return;
        const nearby = new Set(result.data.map((pickup) => pickup.id));
        seenPickups.current.forEach((id) => {
          if (!nearby.has(id)) passedPickups.current.add(id);
        });
        const visible = result.data.filter(
          (pickup) => !passedPickups.current.has(pickup.id),
        );
        const fresh = visible.filter(
          (pickup) => !seenPickups.current.has(pickup.id),
        );
        visible.forEach((pickup) => seenPickups.current.add(pickup.id));
        setPickups(visible);
        if (fresh.length > 0) {
          const passengers = fresh.reduce(
            (total, pickup) => total + pickup.passengers,
            0,
          );
          setToast(
            nextToast(
              `Pickup request nearby: ${passengers} passenger${passengers === 1 ? "" : "s"}`,
              "success",
            ),
          );
        }
      } finally {
        loading = false;
      }
    };
    const timer = setInterval(poll, pickupPollMs);
    return () => clearInterval(timer);
  }, [onTrip]);

  const boardingAttempts = useRef(new Map<string, number>());
  useEffect(() => {
    if (!fix || accepted.length === 0) return;
    const here = { lat: fix.coords.latitude, lng: fix.coords.longitude };
    const now = Date.now();
    accepted.forEach((pickup) => {
      if (getDistanceMeters(here, pickup) > boardMeters) return;
      const lastTry = boardingAttempts.current.get(pickup.id);
      if (lastTry !== undefined && now - lastTry < boardRetryMs) return;
      boardingAttempts.current.set(pickup.id, now);
      boardPickup(pickup.id).then((result) => {
        if (!tripActive.current) return;
        if (!result.ok) {
          if (/no longer|another vehicle/i.test(result.error)) {
            boardingAttempts.current.delete(pickup.id);
            setAccepted((current) =>
              current.filter((item) => item.id !== pickup.id),
            );
          }
          return;
        }
        boardingAttempts.current.delete(pickup.id);
        const boarded = result.data;
        setAccepted((current) =>
          current.filter((item) => item.id !== pickup.id),
        );
        setCount((current) => Math.min(capacity, current + boarded));
        setToast(
          nextToast(
            `${boarded} passenger${boarded === 1 ? "" : "s"} boarded`,
            "success",
          ),
        );
      });
    });
  }, [fix, accepted, capacity]);

  useEffect(() => {
    if (starting || finalizing) return;
    const key = `${status}:${count}:${markedFull}`;
    if (key === savedState.current) return;
    savedState.current = key;
    queueTripState(status, count, markedFull).then((result) => {
      if (result.status === "failed")
        setToast(
          nextToast(`Couldn't update your trip: ${result.error}`, "danger"),
        );
    });
  }, [starting, finalizing, status, count, markedFull]);

  useEffect(
    () => () => {
      stopLocationSharing();
      if (tripActive.current) endTrip(distanceDone.current);
      else if (!savedState.current?.startsWith("idle:"))
        saveTripState("idle", 0);
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toastMs);
    return () => clearTimeout(timer);
  }, [toast]);

  const leave = () => {
    if (onTrip) {
      setToast(nextToast("Stop the trip before leaving.", "danger"));
      return;
    }
    goBackOr(Routes.transitHome);
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!onTrip) return false;
        setToast(nextToast("Stop the trip before leaving.", "danger"));
        return true;
      },
    );
    return () => subscription.remove();
  }, [onTrip]);

  const addPassenger = () => {
    if (!onTrip || markedFull || count >= capacity) return;
    const next = count + 1;
    setCount(next);
    if (next >= capacity) setToast(nextToast("Vehicle is Full!", "danger"));
  };

  const removePassenger = () => {
    if (onTrip && !markedFull && count > 0) setCount(count - 1);
  };

  const start = async () => {
    if (starting) return;
    if (locationError) {
      setToast(nextToast("Allow location access to start a trip.", "danger"));
      return;
    }
    setStarting(true);
    setToast(null);
    const path = routePath ?? route?.waypoints ?? [];
    const result = await startTrip(pathLengthMeters(path));
    setStarting(false);
    if (!result.ok) {
      setToast(nextToast(result.error || "Couldn't start the trip.", "danger"));
      return;
    }
    clearOutbox();
    savedState.current = "in-transit:0:false";
    lastMovedAt.current = Date.now();
    shareFailing.current = false;
    tripActive.current = true;
    distanceDone.current = 0;
    boardingAttempts.current.clear();
    seenPickups.current = new Set();
    passedPickups.current = new Set();
    setAccepted([]);
    setCount(0);
    setMarkedFull(false);
    setStatus("in-transit");
    const sharing = await startLocationSharing();
    if (!tripActive.current) return;
    setBackgroundSharing(sharing.mode === "background");
    if (sharing.backgroundDenied)
      setToast(
        nextToast(
          "Allow location access all the time to keep sharing while the app is in the background.",
          "info",
        ),
      );
  };

  const finalizeTrip = async () => {
    if (finalizing) return;
    setFinalizing(true);
    const result = await endTrip(distanceDone.current);
    setFinalizing(false);
    setConfirmingStop(false);
    if (!result.ok) {
      setToast(nextToast("Couldn't finalize the trip. Try again.", "danger"));
      return;
    }
    tripActive.current = false;
    boardingAttempts.current.clear();
    clearOutbox();
    stopLocationSharing();
    setBackgroundSharing(false);
    setPickups([]);
    setAccepted([]);
    setStatus("idle");
    setCount(0);
    setMarkedFull(false);
    setToast(nextToast("Trip Ended!", "info"));
  };

  const reserved = accepted.reduce(
    (total, pickup) => total + pickup.passengers,
    0,
  );
  const seatsLeft = markedFull ? 0 : capacity - count - reserved;

  const declineRequest = (pickup: NearbyPickup) => {
    passedPickups.current.add(pickup.id);
    setPickups((current) => current.filter((item) => item.id !== pickup.id));
  };

  const acceptRequest = async (pickup: NearbyPickup) => {
    if (acceptingId) return;
    if (pickup.passengers > seatsLeft) {
      setToast(
        nextToast(
          markedFull
            ? "You marked the vehicle as full, so you can't accept new passengers."
            : `This request needs ${pickup.passengers} ${pickup.passengers === 1 ? "seat" : "seats"}, but only ${Math.max(seatsLeft, 0)} ${seatsLeft === 1 ? "is" : "are"} left.`,
          "danger",
        ),
      );
      return;
    }
    setAcceptingId(pickup.id);
    const result = await acceptPickup(pickup.id);
    setAcceptingId(null);
    declineRequest(pickup);
    if (!result.ok) {
      setToast(nextToast(result.error, "danger"));
      return;
    }
    if (!tripActive.current) return;
    const waiting = result.data;
    setAccepted((current) => [...current, pickup]);
    setToast(
      nextToast(
        `Accepted ${waiting} passenger${waiting === 1 ? "" : "s"}. Head to the pickup point.`,
        "success",
      ),
    );
  };

  const toggleFull = () => {
    if (count >= capacity) {
      setMarkedFull(true);
      setToast(
        nextToast(
          "The vehicle is already full. You can't mark it as not full.",
          "danger",
        ),
      );
      return;
    }
    if (markedFull) {
      setMarkedFull(false);
      setToast(nextToast("Accepting Passengers Again", "info"));
    } else {
      setMarkedFull(true);
      setToast(nextToast("Marked as Full!", "danger"));
    }
  };

  const locate = () => {
    if (locationError) {
      setLocationError(null);
      setToast(null);
      setWatchAttempt((attempt) => attempt + 1);
    }
    setFollowing(true);
    setRecenters((count) => count + 1);
    setZoomAt(fix?.timestamp ?? null);
  };

  const coords = fix?.coords ?? null;
  const mapState = useMemo<TransitMapState>(
    () => ({
      routeId: route?.id ?? null,
      route: route ? routePath : null,
      alternativeRoutes: alternativePaths,
      vehicles: coords
        ? [
            {
              id: "my-vehicle",
              lat: coords.latitude,
              lng: coords.longitude,
              type: vehicle.vehicle_type,
              occupancy,
              isFull: full,
            },
          ]
        : [],
      focus:
        following && fix
          ? {
              key: `${recenters}:${fix.timestamp}`,
              lat: fix.coords.latitude,
              lng: fix.coords.longitude,
              zoom: fix.timestamp === zoomAt ? myVehicleZoom : undefined,
            }
          : null,
      pickups: [...pickups, ...accepted].map(
        ({ id, lat, lng, passengers }) => ({
          id,
          lat,
          lng,
          passengers,
        }),
      ),
      padTop: headerHeight + 30,
      padBottom: panelHeight + 30,
    }),
    [
      pickups,
      accepted,
      route,
      routePath,
      alternativePaths,
      coords,
      fix,
      following,
      recenters,
      zoomAt,
      vehicle,
      occupancy,
      full,
      headerHeight,
      panelHeight,
    ],
  );

  const overlayBottom = panelHeight + 10;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <TransitMap state={mapState} onDrag={() => setFollowing(false)} />

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

      <View
        pointerEvents="box-none"
        style={[styles.overlayStack, { bottom: overlayBottom }]}
      >
        {toast && (
          <Animated.View
            key={toast.id}
            entering={overlayEnter}
            exiting={overlayExit}
            layout={overlayLayout}
            style={[styles.toast, toastTones[toast.tone].container]}
          >
            <CircleAlert
              color={toastTones[toast.tone].color}
              size={12}
              strokeWidth={2.5}
            />
            <Text
              style={[
                styles.toastText,
                { color: toastTones[toast.tone].color },
              ]}
              numberOfLines={2}
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
                  size={12}
                  strokeWidth={3}
                />
              </Pressable>
            )}
          </Animated.View>
        )}
        {pickups.slice(0, maxPickupCards).map((pickup) => (
          <Animated.View
            key={pickup.id}
            entering={overlayEnter}
            exiting={overlayExit}
            layout={overlayLayout}
          >
            <PickupCard
              pickup={pickup}
              distanceMeters={
                coords
                  ? getDistanceMeters(
                      { lat: coords.latitude, lng: coords.longitude },
                      pickup,
                    )
                  : pickup.distanceMeters
              }
              fits={pickup.passengers <= seatsLeft}
              busy={acceptingId === pickup.id}
              onAccept={() => acceptRequest(pickup)}
              onDecline={() => declineRequest(pickup)}
            />
          </Animated.View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Center the map on your location"
        accessibilityState={{ selected: following }}
        onPress={locate}
        style={({ pressed }) => [
          styles.locateButton,
          { top: headerHeight + 12 },
          pressed && styles.pressed,
        ]}
      >
        <LocateFixed
          color={brandBlue}
          size={20}
          strokeWidth={2.2}
          style={!following && styles.locateIdle}
        />
      </Pressable>

      <View
        style={[styles.panel, { paddingBottom: insets.bottom + 16 }]}
        onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}
      >
        <View style={styles.coverageRow}>
          <Text style={styles.coverage} numberOfLines={1}>
            {coverageTitle.toUpperCase().replace(" – ", " - ")}
          </Text>
          <View
            style={[
              styles.sharing,
              onTrip && styles.sharingOn,
              onTrip && syncing && styles.sharingPending,
            ]}
          >
            <View
              style={[
                styles.sharingDot,
                onTrip && styles.sharingDotOn,
                onTrip && syncing && styles.sharingDotPending,
              ]}
            />
            <Text style={styles.sharingText}>
              {!onTrip
                ? "Location Not Shared"
                : !online
                  ? "Offline · Will Sync"
                  : pendingSync > 0
                    ? "Syncing..."
                    : "Location Shared"}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.vehicleIconBackdrop}>
            <VehicleIcon
              type={vehicle.vehicle_type}
              color="#ffffff"
              size={28}
            />
          </View>
          <View style={styles.plateBlock}>
            <Text style={styles.plate} numberOfLines={1}>
              {vehicle.plate_number}
            </Text>
            <Text style={styles.infoLabel}>{vehicleLabel}</Text>
          </View>
          <View style={styles.stats}>
            <View style={styles.statsRow}>
              <Stat label="Max Capacity" value={capacity} />
              <Stat label="Occupancy Level" value={occupancy} />
            </View>
            <View style={styles.statsRow}>
              <Stat label="Current Capacity" value={count} />
              <Stat label="Status" value={tripStatusLabels[status]} />
            </View>
          </View>
        </View>

        <View style={styles.controls}>
          <View style={styles.counter}>
            <CounterButton
              label="Remove a passenger"
              disabled={!onTrip || markedFull || count === 0}
              onPress={removePassenger}
            >
              <Minus color="#ffffff" size={30} strokeWidth={3} />
            </CounterButton>
            <Text style={styles.count}>{count}</Text>
            <CounterButton
              label="Add a passenger"
              disabled={!onTrip || markedFull || count >= capacity}
              onPress={addPassenger}
            >
              <Plus color="#ffffff" size={30} strokeWidth={3} />
            </CounterButton>
          </View>

          <View style={styles.actions}>
            {onTrip ? (
              <>
                <TripButton
                  label="STOP"
                  tone="stop"
                  onPress={() => setConfirmingStop(true)}
                />
                <TripButton
                  label="FULL"
                  tone={full ? "full" : "fullOff"}
                  onPress={toggleFull}
                />
              </>
            ) : (
              <TripButton
                label="START"
                tone="start"
                disabled={starting}
                onPress={start}
              />
            )}
          </View>
        </View>
      </View>

      <FinalizeTripModal
        visible={confirmingStop}
        busy={finalizing}
        onCancel={() => setConfirmingStop(false)}
        onConfirm={finalizeTrip}
      />
    </View>
  );
}

function PickupCard({
  pickup,
  distanceMeters,
  fits,
  busy,
  onAccept,
  onDecline,
}: {
  pickup: NearbyPickup;
  distanceMeters: number;
  fits: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const label = `${pickup.passengers} ${pickup.passengers === 1 ? "Passenger" : "Passengers"}`;
  return (
    <View
      style={styles.pickupCard}
      accessibilityLabel={`Pickup request, ${label}`}
    >
      <View style={styles.pickupIcon}>
        <Users color={brandBlue} size={15} strokeWidth={2.4} />
      </View>
      <View>
        <Text style={styles.pickupTitle}>{label}</Text>
        <Text style={[styles.pickupMeta, !fits && styles.pickupWarn]}>
          {fits ? `${Math.round(distanceMeters)} m away` : "Not enough seats"}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decline pickup request"
        disabled={busy}
        hitSlop={4}
        onPress={onDecline}
        style={({ pressed }) => [
          styles.pickupButton,
          styles.pickupDecline,
          pressed && styles.pressed,
        ]}
      >
        <X color={declineRed} size={15} strokeWidth={3} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Accept pickup request"
        accessibilityState={{ disabled: !fits, busy }}
        disabled={busy}
        hitSlop={4}
        onPress={onAccept}
        style={({ pressed }) => [
          styles.pickupButton,
          styles.pickupAccept,
          !fits && styles.pickupAcceptBlocked,
          pressed && styles.pressed,
        ]}
      >
        {busy ? (
          <LoadingLogo color="#ffffff" size={18} />
        ) : (
          <Check color="#ffffff" size={15} strokeWidth={3} />
        )}
      </Pressable>
    </View>
  );
}

function FinalizeTripModal({
  visible,
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={busy ? undefined : onCancel}
    >
      <View style={styles.modalRoot}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Finalize Trip?</Text>
          </View>
          <View style={styles.modalBody}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              disabled={busy}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.modalButton,
                styles.modalCancel,
                (pressed || busy) && styles.pressed,
              ]}
            >
              <Text style={[styles.modalButtonText, styles.modalCancelText]}>
                CANCEL
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm and finalize the trip"
              accessibilityState={{ busy }}
              disabled={busy}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.modalButton,
                styles.modalConfirm,
                pressed && styles.pressed,
              ]}
            >
              {busy ? (
                <LoadingLogo color="#ffffff" size={22} />
              ) : (
                <Text style={[styles.modalButtonText, styles.modalConfirmText]}>
                  CONFIRM
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.infoLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
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
  disabled = false,
  onPress,
}: {
  label: string;
  tone: keyof typeof tripButtonTones;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = tripButtonTones[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tripButton,
        { backgroundColor: colors.backgroundColor },
        (pressed || disabled) && styles.pressed,
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
  overlayStack: {
    position: "absolute",
    left: 12,
    right: 12,
    alignItems: "flex-end",
    gap: 6,
  },
  locateButton: {
    position: "absolute",
    right: 12,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: locateBlue,
  },
  locateIdle: { opacity: 0.5 },
  pickupCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 5,
    paddingLeft: 6,
    borderRadius: 10,
    backgroundColor: chipBlue,
    elevation: 3,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  pickupIcon: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "#ffffff",
  },
  pickupTitle: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 11,
    lineHeight: 14,
  },
  pickupMeta: {
    color: panelNavy,
    fontFamily: "Sora",
    fontSize: 9,
    lineHeight: 12,
  },
  pickupWarn: { color: declineRed, fontFamily: "SoraBold" },
  pickupButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
  },
  pickupDecline: { backgroundColor: "#ffffff" },
  pickupAccept: { backgroundColor: brandBlue },
  pickupAcceptBlocked: { backgroundColor: "#9aa5c4" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "100%",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    elevation: 4,
  },
  toastText: {
    flexShrink: 1,
    fontFamily: "SoraBold",
    fontSize: 10,
    lineHeight: 13,
  },
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
  coverageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 6,
  },
  coverage: {
    flex: 1,
    color: routeCyan,
    fontFamily: "SoraBold",
    fontSize: 12,
  },
  sharing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  sharingOn: { backgroundColor: "rgba(74, 222, 128, 0.22)" },
  sharingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#9ca3af",
  },
  sharingDotOn: { backgroundColor: "#4ade80" },
  sharingPending: { backgroundColor: "rgba(251, 191, 36, 0.25)" },
  sharingDotPending: { backgroundColor: "#fbbf24" },
  sharingText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 8 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    marginHorizontal: 6,
  },
  vehicleIconBackdrop: {
    padding: 5,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  plateBlock: { width: 76, gap: 2 },
  plate: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 12 },
  stats: {
    flex: 1,
    gap: 8,
    paddingLeft: 10,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(255, 255, 255, 0.3)",
  },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, gap: 1 },
  infoLabel: {
    color: "rgba(255, 255, 255, 0.65)",
    fontFamily: "Sora",
    fontSize: 8,
    lineHeight: 11,
  },
  infoValue: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 10,
    lineHeight: 14,
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
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  modalCard: {
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: modalBlue,
  },
  modalHeader: {
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: circleNavy,
  },
  modalTitle: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 15 },
  modalBody: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  modalButton: {
    flex: 1,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  modalCancel: {
    borderWidth: 1.5,
    borderColor: circleNavy,
    backgroundColor: "#ffffff",
  },
  modalConfirm: { backgroundColor: circleNavy },
  modalButtonText: { fontFamily: "SoraBold", fontSize: 14 },
  modalCancelText: { color: circleNavy },
  modalConfirmText: { color: "#ffffff" },
});
