import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Eye from "lucide-react-native/icons/eye";
import MapPin from "lucide-react-native/icons/map-pin";
import MapPinned from "lucide-react-native/icons/map-pinned";
import PersonStanding from "lucide-react-native/icons/person-standing";
import Search from "lucide-react-native/icons/search";
import UserRound from "lucide-react-native/icons/user-round";
import Users from "lucide-react-native/icons/users";
import UsersRound from "lucide-react-native/icons/users-round";
import X from "lucide-react-native/icons/x";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  cancelPickup,
  getKnownActivePickup,
  loadActivePickup,
  getKnownSharedRide,
  leaveSharedRide,
  loadMyPickupDraft,
  loadMySharedRide,
  loadPickupCompanionStatuses,
  loadRequestStatus,
  maxRidersFor,
  pickupVehicleCapacity,
  pickupVehicleNames,
  minPickupPassengers,
  queuePickupCancellation,
  removePickupCompanion,
  requestPickup,
  savePickupDraft,
  sendPickupCompanionInvite,
  type PickupRequest,
  type PickupVehicle,
  type Rider,
  type SharedRide,
} from "@/api/v1/pickups/controllers";
import {
  type Place,
  blockedLocationMessage,
  getLocationPermission,
  requestLocationPermission,
  type LocationPermission,
} from "@/api/v1/places/controllers";
import {
  findNearestRoute,
  getTransitRoutes,
  loadTransitRoutes,
  type TransitRoute,
} from "@/api/v1/transit-routes/controllers";
import {
  findNearestWaitingArea,
  findWaitingAreasOnRoute,
  getKnownWaitingAreas,
  loadWaitingAreas,
  type WaitingArea,
  type WaitingAreaRecommendation,
  type WaitingAreaType,
} from "@/api/v1/waiting-areas/controllers";
import {
  activeRentalOf,
  loadMyRentals,
  type Rental,
} from "@/api/v1/rentals/controllers";
import { ConnectionRequired } from "@/components/connection-required";
import { LocationSettingsButton } from "@/components/location-settings-button";
import { LoadingLogo } from "@/components/LoadingLogo";
import {
  ModuleButton,
  moduleColors,
  ModuleHeader,
  PassengerStepper,
  SectionTitle,
  VehiclePicker,
} from "@/components/module-ui";
import { PlaceSearchField } from "@/components/place-search-field";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { checkOnline, useOnline } from "@/hooks/use-online";
import { usePolling } from "@/hooks/use-polling";
import { getDistanceMeters } from "@/utils/geo";
import { goBackOr } from "@/utils/navigation";

import { ErrorAlert, ErrorMark, ErrorOutline } from "@/components/error-alert";
import { ActivePickup } from "./active-pickup";
import { BoardedScreen } from "./boarded-screen";
import { PinLocationPicker } from "./pin-location-picker";
import { ShareRideField } from "./share-ride-field";
import { LocationPrimer } from "./location-primer";
import { RentalInProgress } from "./rental-in-progress";
import { SharedRideScreen } from "./shared-ride";
import { WaitingAreaDirectionsMap } from "./waiting-area-directions-map";

const { brandBlue, softBlue, mutedText, text, error } = moduleColors;

