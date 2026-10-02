import { StatusBar } from "expo-status-bar";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import CircleCheckBig from "lucide-react-native/icons/circle-check-big";
import MapPin from "lucide-react-native/icons/map-pin";
import PersonStanding from "lucide-react-native/icons/person-standing";
import Search from "lucide-react-native/icons/search";
import UserRound from "lucide-react-native/icons/user-round";
import Users from "lucide-react-native/icons/users";
import UsersRound from "lucide-react-native/icons/users-round";
import X from "lucide-react-native/icons/x";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  canCancelPickup,
  cancelPickup,
  loadActivePickup,
  maxPickupPassengers,
  minPickupPassengers,
  pickupStatusLabels,
  requestPickup,
  type PickupRequest,
  type PickupVehicle,
} from "@/api/v1/pickups/controllers";
import type { Place } from "@/api/v1/places/controllers";
import {
  formatDistance,
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
  SoftField,
  VehiclePicker,
} from "@/components/module-ui";
import { PlaceSearchField } from "@/components/place-search-field";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { TransitMap, type TransitMapState } from "@/components/transit-map";
import { Routes } from "@/constants/routes";
import { goBackOr } from "@/utils/navigation";

const { brandBlue, softBlue, mutedText, text, error } = moduleColors;

export default function PickupScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<PickupRequest | null>(null);
  const [waitingAreas, setWaitingAreas] = useState<WaitingArea[]>([]);
  const [place, setPlace] = useState<Place | null>(null);
  const [vehicle, setVehicle] = useState<PickupVehicle>("jeep");
  const [shareQuery, setShareQuery] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([loadActivePickup(), loadWaitingAreas()]).then(
      ([pickup, areas]) => {
        if (!mounted) return;
        if (pickup.ok) setActive(pickup.data);
        if (areas.ok) setWaitingAreas(areas.data);
        setLoading(false);
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

  const stop = vehicle === "jeep" ? recommended : null;

  const activeId = active?.id;
  const activeStatus = active?.status;
  useEffect(() => {
    if (!activeId || activeStatus !== "pending") return;
    const timer = setInterval(async () => {
      const latest = await loadActivePickup();
      if (latest.ok) setActive(latest.data);
    }, 10_000);
    return () => clearInterval(timer);
  }, [activeId, activeStatus]);

  const goBack = () => goBackOr(Routes.commuterHome);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setProblem("");
    const result = await requestPickup({
      vehicle,
      passengers,
      location: place,
      waitingArea: recommended,
    });
    setBusy(false);
    if (!result.ok) return setProblem(result.error);
    setMapOpen(false);
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
        {loading ? (
          <ActivityIndicator color={brandBlue} style={styles.loading} />
        ) : active ? (
          <View style={[styles.body, styles.activeBody]}>
            <View style={styles.successIcon}>
              <CircleCheckBig color="#ffffff" size={44} strokeWidth={2} />
            </View>
            <Text style={styles.activeTitle}>Pickup requested!</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {pickupStatusLabels[active.status]}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Show ${active.pickupName} on the map`}
                onPress={() => setMapOpen(true)}
              >
                <SummaryRow label="Pickup point" value={active.pickupName} />
                <Text style={styles.mapHint}>
                  Tap to see the exact location
                </Text>
              </Pressable>
              {mapOpen && (
                <LocationMap
                  target={{
                    name: active.pickupName,
                    lat: active.lat,
                    lng: active.lng,
                  }}
                  kind="place"
                  onClose={() => setMapOpen(false)}
                />
              )}
              <SummaryRow
                label="Passengers"
                value={String(active.passengers)}
                last
              />
            </View>
            <Text style={styles.helper}>
              Head to your pickup point and stay there so the driver can find
              you.
            </Text>

            {!!problem && <Text style={styles.problem}>{problem}</Text>}
            {canCancelPickup(active) ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={cancel}
                style={({ pressed }) => [
                  styles.cancelButton,
                  (pressed || busy) && styles.pressed,
                ]}
              >
                <Text style={styles.cancelText}>
                  {busy ? "CANCELLING..." : "CANCEL REQUEST"}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.cancelNote}>
                You can cancel once a driver accepts your request.
              </Text>
            )}
          </View>
        ) : (
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

            {place && vehicle === "jeep" && !stop && (
              <View style={styles.recommendCard}>
                <View style={styles.recommendIcon}>
                  <PersonStanding color="#ffffff" size={18} strokeWidth={2} />
                </View>
                <Text style={[styles.recommendMeta, styles.flex]}>
                  There’s no waiting area within walking distance of this place.
                  Try another location or choose a tricycle.
                </Text>
              </View>
            )}
            {place && (vehicle === "tricy" || stop) && (
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
                  <View
                    style={[
                      styles.recommendIcon,
                      !stop && styles.recommendIconPlace,
                    ]}
                  >
                    {stop ? (
                      <PersonStanding
                        color="#ffffff"
                        size={18}
                        strokeWidth={2}
                      />
                    ) : (
                      <MapPin color="#ffffff" size={18} strokeWidth={2} />
                    )}
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.recommendLabel}>
                      {stop ? "NEAREST WAITING AREA" : "PICKUP POINT"}
                    </Text>
                    <Text style={styles.recommendName}>
                      {stop ? stop.name : place.name}
                    </Text>
                    <Text style={styles.recommendMeta}>
                      {stop
                        ? `${formatDistance(stop.distanceMeters)} away · about ${stop.walkMinutes} min walk${stop.vicinity ? ` · ${stop.vicinity}` : ""}`
                        : "Tricycles pick you up right where you are."}
                    </Text>
                    <Text style={styles.mapHint}>
                      Tap to see the exact location
                    </Text>
                  </View>
                </Pressable>
                {mapOpen && (
                  <LocationMap
                    target={stop ?? place}
                    kind={stop ? "stop" : "place"}
                    origin={stop ? place : undefined}
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
            <SoftField
              value={shareQuery}
              onChangeText={setShareQuery}
              placeholder="Search a user..."
              accessibilityLabel="Search a user to share the ride with"
              icon={<UserRound color={brandBlue} size={20} strokeWidth={2} />}
              trailing={
                <ChevronRight color={brandBlue} size={20} strokeWidth={2.5} />
              }
              style={styles.shareField}
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
                  min={minPickupPassengers}
                  max={maxPickupPassengers}
                />
              </View>
            </View>

            {!!problem && <Text style={styles.problem}>{problem}</Text>}
            <ModuleButton
              label={busy ? "REQUESTING..." : "CONFIRM"}
              disabled={busy}
              onPress={confirm}
            />
          </View>
        )}
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
      terminals: [],
      highlightedTerminalId: null,
      selectedId: null,
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
            <TransitMap state={state} onSelect={() => {}} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SummaryRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.summaryRow, !last && styles.summaryDivider]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  flex: { flex: 1 },
  loading: { marginTop: 48 },
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
  cancelNote: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    marginTop: 24,
    textAlign: "center",
  },
  shareField: { gap: 14, paddingHorizontal: 16 },
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
  activeBody: { alignItems: "center", paddingTop: 36 },
  successIcon: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 42,
    backgroundColor: brandBlue,
  },
  activeTitle: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 20,
    marginTop: 18,
  },
  statusBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: softBlue,
  },
  statusText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 11 },
  summaryCard: {
    alignSelf: "stretch",
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: "#1a2f8f",
    borderRadius: 10,
  },
  summaryRow: { flexDirection: "row", gap: 12, paddingVertical: 10 },
  summaryDivider: { borderBottomWidth: 1, borderBottomColor: "#eef1f7" },
  summaryLabel: {
    width: 90,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
  },
  summaryValue: { flex: 1, color: text, fontFamily: "SoraBold", fontSize: 11 },
  cancelButton: {
    alignSelf: "stretch",
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    borderWidth: 1.5,
    borderColor: error,
    borderRadius: 14,
  },
  cancelText: {
    color: error,
    fontFamily: "SoraBold",
    fontSize: 14,
    letterSpacing: 1,
  },
});
