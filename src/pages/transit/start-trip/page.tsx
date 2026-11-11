import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import RouteIcon from "lucide-react-native/icons/route";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import BusFront from "lucide-react-native/icons/bus-front";
import Check from "lucide-react-native/icons/check";
import LocateFixed from "lucide-react-native/icons/locate-fixed";
import MapPin from "lucide-react-native/icons/map-pin";
import Minus from "lucide-react-native/icons/minus";
import Plus from "lucide-react-native/icons/plus";
import Users from "lucide-react-native/icons/users";
import X from "lucide-react-native/icons/x";
import type { LocationObject, LocationObjectCoords } from "expo-location";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  FadeOutDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  acceptPickup,
  boardPickup,
  describeAssignment,
  endTrip,
  loadMyTrips,
  type TripRecord,
  loadNearbyPickups,
  loadVehicleRiders,
  type VehicleRider,
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
  hasPendingTripEnd,
  sendLocation,
} from "@/api/v1/operator/outbox";
import {
  addTripPoint,
  clearTripPassengers,
  saveTripPassengers,
  savedTripPassengers,
  resumeTripDistance,
  startTripDistance,
  stopTripDistance,
  tripDistanceMeters,
} from "@/api/v1/operator/trip-distance";
import { ConfirmModal } from "@/components/confirm-modal";
import { watchLocation } from "@/api/v1/places/controllers";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { LoadingLogo } from "@/components/LoadingLogo";
import { ModuleHeader, moduleColors } from "@/components/module-ui";
import { TransitMap, type TransitMapState } from "@/components/transit-map";
import { occupancyPinColors } from "@/components/transit-map-types";
import { Routes } from "@/constants/routes";
import {
  getDistanceMeters,
  getPairDistanceMeters,
  shouldRefreshPosition,
  type TimedPosition,
} from "@/utils/geo";
import { goBackOr } from "@/utils/navigation";
import { palette } from "@/constants/colors";
import { useOnline } from "@/hooks/use-online";
import {
  loadRentalRequests,
  rentalCooldownMs,
  rentalWindow,
  type Rental,
} from "@/api/v1/rentals/controllers";
import { useNow } from "@/hooks/use-now";
import { usePolling } from "@/hooks/use-polling";

const endedToast = (status: "sent" | "queued") =>
  nextToast(
    status === "queued"
      ? "Trip ended. It will save when you're back online."
      : "Trip Ended!",
    "info",
  );

const clock = (date: Date) =>
  date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const panelNavy = palette.navy;
const circleNavy = palette.header;
const modalBlue = "#d6ecf8";
const { brandBlue } = moduleColors;
const chipBlue = "#a8dcf7";
const declineRed = palette.danger;
const maxPickupCards = 3;
const stackPeek = 10;
const stackInset = 12;

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

type ToastTone = "danger" | "success" | "info" | "error";

type Toast = {
  id: number;
  text: string;
  tone: ToastTone;
  dismissible: boolean;
  title?: string;
};

function nextError(title: string, text: string) {
  return (current: Toast | null): Toast => ({
    id: (current?.id ?? 0) + 1,
    text,
    tone: "error",
    dismissible: true,
    title,
  });
}

function nextToast(text: string, tone: ToastTone, dismissible = true) {
  return (current: Toast | null): Toast => ({
    id: (current?.id ?? 0) + 1,
    text,
    tone,
    dismissible,
  });
}

export default function TripScreen() {
  const params = useLocalSearchParams<{ resume?: string }>();
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

  return <Trip details={details} resumeRequested={params.resume === "1"} />;
}

