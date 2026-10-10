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
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  cancelPickup,
  getKnownActivePickup,
  loadActivePickup,
  loadRequestStatus,
  maxPickupPassengers,
  maxRiders,
  minPickupPassengers,
  requestPickup,
  type PickupRequest,
  type PickupVehicle,
  type Rider,
} from "@/api/v1/pickups/controllers";
import type { Place } from "@/api/v1/places/controllers";
import {
  findNearestRoute,
  getTransitRoutes,
  loadTransitRoutes,
  type TransitRoute,
} from "@/api/v1/transit-routes/controllers";
import {
  findNearestWaitingArea,
  getKnownWaitingAreas,
  loadWaitingAreas,
  type WaitingArea,
  type WaitingAreaRecommendation,
  type WaitingAreaType,
} from "@/api/v1/waiting-areas/controllers";
import {
  ModuleButton,
  ModuleHeader,
  moduleColors,
  PassengerStepper,
  SectionTitle,
  VehiclePicker,
} from "@/components/module-ui";
import { ConnectionRequired } from "@/components/connection-required";
import { PlaceSearchField } from "@/components/place-search-field";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { usePolling } from "@/hooks/use-polling";
import { checkOnline, useOnline } from "@/hooks/use-online";
import { goBackOr } from "@/utils/navigation";

import { ActivePickup } from "./active-pickup";
import { BoardedScreen } from "./boarded-screen";
import { PinLocationPicker } from "./pin-location-picker";
import { ShareRideField } from "./share-ride-field";
import { WaitingAreaDirectionsMap } from "./waiting-area-directions-map";
import { WaitingAreaConfirmation } from "./waiting-area-confirmation";

type WaitingAreaGate = {
  area: WaitingAreaRecommendation;
  passengers: number;
  riders: Rider[];
};

const { brandBlue, softBlue, mutedText, text, error } = moduleColors;

