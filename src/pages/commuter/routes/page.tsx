import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import BusFront from "lucide-react-native/icons/bus-front";
import ChevronsDown from "lucide-react-native/icons/chevrons-down";
import ChevronsUp from "lucide-react-native/icons/chevrons-up";
import MapPin from "lucide-react-native/icons/map-pin";
import MapPinned from "lucide-react-native/icons/map-pinned";
import Layers from "lucide-react-native/icons/layers";
import Search from "lucide-react-native/icons/search";
import Sparkles from "lucide-react-native/icons/sparkles";
import X from "lucide-react-native/icons/x";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  type CSSTransitionProperties,
} from "react-native-reanimated";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  loadPickupDriver,
  type PickupDriver,
} from "@/api/v1/pickups/controllers";
import {
  findRoute,
  loadAlternativeGeometry,
  loadLiveVehicles,
  loadRouteGeometry,
  servesRoute,
  type LatLng,
  type LiveVehicle,
} from "@/api/v1/transit-routes/controllers";
import {
  findWaitingAreasOnRoute,
  loadWaitingAreas,
  type WaitingArea,
} from "@/api/v1/waiting-areas/controllers";
import { ModuleHeader, moduleColors } from "@/components/module-ui";
import { TransitMap, type TransitMapState } from "@/components/transit-map";
import {
  VehicleCard,
  VehicleDetailsModal,
} from "@/components/vehicle-details-modal";
import { Routes } from "@/constants/routes";
import { usePolling } from "@/hooks/use-polling";
import { useTransitRoutes } from "@/hooks/use-transit-routes";
import { isNearPath } from "@/utils/geo";
import { goBackOr } from "@/utils/navigation";
import { isSimulation } from "@/simulation/flag";
import { setViewedRoute } from "@/simulation/generated-vehicles";
import { LoadingLogo } from "@/components/LoadingLogo";

const { brandBlue, headerBlue, mutedText, softBlue, text } = moduleColors;

type VehicleFilter = "all" | "simulated" | "generated";

const myRidePollMs = 4_000;

const vehicleTypeLabels: Record<PickupDriver["vehicleType"], string> = {
  jeep: "Jeepney",
  tricy: "Tricycle",
};

function rideAsLiveVehicle(
  ride: PickupDriver,
  live: LiveVehicle[],
): LiveVehicle | null {
  if (!ride.location) return null;
  const listed = live.find((vehicle) => vehicle.plateNumber === ride.plateNumber);
  if (listed) return listed;
  return {
    id: `my-ride-${ride.requestId}`,
    type: ride.vehicleType,
    typeLabel: vehicleTypeLabels[ride.vehicleType],
    plateNumber: ride.plateNumber,
    status: ride.status,
    maxCapacity: ride.maxCapacity,
    currentCapacity: ride.currentCapacity,
    isFull: ride.occupancy === "Full",
    occupancy: ride.occupancy,
    lat: ride.location.lat,
    lng: ride.location.lng,
    routeId: null,
    routeName: null,
    stale: false,
    minutesSinceSeen: 0,
    generated: false,
  };
}

const vehicleFilters: {
  value: VehicleFilter;
  label: string;
  Icon: typeof Layers;
}[] = [
  { value: "all", label: "Show all vehicles", Icon: Layers },
  { value: "simulated", label: "Show regular vehicles only", Icon: BusFront },
  { value: "generated", label: "Show generated vehicles only", Icon: Sparkles },
];

const emptyVehicleText: Record<VehicleFilter, string> = {
  all: "Nothing to see here yet. Active vehicles on this route will show up here.",
  simulated: "No regular vehicles on this route right now.",
  generated: "No generated vehicles here.",
};
const cardNavy = "#0f2a5c";
const lightBlue = "#a8dcf7";
const livePollMs = isSimulation() ? 1_000 : 3_000;
const onRouteMeters = 60;
const panelPadding = 20;
const vehicleCardGap = 10;

const chipTransition: CSSTransitionProperties = {
  transitionProperty: ["backgroundColor", "transform", "opacity"],
  transitionDuration: 250,
  transitionTimingFunction: "ease-in-out",
};

