import { StatusBar } from "expo-status-bar";
import ChevronRight from "lucide-react-native/icons/chevron-right";
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
  formatDistance,
  getKnownWaitingAreas,
  loadWaitingAreas,
  recommendWaitingArea,
  type WaitingArea,
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
import { TransitMap, type TransitMapState } from "@/components/transit-map";
import { Routes } from "@/constants/routes";
import { usePolling } from "@/hooks/use-polling";
import { checkOnline, useOnline } from "@/hooks/use-online";
import { goBackOr } from "@/utils/navigation";

import { ActivePickup } from "./active-pickup";
import { BoardedScreen } from "./boarded-screen";
import { PinLocationPicker } from "./pin-location-picker";
import { ShareRideField } from "./share-ride-field";

const { brandBlue, softBlue, mutedText, text, error } = moduleColors;

export default function PickupScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const [active, setActive] = useState<PickupRequest | null>(
    getKnownActivePickup,
  );
  const [waitingAreas, setWaitingAreas] =
    useState<WaitingArea[]>(getKnownWaitingAreas);
  const [place, setPlace] = useState<Place | null>(null);
  const [vehicle, setVehicle] = useState<PickupVehicle>("jeep");
  const [riders, setRiders] = useState<Rider[]>([]);
  const online = useOnline();
  const [passengers, setPassengers] = useState(1);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([loadActivePickup(), loadWaitingAreas()]).then(
      ([pickup, areas]) => {
        if (!mounted) return;
        if (pickup.ok) setActive(pickup.data);
        if (areas.ok) setWaitingAreas(areas.data);
      },
    );
    return () => {
      mounted = false;
    };
  }, []);

  const stops = useMemo(
    () => waitingAreas.filter((area) => area.type === "stop"),
    [waitingAreas],
  );
  const recommended = useMemo(
    () => (place ? recommendWaitingArea(place, stops) : null),
    [place, stops],
  );

  const stop = recommended;

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

  const confirm = async () => {
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
      vehicle,
      passengers,
      location: place,
      waitingArea: recommended,
      riders,
    });
    setBusy(false);
    if (!result.ok) return setProblem(result.error);
    setMapOpen(false);
    setRiders([]);
    setActive(result.data);
  };

  const cancel = async () => {
    if (busy || !active) return;
    setBusy(true);
    setProblem("");
    const result = await cancelPickup(active);
    setBusy(false);
    if (!result.ok) return setProblem(result.error);
    setMapOpen(false);
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
              setMapOpen(false);
              setPlace(next);
            }}
            onProblem={setProblem}
            placeholder="Search places..."
            icon={<Search color={brandBlue} size={20} strokeWidth={2} />}
            allowCurrentLocation
          />

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
              stops={stops}
              onPick={(next) => {
                setProblem("");
                setMapOpen(false);
                setPinOpen(false);
                setPlace(next);
              }}
              onClose={() => setPinOpen(false)}
            />
          )}

          {place && !stop && (
            <View style={styles.recommendCard}>
              <View style={styles.recommendIcon}>
                <PersonStanding color="#ffffff" size={18} strokeWidth={2} />
              </View>
              <Text style={[styles.recommendMeta, styles.flex]}>
                There’s no waiting area within walking distance of this place.
                Try another location or pin a spot closer to a route.
              </Text>
            </View>
          )}
          {place && stop && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show the pickup point on the map"
                onPress={() => setMapOpen(true)}
                style={({ pressed }) => [
                  styles.recommendCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.recommendIcon}>
                  <PersonStanding color="#ffffff" size={18} strokeWidth={2} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.recommendLabel}>
                    NEAREST WAITING AREA
                  </Text>
                  <Text style={styles.recommendName}>{stop.name}</Text>
                  <Text style={styles.recommendMeta}>
                    {`${formatDistance(stop.distanceMeters)} away · about ${stop.walkMinutes} min walk${stop.vicinity ? ` · ${stop.vicinity}` : ""}`}
                  </Text>
                  <Text style={styles.recommendMeta}>
                    Wait here for your{" "}
                    {vehicle === "jeep" ? "jeepney" : "tricycle"}.
                  </Text>
                  <Text style={styles.mapHint}>
                    Tap to see the exact location
                  </Text>
                </View>
              </Pressable>
              {mapOpen && (
                <LocationMap
                  target={stop}
                  kind="stop"
                  origin={place}
                  onClose={() => setMapOpen(false)}
                />
              )}
            </>
          )}

          <SectionTitle
            icon={<UsersRound color="#ffffff" size={18} strokeWidth={2} />}
            title="Choose which vehicle to ride!"
          />
          <VehiclePicker
            value={vehicle}
            onChange={(next) => {
              setProblem("");
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

type MapPoint = { name: string; lat: number; lng: number };

function LocationMap({
  target,
  kind,
  origin,
  onClose,
}: {
  target: MapPoint;
  kind: "stop" | "place";
  origin?: MapPoint;
  onClose: () => void;
}) {
  const state = useMemo<TransitMapState>(() => {
    const pins = [
      ...(kind === "place" ? [target] : []),
      ...(origin ? [origin] : []),
    ];
    return {
      routeId: null,
      route: null,
      vehicles: [],
      waitingAreas:
        kind === "stop"
          ? [
              {
                id: "pickup-stop",
                name: target.name,
                lat: target.lat,
                lng: target.lng,
                kind: "stop",
              },
            ]
          : [],
      pickups: pins.map((pin, index) => ({
        id: `pin-${index}`,
        lat: pin.lat,
        lng: pin.lng,
      })),
      pickupLine: origin
        ? [
            [origin.lat, origin.lng],
            [target.lat, target.lng],
          ]
        : null,
      focus: { key: 1, lat: target.lat, lng: target.lng, zoom: 17 },
      padTop: 0,
      padBottom: 0,
    };
  }, [target, kind, origin]);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Close map"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.flex}>
              <Text style={styles.recommendLabel}>
                {kind === "stop" ? "WAITING AREA" : "PICKUP POINT"}
              </Text>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {target.name}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close map"
              hitSlop={10}
              onPress={onClose}
              style={styles.modalClose}
            >
              <X color={brandBlue} size={18} strokeWidth={2.5} />
            </Pressable>
          </View>
          <View style={styles.map}>
            <TransitMap state={state} />
          </View>
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
    alignItems: "center",
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
    marginTop: 2,
  },
  recommendMeta: {
    color: text,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },
  recommendIconPlace: { backgroundColor: "#c81e1e" },
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
  mapHint: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 9,
    marginTop: 4,
  },
  map: { height: 340, backgroundColor: "#e8eaed" },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  modalCard: {
    overflow: "hidden",
    borderRadius: 16,
    backgroundColor: "#ffffff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  modalTitle: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 15,
    marginTop: 2,
  },
  modalClose: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: softBlue,
  },
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