function formatDistance(meters: number) {
  return meters < 1000
    ? `${Math.round(meters / 10) * 10} m`
    : `${(meters / 1000).toFixed(1)} km`;
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
  const [waitingAreas, setWaitingAreas] = useState<WaitingArea[]>(
    getKnownWaitingAreas,
  );
  const [waitingAreasLoaded, setWaitingAreasLoaded] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [vehicle, setVehicle] = useState<PickupVehicle>("jeep");
  const [riders, setRiders] = useState<Rider[]>([]);
  const online = useOnline();
  const [passengers, setPassengers] = useState(1);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [waitingAreaMapOpen, setWaitingAreaMapOpen] = useState(false);
  const [waitingAreaGate, setWaitingAreaGate] =
    useState<WaitingAreaGate | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      loadActivePickup(),
      loadTransitRoutes(),
      loadWaitingAreas(),
    ]).then(([pickup, loadedRoutes, loadedWaitingAreas]) => {
      if (!mounted) return;
      if (pickup.ok) setActive(pickup.data);
      if (loadedRoutes.ok) setRoutes(getTransitRoutes());
      setRoutesLoaded(true);
      if (loadedWaitingAreas.ok) setWaitingAreas(loadedWaitingAreas.data);
      setWaitingAreasLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const nearestRoute = useMemo(
    () => (place ? findNearestRoute(place, routes) : null),
    [place, routes],
  );
  const needsWaitingArea =
    vehicle === "jeep" &&
    !!place &&
    !!nearestRoute;
  const recommendedWaitingArea = useMemo(() => {
    if (!needsWaitingArea || !place || !nearestRoute) return null;
    const paths = [
      nearestRoute.route.waypoints,
      ...nearestRoute.route.alternativePaths,
    ].filter((path) => path.length > 0);
    return findNearestWaitingArea(
      place,
      waitingAreas,
      nearestRoute.route.id,
      paths,
      nearestRoute.route.vicinity,
    );
  }, [needsWaitingArea, place, nearestRoute, waitingAreas]);

  const [boarded, setBoarded] = useState<PickupRequest | null>(null);
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
    location:
      | {
          name: string;
          lat: number;
          lng: number;
          waitingAreaType?: WaitingAreaType;
        }
      | null,
    requestedVehicle: PickupVehicle,
    requestedPassengers: number,
    requestedRiders: Rider[],
  ) => {
    if (busy) return;
    setBusy(true);
    setProblem("");
    if (!(await checkOnline())) {
      setBusy(false);
      return setProblem(
        "You're offline. Connect to the internet to send your request.",
      );
    }
    const result = await requestPickup({
      vehicle: requestedVehicle,
      passengers: requestedPassengers,
      location,
      riders: requestedRiders,
    });
    setBusy(false);
    if (!result.ok) return setProblem(result.error);
    setWaitingAreaGate(null);
    setRiders([]);
    setActive(result.data);
  };

  const confirm = async () => {
    if (busy) return;
    if (vehicle === "jeep" && place && !routesLoaded) {
      setProblem("Loading routes. Please wait before requesting a pickup.");
      return;
    }
    if (needsWaitingArea && !recommendedWaitingArea) {
      setProblem(
        !waitingAreasLoaded
          ? "Loading registered waiting areas. Please wait."
          : "No registered waiting area was found along the nearest route. Choose a location closer to the route or select a tricycle.",
      );
      return;
    }
    if (needsWaitingArea && recommendedWaitingArea) {
      setProblem("");
      setWaitingAreaGate({ area: recommendedWaitingArea, passengers, riders });
      return;
    }
    await sendPickupRequest(place, vehicle, passengers, riders);
  };

  const cancel = async () => {
    if (busy || !active) return;
    setBusy(true);
    setProblem("");
    const result = await cancelPickup(active);
    setBusy(false);
    if (!result.ok) return setProblem(result.error);
    setActive(null);
  };

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

  if (waitingAreaGate) {
    return (
      <WaitingAreaConfirmation
        area={waitingAreaGate.area}
        busy={busy}
        problem={problem}
        onRequest={() =>
          sendPickupRequest(
            {
              name: waitingAreaGate.area.name,
              lat: waitingAreaGate.area.lat,
              lng: waitingAreaGate.area.lng,
              waitingAreaType: waitingAreaGate.area.type,
            },
            "jeep",
            waitingAreaGate.passengers,
            waitingAreaGate.riders,
          )
        }
        onBack={() => {
          setProblem("");
          setWaitingAreaGate(null);
        }}
      />
    );
  }

  if (active) {
    return (
      <ActivePickup
        request={active}
        busy={busy}
        problem={problem}
        onCancel={cancel}
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
          <PlaceSearchField
            value={place}
            onChange={(next) => {
              setProblem("");
              setWaitingAreaMapOpen(false);
              setPlace(next);
            }}
            onProblem={setProblem}
            placeholder="Search places..."
            icon={<Search color={brandBlue} size={20} strokeWidth={2} />}
            allowCurrentLocation
          />

          {needsWaitingArea && place && !recommendedWaitingArea && (
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
                    : "Choose another pickup location or select a tricycle."}
                </Text>
              </View>
            </View>
          )}

          {needsWaitingArea && recommendedWaitingArea && place && nearestRoute && (
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
                  Wait here for your jeepney. It is about{" "}
                  {formatDistance(recommendedWaitingArea.distanceMeters)} from
                  your selected pickup location.
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
          {waitingAreaMapOpen && recommendedWaitingArea && nearestRoute && (
            <RecommendedWaitingAreaMap
              area={recommendedWaitingArea}
              onClose={() => setWaitingAreaMapOpen(false)}
            />
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pin a different pickup location on the map"
            onPress={() => setPinOpen(true)}
            style={({ pressed }) => [
              styles.pinOption,
              pressed && styles.pressed,
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
              vehicle={vehicle}
              onPick={(next) => {
                setProblem("");
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
            onChange={(next) => {
              setProblem("");
              setWaitingAreaMapOpen(false);
              setVehicle(next);
            }}
          />

          <SectionTitle
            icon={<UserRound color="#ffffff" size={18} strokeWidth={2} />}
            title="Share a Ride?"
          />
          <ShareRideField
            riders={riders}
            max={maxRiders}
            onChange={(next) => {
              const removed = riders.length - next.length;
              setProblem("");
              setRiders(next);
              setPassengers((current) =>
                removed > 0
                  ? Math.max(
                      minPickupPassengers,
                      next.length + 1,
                      current - removed,
                    )
                  : Math.max(current, next.length + 1),
              );
            }}
          />

          <View style={styles.passengerSection}>
            <View style={styles.passengerIcon}>
              <Users color={brandBlue} size={18} strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.passengerLabel}>Number of Passengers</Text>
              <PassengerStepper
                value={passengers}
                onChange={setPassengers}
                min={Math.max(minPickupPassengers, riders.length + 1)}
                max={maxPickupPassengers}
              />
            </View>
          </View>

          {!online && <ConnectionRequired action="A pickup request" />}
          {!!problem && online && <Text style={styles.problem}>{problem}</Text>}
          <ModuleButton
            label={busy ? "REQUESTING..." : online ? "CONFIRM" : "OFFLINE"}
            disabled={busy || !online}
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
          style={[
            styles.waitingAreaMapCard,
            { bottom: insets.bottom + 14 },
          ]}
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
  screen: { flex: 1, backgroundColor: "#ffffff" },
  flex: { flex: 1 },
  body: { paddingHorizontal: 12, paddingTop: 18 },
  pressed: { opacity: 0.8 },
  problem: {
    color: error,
    fontFamily: "Sora",
    fontSize: 10,
    marginTop: 16,
    textAlign: "center",
  },
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
  recommendIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#1e9e45",
  },
  recommendLabel: { color: mutedText, fontFamily: "SoraBold", fontSize: 8 },
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
  mapActionText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 9 },
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
  waitingAreaMapName: { color: brandBlue, fontFamily: "SoraBold", fontSize: 14 },
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
    marginBottom: 8,
  },
});