function formatDistance(meters: number) {
  return meters < 1000
    ? `${Math.round(meters / 10) * 10} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

function pickupProblemSource(message: string) {
  if (/waiting area|route/i.test(message)) return "Waiting area";
  if (/location|pin/i.test(message)) return "Pickup location";
  if (/passenger/i.test(message)) return "Passenger count";
  if (/rider|commuter|shared ride/i.test(message)) return "Share a ride";
  if (/offline|internet|reconnect/i.test(message)) return "Connection";
  return "Pickup request";
}

export default function PickupScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const [active, setActive] = useState<PickupRequest | null>(
    getKnownActivePickup,
  );
  const [routes, setRoutes] = useState<TransitRoute[]>(getTransitRoutes);
  const [routesLoaded, setRoutesLoaded] = useState(
    () => getTransitRoutes().length > 0,
  );
  const [waitingAreas, setWaitingAreas] =
    useState<WaitingArea[]>(getKnownWaitingAreas);
  const [waitingAreasLoaded, setWaitingAreasLoaded] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [priorityWaitingAreaId, setPriorityWaitingAreaId] = useState<
    string | null
  >(null);
  const [vehicle, setVehicle] = useState<PickupVehicle>("jeep");
  const [useWaitingArea, setUseWaitingArea] = useState(true);
  const [riders, setRiders] = useState<Rider[]>([]);
  const ridersRef = useRef<Rider[]>([]);
  const [draftRequestId, setDraftRequestId] = useState<string | null>(null);
  const [sharedRide, setSharedRide] = useState<SharedRide | null>(
    getKnownSharedRide,
  );
  const [sharedRideLoaded, setSharedRideLoaded] = useState(false);
  const [activeRental, setActiveRental] = useState<Rental | null>(null);
  const savedLocationKey = useRef<string | null>(null);
  const online = useOnline();
  const [passengers, setPassengers] = useState(1);
  const [problem, setProblem] = useState("");
  const [problemSource, setProblemSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [companionOperations, setCompanionOperations] = useState(0);
  const companionOperationsRef = useRef(0);
  const [pinOpen, setPinOpen] = useState(false);
  const [waitingAreaMapOpen, setWaitingAreaMapOpen] = useState(false);
  const [locationPermission, setLocationPermission] =
    useState<LocationPermission | null>(null);
  const [primerSkipped, setPrimerSkipped] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const clearProblem = () => {
    setProblem("");
    setProblemSource("");
  };
  const showProblem = (source: string, message: string) => {
    setProblemSource(source);
    setProblem(message);
  };
  const showPickupProblem = (message: string) =>
    showProblem(pickupProblemSource(message), message);
  const beginCompanionOperation = () => {
    companionOperationsRef.current += 1;
    setCompanionOperations(companionOperationsRef.current);
  };
  const endCompanionOperation = () => {
    companionOperationsRef.current -= 1;
    setCompanionOperations(companionOperationsRef.current);
  };

  useEffect(() => {
    let active = true;
    getLocationPermission().then((permission) => {
      if (active) setLocationPermission(permission);
    });
    return () => {
      active = false;
    };
  }, []);

  const allowLocation = async () => {
    setLocationPermission(await requestLocationPermission());
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([loadMySharedRide(), loadMyRentals()]).then(
      ([shared, rentals]) => {
        if (!mounted) return;
        if (shared.ok) setSharedRide(shared.data);
        if (rentals.ok) setActiveRental(activeRentalOf(rentals.data));
        setSharedRideLoaded(true);
      },
    );
    Promise.all([
      loadActivePickup(),
      loadTransitRoutes(),
      loadWaitingAreas(),
      loadMyPickupDraft(),
    ]).then(async ([pickup, loadedRoutes, loadedWaitingAreas, draft]) => {
      if (!mounted) return;
      if (pickup.ok) setActive(pickup.data);
      if (loadedRoutes.ok) setRoutes(getTransitRoutes());
      setRoutesLoaded(true);
      if (loadedWaitingAreas.ok) setWaitingAreas(loadedWaitingAreas.data);
      setWaitingAreasLoaded(true);
      if (draft.ok && draft.data) {
        setDraftRequestId(draft.data.request_id);
        savedLocationKey.current = `${draft.data.device_latitude}:${draft.data.device_longitude}:${draft.data.pickup_destination}`;
        setPlace({
          id: draft.data.request_id,
          name: draft.data.pickup_destination,
          address: draft.data.pickup_destination,
          lat: draft.data.device_latitude,
          lng: draft.data.device_longitude,
        });
        setPassengers(draft.data.number_of_passengers);
        setVehicle(
          draft.data.requested_vehicle_type === "Jeepney" ? "jeep" : "tricy",
        );
        setUseWaitingArea(false);
        const companions = await loadPickupCompanionStatuses(
          draft.data.request_id,
        );
        if (mounted && companions.ok) {
          ridersRef.current = companions.data;
          setRiders(companions.data);
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setCompanionList = (next: Rider[]) => {
    if (
      next.length === ridersRef.current.length &&
      next.every((rider) =>
        ridersRef.current.some(
          (current) =>
            current.userId === rider.userId &&
            current.inviteStatus === rider.inviteStatus &&
            current.arrived === rider.arrived,
        ),
      )
    ) {
      return;
    }
    const count = (items: Rider[]) =>
      items.filter((item) => item.inviteStatus !== "rejected").length;
    const difference = count(next) - count(ridersRef.current);
    ridersRef.current = next;
    setRiders(next);
    if (difference) {
      setPassengers((current) =>
        Math.min(
          pickupVehicleCapacity[vehicle],
          Math.max(minPickupPassengers, current + difference),
        ),
      );
    }
  };

  useEffect(() => {
    if (online || !active) return;
    const disconnectedPickup = active;
    setActive(null);
    void queuePickupCancellation(disconnectedPickup);
  }, [active, online]);

  const nearestRoute = useMemo(
    () => (place ? findNearestRoute(place, routes) : null),
    [place, routes],
  );
  const canRecommendWaitingArea = !!place && !!nearestRoute;
  const hasPendingCompanions = riders.some(
    (rider) => rider.inviteStatus === "pending",
  );
  const pendingNames = riders
    .filter((rider) => rider.inviteStatus === "pending")
    .map((rider) => rider.name.split(" ")[0]);
  const locationLocked = hasPendingCompanions;
  const hasAcceptedCompanions = riders.some(
    (rider) => rider.inviteStatus === "accepted",
  );
  const activeCompanionCount = riders.filter(
    (rider) => rider.inviteStatus !== "rejected",
  ).length;
  const routePaths = useMemo(
    () =>
      nearestRoute
        ? [
            nearestRoute.route.waypoints,
            ...nearestRoute.route.alternativePaths,
          ].filter((path) => path.length > 0)
        : [],
    [nearestRoute],
  );
  const routeWaitingAreas = useMemo(
    () =>
      canRecommendWaitingArea && nearestRoute
        ? findWaitingAreasOnRoute(
            waitingAreas,
            nearestRoute.route.id,
            routePaths,
            nearestRoute.route.vicinity,
          )
        : [],
    [canRecommendWaitingArea, nearestRoute, routePaths, waitingAreas],
  );
  const nearestWaitingArea = useMemo(() => {
    if (!canRecommendWaitingArea || !place || !nearestRoute) return null;
    return findNearestWaitingArea(
      place,
      routeWaitingAreas,
      nearestRoute.route.id,
      routePaths,
      nearestRoute.route.vicinity,
    );
  }, [
    canRecommendWaitingArea,
    place,
    nearestRoute,
    routePaths,
    routeWaitingAreas,
  ]);
  const recommendedWaitingArea = useMemo(() => {
    const priorityWaitingArea = routeWaitingAreas.find(
      (area) => area.id === priorityWaitingAreaId,
    );
    return place && priorityWaitingArea
      ? {
          ...priorityWaitingArea,
          distanceMeters: getDistanceMeters(place, priorityWaitingArea),
        }
      : nearestWaitingArea;
  }, [routeWaitingAreas, priorityWaitingAreaId, place, nearestWaitingArea]);

  const requestLocation = useMemo(
    () =>
      useWaitingArea && recommendedWaitingArea
        ? {
            name: recommendedWaitingArea.name,
            lat: recommendedWaitingArea.lat,
            lng: recommendedWaitingArea.lng,
            waitingAreaType: recommendedWaitingArea.type,
          }
        : place,
    [useWaitingArea, recommendedWaitingArea, place],
  );
  const requestLocationKey = requestLocation
    ? `${requestLocation.lat}:${requestLocation.lng}:${requestLocation.name}`
    : null;

  useEffect(() => {
    if (!draftRequestId || !requestLocation || !requestLocationKey) return;
    if (requestLocationKey === savedLocationKey.current) return;
    if (!hasAcceptedCompanions || locationLocked) return;
    savedLocationKey.current = requestLocationKey;
    void savePickupDraft(
      draftRequestId,
      requestLocation,
      passengers,
      vehicle,
    ).then(async (saved) => {
      if (!saved.ok) {
        savedLocationKey.current = null;
        showProblem("Pickup location", saved.error);
        return;
      }
      const statuses = await loadPickupCompanionStatuses(draftRequestId);
      if (statuses.ok) setCompanionList(statuses.data);
    });
    // Only a change of location should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestLocationKey, draftRequestId, hasAcceptedCompanions]);

  usePolling(
    async () => {
      if (!draftRequestId) return;
      const result = await loadPickupCompanionStatuses(draftRequestId);
      if (result.ok) setCompanionList(result.data);
    },
    3_000,
    !!draftRequestId,
  );

  const [boarded, setBoarded] = useState<PickupRequest | null>(null);

  usePolling(
    async () => {
      const result = await loadMySharedRide();
      if (result.ok) setSharedRide(result.data);
    },
    4_000,
    sharedRideLoaded && !active && !draftRequestId,
  );

  const leaveRide = async () => {
    if (!sharedRide || busy) return;
    setBusy(true);
    clearProblem();
    const result = await leaveSharedRide(sharedRide.requestId);
    setBusy(false);
    if (!result.ok) return showProblem("Shared ride", result.error);
    setSharedRide(null);
  };
  const lastActive = useRef(active);
  useEffect(() => {
    if (active) lastActive.current = active;
  }, [active]);

  const activeId = active?.id;
  const activeStatus = active?.status;
  usePolling(
    async () => {
      if (!activeId) return;
      const latest = await loadActivePickup();
      if (!latest.ok) return;
      if (!latest.data && activeStatus === "accepted") {
        const status = await loadRequestStatus(activeId);
        if (status.ok && status.data === "completed")
          setBoarded(lastActive.current);
      }
      setActive(latest.data);
    },
    5_000,
    !!activeId,
  );

  const goBack = () => goBackOr(Routes.commuterHome);

  const sendPickupRequest = async (
    location: {
      name: string;
      lat: number;
      lng: number;
      waitingAreaType?: WaitingAreaType;
    } | null,
    requestedVehicle: PickupVehicle,
    requestedPassengers: number,
    requestedRiders: Rider[],
    requestDraftId: string | null,
  ) => {
    if (busy) return;
    setBusy(true);
    clearProblem();
    if (!(await checkOnline())) {
      setBusy(false);
      return showProblem(
        "Connection",
        "Reconnect to the internet before requesting a pickup.",
      );
    }
    const result = await requestPickup({
      vehicle: requestedVehicle,
      passengers: requestedPassengers,
      location,
      riders: requestedRiders,
      draftRequestId: requestDraftId,
    });
    setBusy(false);
    if (!result.ok) return showPickupProblem(result.error);
    ridersRef.current = [];
    setRiders([]);
    setDraftRequestId(null);
    savedLocationKey.current = null;
    setActive(result.data);
  };

  const inviteCompanion = async (rider: Rider): Promise<string | null> => {
    if (!place || !requestLocation) {
      return "Choose a pickup location before inviting a companion.";
    }
    beginCompanionOperation();
    try {
      if (!(await checkOnline())) {
        return "Reconnect to the internet before sending an invitation.";
      }
      const requiredPassengers = Math.max(
        passengers,
        ridersRef.current.filter((item) => item.inviteStatus !== "rejected")
          .length + 2,
      );
      const saved = await savePickupDraft(
        draftRequestId,
        requestLocation,
        requiredPassengers,
        vehicle,
      );
      if (!saved.ok) return saved.error;
      savedLocationKey.current = requestLocationKey;
      setDraftRequestId(saved.data);
      const sent = await sendPickupCompanionInvite(saved.data, rider.userId);
      if (!sent.ok) return sent.error;
      return null;
    } finally {
      endCompanionOperation();
    }
  };

  const removeCompanion = async (rider: Rider): Promise<string | null> => {
    if (!draftRequestId) return "This invitation is no longer available.";
    beginCompanionOperation();
    try {
      const result = await removePickupCompanion(draftRequestId, rider.userId);
      if (!result.ok) return result.error;
      return null;
    } finally {
      endCompanionOperation();
    }
  };

  const confirm = async () => {
    if (busy || companionOperationsRef.current > 0) return;
    if (hasPendingCompanions) {
      showProblem(
        "Share a ride",
        "Wait for each companion to accept or decline, or remove them before confirming.",
      );
      return;
    }
    if (useWaitingArea && place && !routesLoaded) {
      showProblem(
        "Waiting area",
        "Routes are still loading. Try again in a moment.",
      );
      return;
    }
    if (useWaitingArea && place && !recommendedWaitingArea) {
      showProblem(
        "Waiting area",
        !waitingAreasLoaded
          ? "Waiting areas are still loading. Try again shortly."
          : "There’s no registered waiting area along this route. You can request pickup at the selected location or choose another one.",
      );
      return;
    }
    await sendPickupRequest(
      requestLocation,
      vehicle,
      passengers,
      riders,
      draftRequestId,
    );
  };

  const cancel = async () => {
    if (busy || !active) return;
    setBusy(true);
    clearProblem();
    const result = await cancelPickup(active);
    setBusy(false);
    if (!result.ok) return showProblem("Pickup request", result.error);
    resetForm();
    setActive(null);
  };

  const resetForm = () => {
    clearProblem();
    setPlace(null);
    setPriorityWaitingAreaId(null);
    setVehicle("jeep");
    setUseWaitingArea(true);
    setPassengers(minPickupPassengers);
    ridersRef.current = [];
    setRiders([]);
    setDraftRequestId(null);
    savedLocationKey.current = null;
    setPinOpen(false);
    setWaitingAreaMapOpen(false);
    setFormKey((key) => key + 1);
  };

  const markLeft = useCallback(
    () =>
      setActive((current) =>
        current ? { ...current, arrived: false, arrivedAt: null } : current,
      ),
    [],
  );

  const markArrived = useCallback(
    () =>
      setActive((current) =>
        current
          ? {
              ...current,
              arrived: true,
              arrivedAt: current.arrivedAt ?? new Date(),
            }
          : current,
      ),
    [],
  );

  if (boarded) {
    return (
      <BoardedScreen
        request={boarded}
        onDone={() => {
          setBoarded(null);
          goBack();
        }}
      />
    );
  }

  if (sharedRide && !active) {
    return (
      <SharedRideScreen
        ride={sharedRide}
        busy={busy}
        problem={problem}
        onLeave={leaveRide}
        onBack={goBack}
      />
    );
  }

  if (!sharedRideLoaded && !sharedRide && !active) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />
        <LoadingLogo label="Checking your pickup" />
      </View>
    );
  }

  if (active) {
    return (
      <ActivePickup
        request={active}
        busy={busy}
        problem={problem}
        problemSource={problemSource || "Pickup request"}
        onCancel={cancel}
        onBack={goBack}
        onArrived={markArrived}
        onLeft={markLeft}
      />
    );
  }

  if (activeRental && !active) {
    return (
      <RentalInProgress
        rental={activeRental}
        onOpenRental={() => router.replace(Routes.commuterRental)}
        onBack={goBack}
      />
    );
  }

  if (locationPermission === "undetermined" && !primerSkipped) {
    return (
      <LocationPrimer
        onAllow={allowLocation}
        onSkip={() => setPrimerSkipped(true)}
        onBack={goBack}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Animated.ScrollView
        onScroll={chrome.scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: chrome.headerHeight,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          {locationPermission === "blocked" && (
            <View style={styles.locationBlocked}>
              <Text style={styles.locationBlockedText}>
                {blockedLocationMessage} You need it to reach your pickup point
                and let drivers see your request.
              </Text>
              <LocationSettingsButton color={brandBlue} background="#ffffff" />
            </View>
          )}
          <ErrorOutline
            invalid={problemSource === "Pickup location"}
            color={error}
          >
            <PlaceSearchField
              key={`place-${formKey}`}
              value={place}
              onChange={(next) => {
                clearProblem();
                setPriorityWaitingAreaId(null);
                setWaitingAreaMapOpen(false);
                setPlace(next);
              }}
              onProblem={(message) => showProblem("Pickup location", message)}
              disabled={locationLocked}
              placeholder="Search places..."
              icon={<Search color={brandBlue} size={20} strokeWidth={2} />}
              allowCurrentLocation
            />
          </ErrorOutline>
          {locationLocked && (
            <Text style={styles.lockedHint}>
              The pickup location is locked while an invitation is waiting for a
              reply. Remove the companion to change it.
            </Text>
          )}

          {canRecommendWaitingArea && place && !recommendedWaitingArea && (
            <View style={styles.recommendCard}>
              <View style={styles.recommendIcon}>
                <PersonStanding color="#ffffff" size={18} strokeWidth={2} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.recommendLabel}>
                  {!waitingAreasLoaded
                    ? "FINDING A NEARBY WAITING AREA"
                    : "NO WAITING AREA FOUND ON THIS ROUTE"}
                </Text>
                <Text style={styles.recommendMeta}>
                  {!waitingAreasLoaded
                    ? "Checking registered waiting areas along the nearest route…"
                    : "Request pickup at the selected location, or choose a different one."}
                </Text>
              </View>
            </View>
          )}

          {canRecommendWaitingArea &&
            recommendedWaitingArea &&
            place &&
            nearestRoute && (
              <View style={styles.recommendCard}>
                <View style={styles.recommendIcon}>
                  <MapPin color="#ffffff" size={18} strokeWidth={2} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.recommendLabel}>
                    RECOMMENDED WAITING AREA
                  </Text>
                  <Text style={styles.recommendName}>
                    {recommendedWaitingArea.name}
                  </Text>
                  <Text style={styles.recommendMeta}>
                    {vehicle === "tricy"
                      ? `Optional for tricycle pickups: wait here for a tricycle closer to your route. It is about ${formatDistance(recommendedWaitingArea.distanceMeters)} from your selected location; you can still request pickup at your pin.`
                      : `Wait here for your jeepney. It is about ${formatDistance(recommendedWaitingArea.distanceMeters)} from your selected pickup location.`}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View ${recommendedWaitingArea.name} on the map`}
                    onPress={() => setWaitingAreaMapOpen(true)}
                    style={({ pressed }) => [
                      styles.mapAction,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Eye color="#ffffff" size={14} strokeWidth={2.2} />
                    <Text style={styles.mapActionText}>VIEW ON MAP</Text>
                  </Pressable>
                </View>
              </View>
            )}
          {place && (
            <View
              style={[
                styles.locationChoice,
                problemSource === "Waiting area" && styles.invalidOutline,
              ]}
            >
              <Text style={styles.locationChoiceTitle}>
                WHERE SHOULD YOUR DRIVER PICK YOU UP?
              </Text>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: useWaitingArea }}
                disabled={locationLocked}
                onPress={() => {
                  clearProblem();
                  setUseWaitingArea(true);
                }}
                style={({ pressed }) => [
                  styles.locationChoiceOption,
                  useWaitingArea && styles.locationChoiceSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.radio}>
                  {useWaitingArea && <View style={styles.radioDot} />}
                </View>
                <View style={styles.flex}>
                  <Text style={styles.locationChoiceLabel}>
                    Use the recommended waiting area
                  </Text>
                  <Text style={styles.locationChoiceDescription}>
                    {recommendedWaitingArea
                      ? recommendedWaitingArea.name
                      : waitingAreasLoaded
                        ? "No matching waiting area was found."
                        : "Finding a nearby waiting area…"}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: !useWaitingArea }}
                disabled={locationLocked}
                onPress={() => {
                  clearProblem();
                  setUseWaitingArea(false);
                }}
                style={({ pressed }) => [
                  styles.locationChoiceOption,
                  !useWaitingArea && styles.locationChoiceSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.radio}>
                  {!useWaitingArea && <View style={styles.radioDot} />}
                </View>
                <View style={styles.flex}>
                  <Text style={styles.locationChoiceLabel}>
                    Pick me up at my selected location
                  </Text>
                  <Text style={styles.locationChoiceDescription}>
                    Request pickup at the pin or place you selected.
                  </Text>
                </View>
              </Pressable>
            </View>
          )}
          {waitingAreaMapOpen && recommendedWaitingArea && nearestRoute && (
            <RecommendedWaitingAreaMap
              area={recommendedWaitingArea}
              onClose={() => setWaitingAreaMapOpen(false)}
            />
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pin a different pickup location on the map"
            accessibilityState={{ disabled: locationLocked }}
            disabled={locationLocked}
            onPress={() => setPinOpen(true)}
            style={({ pressed }) => [
              styles.pinOption,
              (pressed || locationLocked) && styles.pressed,
            ]}
          >
            <View style={styles.pinOptionIcon}>
              <MapPinned color={brandBlue} size={16} strokeWidth={2} />
            </View>
            <Text style={[styles.pinOptionText, styles.flex]}>
              Pin a different pickup location on the map
            </Text>
            <ChevronRight color={brandBlue} size={16} strokeWidth={2.5} />
          </Pressable>
          {pinOpen && (
            <PinLocationPicker
              initial={place ? { lat: place.lat, lng: place.lng } : null}
              waitingAreas={waitingAreas}
              routes={routes}
              onPick={(next, preferredWaitingAreaId) => {
                clearProblem();
                setPriorityWaitingAreaId(preferredWaitingAreaId ?? null);
                setWaitingAreaMapOpen(false);
                setPinOpen(false);
                setPlace(next);
              }}
              onClose={() => setPinOpen(false)}
            />
          )}

          <SectionTitle
            icon={<UsersRound color="#ffffff" size={18} strokeWidth={2} />}
            title="Choose which vehicle to ride!"
          />
          <VehiclePicker
            value={vehicle}
            disabled={locationLocked}
            onChange={(next) => {
              const capacity = pickupVehicleCapacity[next];
              if (activeCompanionCount + 1 > capacity) {
                showProblem(
                  "Passenger count",
                  `A ${pickupVehicleNames[next]} fits up to ${capacity} passengers. Remove a companion before switching.`,
                );
                return;
              }
              clearProblem();
              setPriorityWaitingAreaId(null);
              setWaitingAreaMapOpen(false);
              setPassengers((current) => Math.min(current, capacity));
              setVehicle(next);
              setUseWaitingArea(next === "jeep");
            }}
          />

          <SectionTitle
            icon={<UserRound color="#ffffff" size={18} strokeWidth={2} />}
            title="Share a Ride?"
          />
          <ShareRideField
            key={`share-${formKey}`}
            riders={riders}
            max={maxRidersFor(vehicle)}
            onInvite={inviteCompanion}
            onRemove={removeCompanion}
            invalid={problemSource === "Share a ride"}
            onProblem={(message) => showProblem("Share a ride", message)}
            onChange={(next) => {
              clearProblem();
              setCompanionList(next);
            }}
          />

          <View style={styles.passengerSection}>
            <View style={styles.passengerIcon}>
              <Users color={brandBlue} size={18} strokeWidth={2} />
            </View>
            <View>
              <View style={styles.passengerLabelRow}>
                <Text style={styles.passengerLabel}>Number of Passengers</Text>
                {problemSource === "Passenger count" && (
                  <ErrorMark color={error} />
                )}
              </View>
              <PassengerStepper
                value={passengers}
                onChange={(next) => {
                  if (problemSource === "Passenger count") clearProblem();
                  setPassengers(next);
                }}
                min={Math.max(minPickupPassengers, activeCompanionCount + 1)}
                max={pickupVehicleCapacity[vehicle]}
              />
              <Text style={styles.passengerHint}>
                Including you. A {vehicle === "jeep" ? "jeepney" : "tricycle"}{" "}
                fits up to {pickupVehicleCapacity[vehicle]}.
              </Text>
            </View>
          </View>

          {!online && <ConnectionRequired action="A pickup request" />}
          {!!problem && online && (
            <ErrorAlert
              title={problemSource || "Pickup request"}
              message={problem}
              style={{ marginTop: 12 }}
            />
          )}
          <ModuleButton
            label={
              busy
                ? "REQUESTING..."
                : companionOperations > 0
                  ? "UPDATING COMPANIONS..."
                  : !online
                    ? "OFFLINE"
                    : hasPendingCompanions
                      ? pendingNames.length === 1
                        ? `WAITING FOR ${pendingNames[0].toUpperCase()} TO RESPOND`
                        : `WAITING FOR ${pendingNames.length} COMPANIONS`
                      : "CONFIRM"
            }
            disabledHint={
              hasPendingCompanions && !busy
                ? `${pendingNames.join(", ")} ${pendingNames.length === 1 ? "hasn’t" : "haven’t"} answered yet. You can confirm once everyone responds, or remove them.`
                : undefined
            }
            disabled={
              busy || companionOperations > 0 || !online || hasPendingCompanions
            }
            onPress={confirm}
          />
        </View>
      </Animated.ScrollView>

      <StickyHeader chrome={chrome}>
        <ModuleHeader
          title="Pickup"
          subtitle="Request a pickup from nearby vehicles and let drivers know you’re waiting."
          icon={<MapPin color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={goBack}
          collapsed={chrome.collapsed}
        />
      </StickyHeader>
    </View>
  );
}

function RecommendedWaitingAreaMap({
  area,
  onClose,
}: {
  area: WaitingAreaRecommendation;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.waitingAreaMapScreen}>
        <WaitingAreaDirectionsMap area={area} padTop={75} padBottom={120} />
        <View style={[styles.waitingAreaMapTop, { top: insets.top + 12 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close waiting area map"
            onPress={onClose}
            style={({ pressed }) => [
              styles.waitingAreaMapClose,
              pressed && styles.pressed,
            ]}
          >
            <X color={brandBlue} size={20} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.waitingAreaMapTopTitle}>
            RECOMMENDED WAITING AREA
          </Text>
        </View>
        <View
          style={[styles.waitingAreaMapCard, { bottom: insets.bottom + 14 }]}
        >
          <Text style={styles.waitingAreaMapName}>{area.name}</Text>
          <Text style={styles.waitingAreaMapRoute}>
            {formatDistance(area.distanceMeters)} from your selected location
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  locationBlocked: {
    gap: 4,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fef3c7",
  },
  locationBlockedText: {
    color: "#78350f",
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
  },
  passengerHint: {
    marginTop: 6,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 11,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  lockedHint: {
    marginTop: 6,
    marginHorizontal: 4,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 13,
  },
  invalidOutline: { borderWidth: 1.5, borderColor: error },
  passengerLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  screen: { flex: 1, backgroundColor: "#ffffff" },
  flex: { flex: 1 },
  body: { paddingHorizontal: 12, paddingTop: 18 },
  pressed: { opacity: 0.8 },
  helper: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 10,
    marginLeft: 4,
  },
  recommendCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: softBlue,
  },
  locationChoice: {
    gap: 8,
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  locationChoiceTitle: {
    color: mutedText,
    fontFamily: "SoraBold",
    fontSize: 10,
    marginBottom: 2,
  },
  locationChoiceOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 9,
  },
  locationChoiceSelected: {
    borderColor: brandBlue,
    backgroundColor: "#eff6ff",
  },
  radio: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    borderWidth: 2,
    borderColor: brandBlue,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: brandBlue,
  },
  locationChoiceLabel: {
    color: text,
    fontFamily: "SoraBold",
    fontSize: 10,
  },
  locationChoiceDescription: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    marginTop: 2,
  },
  recommendIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#1e9e45",
  },
  recommendLabel: { color: mutedText, fontFamily: "SoraBold", fontSize: 10 },
  recommendName: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 14,
    marginTop: 3,
  },
  recommendMeta: {
    color: text,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },
  mapAction: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 9,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: brandBlue,
  },
  mapActionText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 10 },
  waitingAreaMapScreen: { flex: 1, backgroundColor: "#ffffff" },
  waitingAreaMapTop: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  waitingAreaMapClose: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: "#ffffff",
    elevation: 4,
  },
  waitingAreaMapTopTitle: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 11,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  waitingAreaMapCard: {
    position: "absolute",
    left: 14,
    right: 14,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    elevation: 8,
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  waitingAreaMapName: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 14,
  },
  waitingAreaMapRoute: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    marginTop: 5,
  },
  pinOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: softBlue,
  },
  pinOptionIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: softBlue,
  },
  pinOptionText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 11 },
  passengerSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginTop: 22,
  },
  passengerIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: softBlue,
  },
  passengerLabel: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 11,
  },
});