const slideTransition: CSSTransitionProperties = {
  transitionProperty: ["maxHeight", "opacity", "marginBottom"],
  transitionDuration: 320,
  transitionTimingFunction: "ease-in-out",
};

function findVicinity(routeVicinity: string[], vicinity: string | null) {
  if (!vicinity) return null;
  const needle = vicinity.toLowerCase();
  return (
    routeVicinity.find((option) => option.toLowerCase() === needle) ?? vicinity
  );
}

export default function RoutesScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const vehicleCardWidth = Math.min(
    (windowWidth - panelPadding * 2) * 0.82,
    300,
  );
  const params = useLocalSearchParams<{
    routeId?: string;
    destLat?: string;
    destLng?: string;
    destName?: string;
  }>();
  const transitRoutes = useTransitRoutes();
  const startRouteId = params.routeId ?? null;
  const initialRoute = findRoute(startRouteId);
  const destination = useMemo(() => {
    const lat = Number.parseFloat(params.destLat ?? "");
    const lng = Number.parseFloat(params.destLng ?? "");
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }, [params.destLat, params.destLng]);
  const destinationName =
    typeof params.destName === "string" ? params.destName : "";

  const [headerHeight, setHeaderHeight] = useState(140);
  const [panelHeight, setPanelHeight] = useState(insets.bottom + 84);
  const [routeId, setRouteId] = useState<string | null>(startRouteId);
  const [path, setPath] = useState<LatLng[] | null>(null);
  const [alternativePaths, setAlternativePaths] = useState<LatLng[][]>([]);
  const [waitingAreas, setWaitingAreas] = useState<WaitingArea[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(!!startRouteId);
  const [query, setQuery] = useState(initialRoute?.name ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [showWaitingAreas, setShowWaitingAreas] = useState(true);

  const route = findRoute(routeId);
  const [liveVehicles, setLiveVehicles] = useState<LiveVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!isSimulation()) return;
    setViewedRoute(routeId);
    return () => setViewedRoute(null);
  }, [routeId]);

  usePolling(
    async () => {
      const result = await loadLiveVehicles();
      if (result.ok) setLiveVehicles(result.data);
    },
    livePollMs,
    !!routeId,
  );

  useEffect(() => {
    if (!route) return;
    let active = true;
    Promise.all([
      loadRouteGeometry(route),
      loadAlternativeGeometry(route),
    ]).then(([geometry, alternatives]) => {
      if (!active) return;
      setAlternativePaths(alternatives);
      setPath(geometry);
      setLoadingRoute(false);
    });
    return () => {
      active = false;
    };
  }, [route]);

  useEffect(() => {
    let active = true;
    loadWaitingAreas().then((result) => {
      if (active && result.ok) setWaitingAreas(result.data);
    });
    return () => {
      active = false;
    };
  }, []);

  const routeWaitingAreas = useMemo(
    () =>
      routeId && path
        ? findWaitingAreasOnRoute(
            waitingAreas,
            routeId,
            [path, ...alternativePaths],
            route?.vicinity,
          )
        : [],
    [waitingAreas, routeId, path, alternativePaths, route],
  );

  const [myRide, setMyRide] = useState<PickupDriver | null>(null);
  usePolling(
    async () => {
      const result = await loadPickupDriver();
      if (result.ok) setMyRide(result.data);
    },
    myRidePollMs,
    !!routeId,
  );
  const myRideVehicle = useMemo(
    () => (myRide ? rideAsLiveVehicle(myRide, liveVehicles) : null),
    [myRide, liveVehicles],
  );
  const myRideId = myRideVehicle?.id ?? null;

  const routeVehicles = useMemo(
    () =>
      routeId && path
        ? liveVehicles
            .filter(
              (vehicle) =>
                (vehicle.routeId === null ||
                  servesRoute(vehicle.routeId, routeId)) &&
                [path, ...alternativePaths].some((line) =>
                  isNearPath(vehicle, line, onRouteMeters),
                ),
            )
            .map((vehicle) =>
              vehicle.routeId !== routeId &&
              servesRoute(vehicle.routeId, routeId)
                ? { ...vehicle, routeId, routeName: route?.name ?? null }
                : vehicle,
            )
        : [],
    [liveVehicles, routeId, path, alternativePaths, route],
  );
  const vehiclesOnRoute = useMemo(() => {
    if (!myRideVehicle || !path) return routeVehicles;
    const onLine = [path, ...alternativePaths].some((line) =>
      isNearPath(myRideVehicle, line, onRouteMeters),
    );
    if (!onLine) return routeVehicles;
    return [
      routeVehicles.find((vehicle) => vehicle.id === myRideVehicle.id) ??
        myRideVehicle,
      ...routeVehicles.filter((vehicle) => vehicle.id !== myRideVehicle.id),
    ];
  }, [myRideVehicle, routeVehicles, path, alternativePaths]);
  const selectedVehicle =
    vehiclesOnRoute.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>("all");
  const filterVehicles = isSimulation() && vehicleFilter !== "all";
  const listedVehicles = useMemo(
    () =>
      filterVehicles
        ? vehiclesOnRoute.filter(
            (vehicle) => vehicle.generated === (vehicleFilter === "generated"),
          )
        : vehiclesOnRoute,
    [filterVehicles, vehicleFilter, vehiclesOnRoute],
  );

  const mapState = useMemo<TransitMapState>(
    () => ({
      routeId,
      route: path,
      alternativeRoutes: alternativePaths,
      waitingAreas: showWaitingAreas
        ? routeWaitingAreas.map(({ id, name, lat, lng, vicinity, type }) => ({
            id,
            name,
            lat,
            lng,
            tag: findVicinity(route?.vicinity ?? [], vicinity),
            kind: type,
          }))
        : [],
      showStops: showWaitingAreas,
      vehicles: vehiclesOnRoute.map((vehicle) => ({
        id: vehicle.id,
        lat: vehicle.lat,
        lng: vehicle.lng,
        type: vehicle.type,
        label: vehicle.routeName,
        occupancy: vehicle.occupancy,
        isFull: vehicle.isFull,
        stale: vehicle.stale,
        generated: vehicle.generated,
        highlight: vehicle.id === myRideId,
      })),
      pickups: destination
        ? [{ id: "destination", ...destination, label: destinationName }]
        : [],
      focus: null,
      fit:
        routeId && path?.length
          ? {
              key: `route:${routeId}:${path.length}`,
              points: [...path, ...alternativePaths.flat()],
            }
          : null,
      padTop: headerHeight + 30,
      padBottom: panelHeight + 70,
    }),
    [
      vehiclesOnRoute,
      myRideId,
      destination,
      destinationName,
      routeId,
      path,
      alternativePaths,
      route,
      routeWaitingAreas,
      showWaitingAreas,
      headerHeight,
      panelHeight,
    ],
  );

  const matchingRoutes = transitRoutes.filter((option) =>
    option.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const searchText = !query && !pickerOpen && route ? route.name : query;

  const selectRoute = (id: string) => {
    setRouteId(id);
    setPath(null);
    setLoadingRoute(true);
    setQuery(findRoute(id)?.name ?? "");
    setPickerOpen(false);
    Keyboard.dismiss();
  };

  const clearRoute = () => {
    setRouteId(null);
    setPath(null);
    setLoadingRoute(false);
    setQuery("");
    setPickerOpen(false);
    Keyboard.dismiss();
  };

  const goBack = () => goBackOr(Routes.commuterHome);

  const showVehicleList =
    !!route && !loadingRoute && !pickerOpen && panelExpanded;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <TransitMap
        state={mapState}
        onVehiclePress={setSelectedVehicleId}
        controls
        controlsTop={headerHeight + 12}
      />

      <View
        style={styles.headerWrap}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      >
        <ModuleHeader
          title="Routes"
          subtitle="View active vehicles, their locations and occupancy levels across your selected route."
          icon={<MapPin color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={goBack}
        />
      </View>

      {route && (
        <View style={[styles.layerFilters, { top: headerHeight + 12 }]}>
          <FilterChip
            label="Waiting areas"
            text="Waiting areas"
            active={showWaitingAreas}
            onPress={() => setShowWaitingAreas((current) => !current)}
          >
            <MapPinned color="#000000" size={20} strokeWidth={2} />
          </FilterChip>
        </View>
      )}

      {pickerOpen && (
        <KeyboardStickyView
          offset={{ opened: insets.bottom }}
          style={[styles.picker, { bottom: panelHeight - 8 }]}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            {matchingRoutes.length === 0 ? (
              <Text style={styles.pickerEmpty}>
                {transitRoutes.length === 0
                  ? "Nothing to see here yet. Routes will show up here once they’re added."
                  : "No routes found."}
              </Text>
            ) : (
              matchingRoutes.map((option) => (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  onPress={() => selectRoute(option.id)}
                  style={({ pressed }) => [
                    styles.pickerRow,
                    option.id === routeId && styles.pickerRowSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <MapPin color={headerBlue} size={16} strokeWidth={2} />
                  <Text style={styles.pickerText}>{option.name}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </KeyboardStickyView>
      )}

      <KeyboardStickyView
        offset={{ opened: insets.bottom }}
        style={styles.bottomDock}
        pointerEvents="box-none"
      >
        {route && (
          <View style={styles.chipRow}>
            <View style={styles.chipGroup}>
              {loadingRoute && (
                <View style={styles.chip}>
                  <LoadingLogo color="#ffffff" size={18} />
                  <Text style={styles.chipText}>Loading route...</Text>
                </View>
              )}
            </View>
            {!loadingRoute && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  panelExpanded ? "Minimize vehicle list" : "Show vehicle list"
                }
                accessibilityState={{ expanded: panelExpanded }}
                hitSlop={6}
                onPress={() => setPanelExpanded((current) => !current)}
                style={({ pressed }) => [
                  styles.panelToggle,
                  pressed && styles.pressed,
                ]}
              >
                {panelExpanded ? (
                  <ChevronsDown color="#ffffff" size={20} strokeWidth={2.5} />
                ) : (
                  <ChevronsUp color="#ffffff" size={20} strokeWidth={2.5} />
                )}
              </Pressable>
            )}
          </View>
        )}

        <View
          style={[styles.bottomPanel, { paddingBottom: insets.bottom + 16 }]}
          onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}
        >
          {!!route && (
            <Animated.View
              pointerEvents={showVehicleList ? "auto" : "none"}
              style={[
                styles.vehicleSection,
                showVehicleList
                  ? styles.vehicleSectionOpen
                  : styles.vehicleSectionClosed,
                slideTransition,
              ]}
            >
              <View style={styles.vehicleSectionHeader}>
                <View style={styles.vehicleTitleRow}>
                  <Text style={styles.vehicleSectionTitle}>
                    Vehicles in view
                  </Text>
                  {listedVehicles.length > 0 && (
                    <View style={styles.vehicleCount}>
                      <Text style={styles.vehicleCountText}>
                        {listedVehicles.length}
                      </Text>
                    </View>
                  )}
                </View>
                {isSimulation() && (
                  <View
                    accessibilityRole="radiogroup"
                    accessibilityLabel="Filter vehicles"
                    style={styles.vehicleFilter}
                  >
                    {vehicleFilters.map(({ value, label, Icon }) => {
                      const selected = value === vehicleFilter;
                      return (
                        <Pressable
                          key={value}
                          accessibilityRole="radio"
                          accessibilityLabel={label}
                          accessibilityState={{ checked: selected }}
                          hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
                          onPress={() => setVehicleFilter(value)}
                          style={[
                            styles.vehicleFilterOption,
                            selected && styles.vehicleFilterSelected,
                          ]}
                        >
                          <Icon
                            color={selected ? headerBlue : "#ffffff"}
                            size={15}
                            strokeWidth={2.2}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
              {listedVehicles.length === 0 ? (
                <Text style={styles.vehicleEmpty}>
                  {emptyVehicleText[filterVehicles ? vehicleFilter : "all"]}
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={vehicleCardWidth + vehicleCardGap}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  contentContainerStyle={styles.vehicleCarousel}
                >
                  {listedVehicles.map((vehicle) => (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      mine={vehicle.id === myRideId}
                      width={vehicleCardWidth}
                      onPress={() => setSelectedVehicleId(vehicle.id)}
                    />
                  ))}
                </ScrollView>
              )}
            </Animated.View>
          )}

          <View style={styles.searchPill}>
            <Search color={mutedText} size={18} strokeWidth={2} />
            <TextInput
              value={searchText}
              onChangeText={(value) => {
                setQuery(value);
                setPickerOpen(true);
              }}
              onFocus={() => setPickerOpen(true)}
              placeholder="Select Routes"
              placeholderTextColor={mutedText}
              style={styles.searchInput}
            />
            {(query.length > 0 || route) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear route search"
                hitSlop={8}
                onPress={clearRoute}
              >
                <X color={mutedText} size={18} strokeWidth={2} />
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardStickyView>

      <VehicleDetailsModal
        vehicle={selectedVehicle}
        onClose={() => setSelectedVehicleId(null)}
      />
    </View>
  );
}

function FilterChip({
  label,
  text,
  active,
  onPress,
  children,
}: {
  label: string;
  text?: string;
  active: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
    >
      <Animated.View
        style={[
          styles.chip,
          active ? styles.chipActive : styles.chipInactive,
          { transform: [{ scale: active ? 1.05 : 1 }] },
          chipTransition,
        ]}
      >
        <View style={styles.chipIconBackdrop}>{children}</View>
        {!!text && <Text style={styles.chipLabel}>{text}</Text>}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#e8eaed" },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0 },
  pressed: { opacity: 0.8 },
  layerFilters: {
    position: "absolute",
    left: 12,
    flexDirection: "row",
    gap: 8,
  },
  bottomDock: { position: "absolute", left: 0, right: 0, bottom: 0 },
  chipRow: {
    marginHorizontal: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  chipGroup: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  panelToggle: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: cardNavy,
  },
  chip: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 6,
    borderRadius: 9,
    backgroundColor: cardNavy,
  },
  chipActive: { backgroundColor: lightBlue },
  chipInactive: { backgroundColor: softBlue, opacity: 0.45 },
  chipIconBackdrop: {
    padding: 2,
    borderRadius: 6,
    backgroundColor: "#ffffff",
  },
  chipText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 12 },
  chipLabel: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 11,
    marginRight: 4,
  },
  picker: {
    position: "absolute",
    left: 16,
    right: 16,
    maxHeight: 240,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerRowSelected: { backgroundColor: "#e3ecfb" },
  pickerText: { color: text, fontFamily: "SoraBold", fontSize: 12 },
  pickerEmpty: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 12,
    padding: 16,
  },
  bottomPanel: {
    paddingTop: 16,
    paddingHorizontal: panelPadding,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: headerBlue,
  },
  vehicleSection: { overflow: "hidden", marginHorizontal: -panelPadding },
  vehicleSectionOpen: { maxHeight: 240, opacity: 1, marginBottom: 14 },
  vehicleSectionClosed: { maxHeight: 0, opacity: 0, marginBottom: 0 },
  vehicleSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: panelPadding,
  },
  vehicleTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  vehicleFilter: {
    flexDirection: "row",
    gap: 2,
    padding: 3,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  vehicleFilterOption: {
    width: 34,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    opacity: 0.7,
  },
  vehicleFilterSelected: { opacity: 1, backgroundColor: "#ffffff" },
  vehicleSectionTitle: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 13,
  },
  vehicleCount: {
    minWidth: 22,
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: lightBlue,
  },
  vehicleCountText: { color: headerBlue, fontFamily: "SoraBold", fontSize: 10 },
  vehicleCarousel: { gap: vehicleCardGap, paddingHorizontal: panelPadding },
  vehicleEmpty: {
    color: "rgba(255, 255, 255, 0.85)",
    fontFamily: "Sora",
    fontSize: 10,
    paddingVertical: 18,
    paddingHorizontal: panelPadding,
    textAlign: "center",
  },
  searchPill: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#f1f1f1",
  },
  searchInput: {
    flex: 1,
    padding: 0,
    color: text,
    fontFamily: "SoraBold",
    fontSize: 12,
  },
});