function Trip({
  details,
  resumeRequested,
}: {
  details: AssignmentDetails;
  resumeRequested: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { assignment, route } = details;
  const { vehicle } = assignment;
  const capacity = vehicle.max_capacity;
  const reduceMotion = useReducedMotion();
  const sharingPulse = useSharedValue(1);

  const headerHeight = insets.top + 60;
  const [panelHeight, setPanelHeight] = useState(240);
  const [screenHeight, setScreenHeight] = useState(0);
  const [panelTop, setPanelTop] = useState(0);
  const [routePath, setRoutePath] = useState<LatLng[] | null>(null);
  const [alternativePaths, setAlternativePaths] = useState<LatLng[][]>([]);
  const [status, setStatus] = useState<TripStatus>("idle");
  const [starting, setStarting] = useState(false);
  const [rentalJobs, setRentalJobs] = useState<Rental[]>([]);
  usePolling(async () => {
    const result = await loadRentalRequests();
    if (result.ok) setRentalJobs(result.data);
  }, 60_000);
  const now = useNow(30_000);
  const cooldown = rentalWindow(rentalJobs, now);
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
  const shownPosition = useRef<TimedPosition | null>(null);
  const anchor = useRef<LocationObjectCoords | null>(null);
  const lastMovedAt = useRef(0);
  const savedState = useRef<string | null>("idle:0:false");
  const shareFailing = useRef(false);
  const tripActive = useRef(false);
  const seenPickups = useRef(new Set<string>());
  const knownRiders = useRef(new Map<string, VehicleRider>());
  const [riders, setRiders] = useState<VehicleRider[]>([]);
  const [unfinished, setUnfinished] = useState<TripRecord | null>(null);
  const passedPickups = useRef(new Set<string>());

  const onTrip = status !== "idle";
  const online = useOnline();
  const syncWaiting = !online;
  const full = markedFull || count >= capacity;
  const occupancy = markedFull ? "Full" : getOccupancyLevel(count, capacity);

  useEffect(() => {
    if (!onTrip || reduceMotion) {
      cancelAnimation(sharingPulse);
      sharingPulse.set(1);
      return;
    }

    sharingPulse.set(0.45);
    sharingPulse.set(
      withRepeat(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(sharingPulse);
  }, [onTrip, reduceMotion, sharingPulse]);

  const sharingPulseStyle = useAnimatedStyle(() => ({
    opacity: sharingPulse.get(),
    transform: [{ scale: 0.85 + sharingPulse.get() * 0.15 }],
  }));

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
        anchor.current = next;
        if (tripActive.current)
          addTripPoint(next.latitude, next.longitude, next.accuracy);
        lastMovedAt.current = Date.now();
      }
      const position = {
        lat: next.latitude,
        lng: next.longitude,
        at: location.timestamp,
      };
      if (!shouldRefreshPosition(shownPosition.current, position)) return;
      shownPosition.current = position;
      setFix(location);
      setZoomAt((current) => current ?? location.timestamp);
    }).then((result) => {
      if (!result.ok) {
        if (!active) return;
        setLocationError(result.error);
        setToast(nextError("Location", result.error));
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

  const resumeTrip = useCallback(async () => {
    setUnfinished(null);
    tripActive.current = true;
    resumeTripDistance();
    const saved = savedTripPassengers();
    const server = saved ? null : await loadOperatorAssignment();
    const restoredCount = Math.min(
      capacity,
      Math.max(0, saved?.count ?? server?.vehicle.current_capacity ?? 0),
    );
    const restoredFull = saved?.full ?? server?.vehicle.is_full ?? false;
    savedState.current = null;
    saveTripPassengers({ count: restoredCount, full: restoredFull });
    setCount(restoredCount);
    setMarkedFull(restoredFull);
    lastMovedAt.current = Date.now();
    setStatus("in-transit");
    const sharing = await startLocationSharing();
    if (!tripActive.current) return;
    setBackgroundSharing(sharing.mode === "background");
    setToast(nextToast("Trip resumed.", "info"));
  }, [capacity]);

  useEffect(() => {
    let active = true;
    loadMyTrips().then((result) => {
      if (!active || !result.ok || tripActive.current) return;
      const running = result.data.find((trip) => trip.inProgress) ?? null;
      if (running && resumeRequested) void resumeTrip();
      else setUnfinished(running);
    });
    return () => {
      active = false;
    };
  }, [resumeRequested, resumeTrip]);

  const endUnfinishedTrip = async () => {
    if (finalizing) return;
    setFinalizing(true);
    const result = await endTrip(tripDistanceMeters());
    setFinalizing(false);
    if (result.status === "failed") {
      setToast(nextError("End trip", result.error));
      return;
    }
    setUnfinished(null);
    stopTripDistance();
    clearTripPassengers();
    stopLocationSharing();
    setToast(endedToast(result.status));
  };

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
          setToast(
            nextError("Location sharing", "Couldn't share your location."),
          );
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

  useEffect(() => {
    if (!onTrip) return;
    let loading = false;
    const poll = async () => {
      if (loading) return;
      loading = true;
      try {
        const result = await loadVehicleRiders();
        if (!result.ok || !tripActive.current) return;
        const next = new Map(result.data.map((rider) => [rider.id, rider]));
        const droppedOff = [...knownRiders.current.values()].filter(
          (rider) => !next.has(rider.id),
        );
        knownRiders.current = next;
        setRiders(result.data);
        const dropped = droppedOff.reduce(
          (total, rider) => total + rider.passengers,
          0,
        );
        if (dropped > 0) {
          setCount((current) => Math.max(0, current - dropped));
          setToast(
            nextToast(
              `${dropped} passenger${dropped === 1 ? "" : "s"} dropped off at ${droppedOff[0].dropoffName}`,
              "info",
            ),
          );
        }
      } finally {
        loading = false;
      }
    };
    poll();
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
    if (status === "idle" || !tripActive.current) return;
    saveTripPassengers({ count, full: markedFull });
  }, [status, count, markedFull]);

  useEffect(() => {
    if (starting || finalizing) return;
    const key = `${status}:${count}:${markedFull}`;
    if (key === savedState.current) return;
    savedState.current = key;
    queueTripState(status, count, markedFull).then((result) => {
      if (result.status === "failed")
        setToast(
          nextError(
            "Trip status",
            `Couldn't update your trip: ${result.error}`,
          ),
        );
    });
  }, [starting, finalizing, status, count, markedFull]);

  useEffect(
    () => () => {
      if (tripActive.current) return;
      stopLocationSharing();
      if (!savedState.current?.startsWith("idle:")) saveTripState("idle", 0);
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
      setToast(nextError("Trip in progress", "Stop the trip before leaving."));
      return;
    }
    goBackOr(Routes.transitHome);
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!onTrip) return false;
        setToast(
          nextError("Trip in progress", "Stop the trip before leaving."),
        );
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
    if (hasPendingTripEnd()) {
      setToast(
        nextError(
          "Start trip",
          "Your last trip is still saving. Connect to the internet to finish it, then start again.",
        ),
      );
      return;
    }
    if (cooldown) {
      setToast(
        nextError(
          "Rental pickup",
          `You have a rental pickup at ${clock(cooldown.at)}. Trips can't start from ${clock(new Date(cooldown.at.getTime() - rentalCooldownMs))} to ${clock(new Date(cooldown.at.getTime() + rentalCooldownMs))}.`,
        ),
      );
      return;
    }
    if (locationError) {
      setToast(nextError("Location", "Allow location access to start a trip."));
      return;
    }
    setStarting(true);
    setToast(null);
    const path = routePath ?? route?.waypoints ?? [];
    const result = await startTrip(pathLengthMeters(path));
    setStarting(false);
    if (!result.ok) {
      setToast(
        nextError("Start trip", result.error || "Couldn't start the trip."),
      );
      return;
    }
    clearOutbox();
    savedState.current = "in-transit:0:false";
    lastMovedAt.current = new Date().getTime();
    shareFailing.current = false;
    tripActive.current = true;
    startTripDistance();
    clearTripPassengers();
    boardingAttempts.current.clear();
    seenPickups.current = new Set();
    knownRiders.current = new Map();
    setRiders([]);
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
    const result = await endTrip(tripDistanceMeters());
    setFinalizing(false);
    setConfirmingStop(false);
    if (result.status === "failed") {
      setToast(nextError("End trip", result.error));
      return;
    }
    tripActive.current = false;
    stopTripDistance();
    clearTripPassengers();
    boardingAttempts.current.clear();
    stopLocationSharing();
    setBackgroundSharing(false);
    setPickups([]);
    knownRiders.current = new Map();
    setRiders([]);
    setAccepted([]);
    setStatus("idle");
    setCount(0);
    setMarkedFull(false);
    setToast(endedToast(result.status));
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
        nextError(
          "Pickup request",
          markedFull
            ? "You marked the vehicle as full, so you can't accept new passengers."
            : `This request needs ${pickup.passengers} ${pickup.passengers === 1 ? "seat" : "seats"}, but only ${Math.max(seatsLeft, 0)} ${seatsLeft === 1 ? "is" : "are"} left.`,
        ),
      );
      return;
    }
    setAcceptingId(pickup.id);
    const result = await acceptPickup(pickup.id);
    setAcceptingId(null);
    declineRequest(pickup);
    if (!result.ok) {
      setToast(nextError("Pickup request", result.error));
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
        nextError(
          "Vehicle full",
          "The vehicle is already full. You can't mark it as not full.",
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
  const sortedPickups = useMemo(
    () =>
      pickups
        .map((pickup) => ({
          pickup,
          meters: coords
            ? getDistanceMeters(
                { lat: coords.latitude, lng: coords.longitude },
                pickup,
              )
            : pickup.distanceMeters,
        }))
        .sort((a, b) => a.meters - b.meters),
    [pickups, coords],
  );
  const frontPickup = sortedPickups[0] ?? null;
  const behindCount = Math.min(sortedPickups.length, maxPickupCards) - 1;
  const mapPickups = useMemo(
    () => [
      ...[...pickups, ...accepted].map(({ id, lat, lng, passengers }) => ({
        id,
        lat,
        lng,
        passengers,
      })),
      ...riders.flatMap((rider) =>
        rider.dropoff
          ? [
              {
                id: `dropoff-${rider.id}`,
                lat: rider.dropoff.lat,
                lng: rider.dropoff.lng,
                badge: "B",
                label: rider.dropoffName,
              },
            ]
          : [],
      ),
    ],
    [pickups, accepted, riders],
  );
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
      pickups: mapPickups,
      padTop: headerHeight + 30,
      padBottom: panelHeight + 30,
    }),
    [
      mapPickups,
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

  const overlayBottom =
    Math.max(
      panelHeight,
      screenHeight && panelTop ? screenHeight - panelTop : 0,
    ) + 10;

  return (
    <View
      style={styles.screen}
      onLayout={(event) => setScreenHeight(event.nativeEvent.layout.height)}
    >
      <StatusBar style="dark" />
      <TransitMap state={mapState} onDrag={() => setFollowing(false)} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
        onPress={leave}
        style={({ pressed }) => [
          styles.mapBack,
          { top: insets.top + 12 },
          pressed && styles.pressed,
        ]}
      >
        <ArrowLeft color={brandBlue} size={24} strokeWidth={2.5} />
      </Pressable>

      <View
        pointerEvents="box-none"
        style={[styles.overlayStack, { bottom: overlayBottom }]}
      >
        {toast?.tone === "error" && (
          <Animated.View
            key={toast.id}
            entering={overlayEnter}
            exiting={overlayExit}
            layout={overlayLayout}
            style={styles.errorToast}
          >
            <ErrorAlert title={toast.title ?? "Trip"} message={toast.text} />
          </Animated.View>
        )}
        {toast && toast.tone !== "error" && (
          <Animated.View
            key={toast.id}
            entering={overlayEnter}
            exiting={overlayExit}
            layout={overlayLayout}
            style={[styles.toast, toastTones[toast.tone].container]}
          >
            <CircleAlert
              color={toastTones[toast.tone].color}
              size={22}
              strokeWidth={2.4}
            />
            <Text
              style={[
                styles.toastText,
                { color: toastTones[toast.tone].color },
              ]}
              numberOfLines={3}
            >
              {toast.text}
            </Text>
            {toast.dismissible && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss message"
                hitSlop={12}
                onPress={() => setToast(null)}
              >
                <X
                  color={toastTones[toast.tone].color}
                  size={20}
                  strokeWidth={2.6}
                />
              </Pressable>
            )}
          </Animated.View>
        )}
        {frontPickup && (
          <Animated.View
            layout={overlayLayout}
            entering={overlayEnter}
            exiting={overlayExit}
            style={{ paddingTop: stackPeek * behindCount }}
          >
            {Array.from({ length: behindCount }, (_, index) => (
              <View
                key={index}
                pointerEvents="none"
                style={[
                  styles.stackGhost,
                  {
                    top: stackPeek * (behindCount - 1 - index),
                    left: stackInset * (index + 1),
                    right: stackInset * (index + 1),
                    opacity: index === 0 ? 0.85 : 0.6,
                    elevation: 4 - index,
                  },
                ]}
              />
            ))}
            <Animated.View
              key={frontPickup.pickup.id}
              entering={overlayEnter}
              exiting={overlayExit}
            >
              <PickupCard
                pickup={frontPickup.pickup}
                distanceMeters={frontPickup.meters}
                queued={sortedPickups.length - 1}
                fits={frontPickup.pickup.passengers <= seatsLeft}
                busy={acceptingId === frontPickup.pickup.id}
                onAccept={() => acceptRequest(frontPickup.pickup)}
                onDecline={() => declineRequest(frontPickup.pickup)}
              />
            </Animated.View>
          </Animated.View>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Center the map on your location"
        accessibilityState={{ selected: following }}
        onPress={locate}
        style={({ pressed }) => [
          styles.locateButton,
          { top: insets.top + 12 },
          !!locationError && styles.locateError,
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
        onLayout={(event) => {
          setPanelHeight(event.nativeEvent.layout.height);
          setPanelTop(event.nativeEvent.layout.y);
        }}
      >
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusChip,
              onTrip && styles.statusChipOn,
              onTrip && syncWaiting && styles.statusChipOffline,
            ]}
          >
            <Animated.View
              style={[
                styles.sharingDot,
                onTrip && styles.sharingDotOn,
                onTrip && sharingPulseStyle,
              ]}
            />
            <Text style={styles.statusChipText} numberOfLines={1}>
              {!onTrip
                ? "Idle · location not shared"
                : syncWaiting
                  ? `${tripStatusLabels[status]} · offline, will sync`
                  : `${tripStatusLabels[status]} · sharing location`}
            </Text>
          </View>
          <View
            style={[
              styles.occupancyChip,
              { backgroundColor: occupancyPinColors[occupancy] },
            ]}
          >
            <Text style={styles.occupancyText}>{occupancy}</Text>
          </View>
        </View>

        <View style={styles.counterCard}>
          <Text style={styles.counterLabel}>
            {onTrip ? "PASSENGERS ON BOARD" : "START A TRIP TO COUNT PASSENGERS"}
          </Text>
          <View style={styles.counterRow}>
            <CounterButton
              variant="minus"
              label="Remove a passenger"
              disabled={!onTrip || markedFull || count === 0}
              onPress={removePassenger}
            >
              <Minus color="#ffffff" size={36} strokeWidth={3} />
            </CounterButton>
            <View
              style={styles.countBlock}
              accessibilityLabel={`${count} of ${capacity} passengers`}
            >
              <Text style={styles.count}>{count}</Text>
              <Text style={styles.countMax}>of {capacity}</Text>
            </View>
            <CounterButton
              variant="plus"
              label="Add a passenger"
              disabled={!onTrip || markedFull || count >= capacity}
              onPress={addPassenger}
            >
              <Plus color="#ffffff" size={36} strokeWidth={3} />
            </CounterButton>
          </View>
          <View style={styles.seatTrack}>
            <View
              style={[
                styles.seatFill,
                {
                  width: `${Math.min(100, Math.round((count / Math.max(1, capacity)) * 100))}%`,
                  backgroundColor: occupancyPinColors[occupancy],
                },
              ]}
            />
          </View>
          <Text style={styles.seatsLeft}>
            {markedFull
              ? "Marked full · not taking passengers"
              : `${Math.max(0, seatsLeft)} ${seatsLeft === 1 ? "seat" : "seats"} left${reserved ? ` · ${reserved} reserved for pickups` : ""}`}
          </Text>
        </View>


        {!onTrip && cooldown && (
          <View style={styles.cooldown}>
            <CircleAlert color="#92400e" size={16} strokeWidth={2.4} />
            <Text style={styles.cooldownText}>
              Rental pickup at {clock(cooldown.at)} to{" "}
              {cooldown.rental.destination}. Regular trips are paused from{" "}
              {clock(new Date(cooldown.at.getTime() - rentalCooldownMs))} to{" "}
              {clock(new Date(cooldown.at.getTime() + rentalCooldownMs))}.
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          {onTrip ? (
            <>
              <TripButton
                label={markedFull ? "FULL ✓" : "MARK FULL"}
                tone={full ? "full" : "fullOff"}
                onPress={toggleFull}
                style={styles.fullButton}
              />
              <TripButton
                label="END TRIP"
                tone="stop"
                onPress={() => setConfirmingStop(true)}
                style={styles.endButton}
              />
            </>
          ) : (
            <TripButton
              label={starting ? "STARTING…" : "START TRIP"}
              tone="start"
              disabled={starting || !!cooldown}
              onPress={start}
              style={styles.endButton}
            />
          )}
        </View>
      </View>

      <ConfirmModal
        visible={!!unfinished}
        title="Unfinished trip"
        message={
          unfinished
            ? `Your trip${unfinished.routeName ? ` on ${unfinished.routeName}` : ""}${unfinished.departedAt ? ` from ${clock(unfinished.departedAt)}` : ""} is still running because the app closed. Resume it to keep sharing your location, or end it to save it to your trip history.`
            : ""
        }
        confirmLabel="Resume trip"
        cancelLabel={finalizing ? "Ending..." : "End trip"}
        icon={<RouteIcon color="#ffffff" size={22} strokeWidth={2.2} />}
        onConfirm={resumeTrip}
        onCancel={endUnfinishedTrip}
      />
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
  queued,
  fits,
  busy,
  onAccept,
  onDecline,
}: {
  pickup: NearbyPickup;
  distanceMeters: number;
  queued: number;
  fits: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const title = `${pickup.passengers} waiting nearby`;
  const distance =
    distanceMeters < 1000
      ? `${Math.max(10, Math.round(distanceMeters / 10) * 10)} m away`
      : `${(distanceMeters / 1000).toFixed(1)} km away`;
  return (
    <View
      style={styles.pickupCard}
      accessibilityLabel={`${title}, ${distance}${queued ? `, ${queued} more requests` : ""}`}
    >
      <View style={styles.pickupInfo}>
        <View style={styles.pickupIcon}>
          <Users color={brandBlue} size={22} strokeWidth={2.4} />
          <Text style={styles.pickupCount}>{pickup.passengers}</Text>
        </View>
        <View style={styles.pickupText}>
          <Text style={styles.pickupTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.pickupMeta}>{distance}</Text>
          {!fits && (
            <Text style={[styles.pickupMeta, styles.pickupWarn]}>
              Not enough seats
            </Text>
          )}
        </View>
        {queued > 0 && (
          <View style={styles.queueBadge}>
            <Text style={styles.queueText}>+{queued} more</Text>
          </View>
        )}
      </View>
      <View style={styles.pickupActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip this passenger"
          disabled={busy}
          onPress={onDecline}
          style={({ pressed }) => [
            styles.pickupButton,
            styles.pickupDecline,
            pressed && styles.pressed,
          ]}
        >
          <X color="#475569" size={22} strokeWidth={3} />
          <Text style={[styles.pickupButtonText, styles.pickupDeclineText]}>
            SKIP
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick up this passenger"
          accessibilityState={{ disabled: !fits, busy }}
          disabled={busy}
          onPress={onAccept}
          style={({ pressed }) => [
            styles.pickupButton,
            styles.pickupAccept,
            !fits && styles.pickupAcceptBlocked,
            pressed && styles.pressed,
          ]}
        >
          {busy ? (
            <LoadingLogo color="#ffffff" size={24} />
          ) : (
            <>
              <Check color="#ffffff" size={24} strokeWidth={3} />
              <Text style={[styles.pickupButtonText, { color: "#ffffff" }]}>
                PICK UP
              </Text>
            </>
          )}
        </Pressable>
      </View>
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
            <Text style={styles.modalTitle}>End this trip?</Text>
          </View>
          <Text style={styles.modalMessage}>
            You’ll stop sharing your location. Riders still on board will be
            marked as dropped off.
          </Text>
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
                KEEP DRIVING
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
                  END TRIP
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CounterButton({
  variant,
  label,
  disabled,
  onPress,
  children,
}: {
  variant: "plus" | "minus";
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
      hitSlop={6}
      style={({ pressed }) => [
        styles.circle,
        variant === "plus" ? styles.circlePlus : styles.circleMinus,
        disabled && styles.circleDisabled,
        pressed && styles.pressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

const tripButtonTones = {
  start: { backgroundColor: "#22c55e", color: "#ffffff" },
  stop: { backgroundColor: palette.danger, color: "#ffffff" },
  full: { backgroundColor: "#fcc419", color: "#5c3b00" },
  fullOff: { backgroundColor: "rgba(255, 255, 255, 0.14)", color: "#ffffff" },
};

function TripButton({
  label,
  tone,
  disabled = false,
  onPress,
  style,
}: {
  label: string;
  tone: keyof typeof tripButtonTones;
  disabled?: boolean;
  onPress: () => void;
  style?: object;
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
        style,
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
  danger: { container: { backgroundColor: palette.danger }, color: "#ffffff" },
  error: { container: {}, color: palette.danger },
  success: {
    container: { backgroundColor: "#b5f5b5" },
    color: palette.success,
  },
  info: { container: { backgroundColor: "#1e3a6e" }, color: "#ffffff" },
};

const styles = StyleSheet.create({
  cooldown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#fef3c7",
  },
  cooldownText: {
    flex: 1,
    color: "#78350f",
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
  },
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
  mapBack: {
    position: "absolute",
    left: 12,
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
  pressed: { opacity: 0.7 },
  overlayStack: {
    position: "absolute",
    zIndex: 1,
    elevation: 6,
    left: 12,
    right: 12,
    alignItems: "stretch",
    gap: 8,
  },
  locateButton: {
    position: "absolute",
    right: 12,
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
  locateIdle: { opacity: 0.5 },
  pickupCard: {
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    elevation: 6,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pickupInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  stackGhost: {
    position: "absolute",
    bottom: 0,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  queueBadge: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#fef3c7",
  },
  queueText: { color: "#92400e", fontFamily: "SoraBold", fontSize: 12 },
  pickupIcon: {
    width: 52,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRadius: 14,
    backgroundColor: chipBlue,
  },
  pickupCount: { color: brandBlue, fontFamily: "SoraBold", fontSize: 18 },
  pickupText: { flex: 1 },
  pickupTitle: {
    color: "#111827",
    fontFamily: "SoraBold",
    fontSize: 18,
    lineHeight: 24,
  },
  pickupMeta: {
    color: "#334155",
    fontFamily: "Sora",
    fontSize: 15,
    lineHeight: 21,
  },
  pickupWarn: { color: declineRed, fontFamily: "SoraBold" },
  pickupActions: { flexDirection: "row", gap: 10 },
  pickupButton: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
  },
  pickupButtonText: { fontFamily: "SoraBold", fontSize: 16, letterSpacing: 0.6 },
  pickupDecline: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  pickupDeclineText: { color: "#475569" },
  pickupAccept: { flex: 2, backgroundColor: "#16a34a" },
  pickupAcceptBlocked: { backgroundColor: "#94a3b8" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    elevation: 6,
  },
  errorToast: { alignSelf: "stretch", elevation: 4 },
  locateError: { borderWidth: 1.5, borderColor: palette.danger },
  toastText: {
    flex: 1,
    fontFamily: "SoraBold",
    fontSize: 15,
    lineHeight: 20,
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: panelNavy,
    zIndex: 3,
    elevation: 16,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusChip: {
    flex: 1,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  statusChipOn: { backgroundColor: "rgba(74, 222, 128, 0.22)" },
  statusChipOffline: { backgroundColor: palette.warning },
  statusChipText: {
    flexShrink: 1,
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 12,
  },
  sharingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9ca3af",
  },
  sharingDotOn: { backgroundColor: "#4ade80" },
  occupancyChip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  occupancyText: { color: "#1f2937", fontFamily: "SoraBold", fontSize: 12 },
  counterCard: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  counterLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    fontFamily: "SoraBold",
    fontSize: 11,
    letterSpacing: 0.8,
    textAlign: "center",
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  circle: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 38,
  },
  circlePlus: {
    backgroundColor: "#22c55e",
    elevation: 4,
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  circleMinus: { borderWidth: 2.5, borderColor: "rgba(255, 255, 255, 0.6)" },
  circleDisabled: { opacity: 0.35, elevation: 0 },
  countBlock: { alignItems: "center" },
  count: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 56,
    lineHeight: 62,
    includeFontPadding: false,
  },
  countMax: {
    color: "rgba(255, 255, 255, 0.7)",
    fontFamily: "SoraBold",
    fontSize: 14,
  },
  seatTrack: {
    height: 10,
    marginTop: 12,
    overflow: "hidden",
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  seatFill: { height: 10, borderRadius: 5 },
  seatsLeft: {
    marginTop: 6,
    color: "#ffffff",
    fontFamily: "Sora",
    fontSize: 13,
    textAlign: "center",
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  tripButton: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  fullButton: { flex: 1 },
  endButton: { flex: 2 },
  tripButtonText: { fontFamily: "SoraBold", fontSize: 16, letterSpacing: 0.6 },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  modalCard: {
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: modalBlue,
  },
  modalHeader: {
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: circleNavy,
  },
  modalTitle: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 18 },
  modalMessage: {
    paddingTop: 14,
    paddingHorizontal: 20,
    color: "#1f2937",
    fontFamily: "Sora",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  modalBody: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  modalButton: {
    flex: 1,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  modalCancel: {
    borderWidth: 1.5,
    borderColor: circleNavy,
    backgroundColor: "#ffffff",
  },
  modalConfirm: { backgroundColor: circleNavy },
  modalButtonText: { fontFamily: "SoraBold", fontSize: 16 },
  modalCancelText: { color: circleNavy },
  modalConfirmText: { color: "#ffffff" },
});
