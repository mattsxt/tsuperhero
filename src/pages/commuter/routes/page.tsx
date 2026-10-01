import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Bus from "lucide-react-native/icons/bus";
import ChevronsDown from "lucide-react-native/icons/chevrons-down";
import ChevronsUp from "lucide-react-native/icons/chevrons-up";
import MapPin from "lucide-react-native/icons/map-pin";
import Navigation from "lucide-react-native/icons/navigation";
import PersonStanding from "lucide-react-native/icons/person-standing";
import Search from "lucide-react-native/icons/search";
import X from "lucide-react-native/icons/x";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  type CSSTransitionProperties,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  findRoute,
  findTerminal,
  getOccupancyLevel,
  getRouteTerminals,
  isInBounds,
  loadAlternativeGeometry,
  loadRouteGeometry,
  vehicleTypeLabels,
  type LatLng,
  type MapBounds,
  type RouteVehicle,
  type VehicleType,
} from "@/api/v1/transit-routes/controllers";
import {
  findWaitingAreasOnRoute,
  loadWaitingAreas,
  type WaitingArea,
} from "@/api/v1/waiting-areas/controllers";
import {
  ModuleHeader,
  moduleColors,
  vehicleOptions,
} from "@/components/module-ui";
import { TransitMap, type TransitMapState } from "@/components/transit-map";
import { Routes } from "@/constants/routes";
import { useTransitRoutes } from "@/hooks/use-transit-routes";

const { brandBlue, headerBlue, mutedText, softBlue, text } = moduleColors;
const cardNavy = "#0f2a5c";
const lightBlue = "#a8dcf7";

const activeVehicles: RouteVehicle[] = [];

const allTypes: VehicleType[] = ["bus", "jeep", "tricy", "van"];

const vehicleIcons = Object.fromEntries(
  vehicleOptions.map((option) => [option.value, option.icon]),
) as Record<VehicleType, number>;

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

const occupancyColors: Record<string, string> = {
  Available: "#1e9e45",
  Moderate: "#e0a800",
  "Almost Full": "#e8710a",
  Full: "#d93025",
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
  const params = useLocalSearchParams<{
    routeId?: string;
    terminalId?: string;
  }>();
  const transitRoutes = useTransitRoutes();
  const initialRoute = findRoute(params.routeId);

  const [headerHeight, setHeaderHeight] = useState(140);
  const [panelHeight, setPanelHeight] = useState(insets.bottom + 84);
  const [routeId, setRouteId] = useState<string | null>(params.routeId ?? null);
  const [terminalId, setTerminalId] = useState<string | null>(
    params.routeId ? (findTerminal(params.terminalId)?.id ?? null) : null,
  );
  const [path, setPath] = useState<LatLng[] | null>(null);
  const [alternativePaths, setAlternativePaths] = useState<LatLng[][]>([]);
  const [waitingAreas, setWaitingAreas] = useState<WaitingArea[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(!!params.routeId);
  const [activeTypes, setActiveTypes] = useState<VehicleType[]>(allTypes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState(initialRoute?.name ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [showTerminals, setShowTerminals] = useState(true);
  const [showWaitingAreas, setShowWaitingAreas] = useState(true);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [focus, setFocus] = useState<TransitMapState["focus"]>(null);

  const route = findRoute(routeId);

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
        ? findWaitingAreasOnRoute(waitingAreas, routeId, [
            path,
            ...alternativePaths,
          ])
        : [],
    [waitingAreas, routeId, path, alternativePaths],
  );

  const vehicles = activeVehicles;
  const visibleVehicles = useMemo(
    () => vehicles.filter((vehicle) => activeTypes.includes(vehicle.type)),
    [vehicles, activeTypes],
  );
  const vehiclesInView = useMemo(
    () => visibleVehicles.filter((vehicle) => isInBounds(vehicle, bounds)),
    [visibleVehicles, bounds],
  );
  const selected = visibleVehicles.find((vehicle) => vehicle.id === selectedId);
  const routeTerminals = useMemo(
    () => (routeId ? getRouteTerminals(routeId) : []),
    [routeId],
  );

  const mapState = useMemo<TransitMapState>(
    () => ({
      routeId,
      route: path,
      alternativeRoutes: alternativePaths,
      waitingAreas: showWaitingAreas
        ? routeWaitingAreas.map(({ id, name, lat, lng, vicinity }) => ({
            id,
            name,
            lat,
            lng,
            tag: findVicinity(route?.vicinity ?? [], vicinity),
          }))
        : [],
      vehicles: visibleVehicles.map(({ id, lat, lng, type }) => ({
        id,
        lat,
        lng,
        type,
      })),
      terminals: showTerminals
        ? routeTerminals.map(({ id, name, lat, lng }) => ({
            id,
            name,
            lat,
            lng,
          }))
        : [],
      highlightedTerminalId: terminalId,
      selectedId: selected?.id ?? null,
      focus,
      padTop: headerHeight + 30,
      padBottom: panelHeight + 70,
    }),
    [
      routeId,
      path,
      alternativePaths,
      route,
      routeWaitingAreas,
      showWaitingAreas,
      visibleVehicles,
      routeTerminals,
      showTerminals,
      terminalId,
      selected,
      focus,
      headerHeight,
      panelHeight,
    ],
  );

  const matchingRoutes = transitRoutes.filter((option) =>
    option.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const selectRoute = (id: string) => {
    setRouteId(id);
    setTerminalId(null);
    setPath(null);
    setLoadingRoute(true);
    setSelectedId(null);
    setFocus(null);
    setActiveTypes(allTypes);
    setQuery(findRoute(id)?.name ?? "");
    setPickerOpen(false);
    Keyboard.dismiss();
  };

  const clearRoute = () => {
    setRouteId(null);
    setTerminalId(null);
    setPath(null);
    setLoadingRoute(false);
    setSelectedId(null);
    setFocus(null);
    setActiveTypes(allTypes);
    setQuery("");
    setPickerOpen(false);
    Keyboard.dismiss();
  };

  const toggleType = (type: VehicleType) => {
    setActiveTypes((current) =>
      current.includes(type)
        ? current.filter((value) => value !== type)
        : [...current, type],
    );
  };

  const focusVehicle = (vehicle: RouteVehicle) => {
    if (vehicle.id === selectedId) {
      setSelectedId(null);
      return;
    }
    setSelectedId(vehicle.id);
    setFocus((current) => ({
      key: (current?.key ?? 0) + 1,
      lat: vehicle.lat,
      lng: vehicle.lng,
    }));
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(Routes.commuterHome);
  };

  const showVehicleList =
    !!route && !loadingRoute && !pickerOpen && panelExpanded;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <TransitMap
        state={mapState}
        onSelect={setSelectedId}
        onBoundsChange={setBounds}
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
            label="Terminals"
            text="Terminals"
            active={showTerminals}
            onPress={() => setShowTerminals((current) => !current)}
          >
            <Bus color="#000000" size={20} strokeWidth={2} />
          </FilterChip>
          <FilterChip
            label="Waiting areas"
            text="Waiting Areas"
            active={showWaitingAreas}
            onPress={() => setShowWaitingAreas((current) => !current)}
          >
            <PersonStanding color="#000000" size={20} strokeWidth={2} />
          </FilterChip>
        </View>
      )}

      {selected && (
        <View style={[styles.infoCard, { top: headerHeight + 12 }]}>
          <View style={styles.infoHeader}>
            <View style={styles.infoIconBackdrop}>
              <Image
                source={vehicleIcons[selected.type]}
                style={styles.infoIcon}
                tintColor="#000000"
                contentFit="contain"
              />
            </View>
            <View>
              <Text style={styles.infoPlate}>{selected.plate}</Text>
              <Text style={styles.infoType}>
                {vehicleTypeLabels[selected.type]}
              </Text>
            </View>
          </View>
          <Text style={styles.infoLine}>
            Max Capacity: {selected.maxCapacity}
          </Text>
          <Text style={styles.infoLine}>
            Current Capacity: {selected.currentCapacity}
          </Text>
          <Text style={styles.infoLine}>
            Occupancy Level:{" "}
            {getOccupancyLevel(selected.currentCapacity, selected.maxCapacity)}
          </Text>
          <Text style={styles.infoLine}>Status: {selected.status}</Text>
          <Text style={styles.infoLine}>Towards: {selected.towards}</Text>
        </View>
      )}

      {pickerOpen && (
        <View style={[styles.picker, { bottom: panelHeight - 8 }]}>
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
        </View>
      )}

      <View style={styles.bottomDock} pointerEvents="box-none">
        {route && (
          <View style={styles.chipRow}>
            <View style={styles.chipGroup}>
              {loadingRoute ? (
                <View style={styles.chip}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.chipText}>Loading route...</Text>
                </View>
              ) : (
                allTypes.map((type) => {
                  const active = activeTypes.includes(type);
                  return (
                    <FilterChip
                      key={type}
                      label={`${vehicleTypeLabels[type]} vehicles`}
                      active={active}
                      onPress={() => toggleType(type)}
                    >
                      <Image
                        source={vehicleIcons[type]}
                        style={styles.chipIcon}
                        tintColor="#000000"
                        contentFit="contain"
                      />
                    </FilterChip>
                  );
                })
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
                <Text style={styles.vehicleSectionTitle}>Vehicles in view</Text>
                <Text style={styles.vehicleSectionCount}>
                  {vehiclesInView.length} of {visibleVehicles.length} on route
                </Text>
              </View>
              {vehiclesInView.length === 0 ? (
                <Text style={styles.vehicleEmpty}>
                  {vehicles.length === 0
                    ? "Nothing to see here yet. Active vehicles on this route will show up here."
                    : visibleVehicles.length === 0
                      ? "Turn on a vehicle type to see vehicles."
                      : "No vehicles in view. Zoom out or pan along the route."}
                </Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.vehicleList}
                >
                  {vehiclesInView.map((vehicle) => (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      selected={vehicle.id === selectedId}
                      onPress={() => focusVehicle(vehicle)}
                    />
                  ))}
                </ScrollView>
              )}
            </Animated.View>
          )}

          <View style={styles.searchPill}>
            <Search color={mutedText} size={18} strokeWidth={2} />
            <TextInput
              value={query}
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
      </View>
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

function VehicleCard({
  vehicle,
  selected,
  onPress,
}: {
  vehicle: RouteVehicle;
  selected: boolean;
  onPress: () => void;
}) {
  const level = getOccupancyLevel(vehicle.currentCapacity, vehicle.maxCapacity);
  const fill = Math.min(vehicle.currentCapacity / vehicle.maxCapacity, 1);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${vehicleTypeLabels[vehicle.type]} ${vehicle.plate}, ${level}, ${vehicle.status}, towards ${vehicle.towards}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.vehicleCard,
        selected && styles.vehicleCardSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.vehicleCardTop}>
        <View style={styles.vehicleIconBackdrop}>
          <Image
            source={vehicleIcons[vehicle.type]}
            style={styles.vehicleIcon}
            tintColor="#000000"
            contentFit="contain"
          />
        </View>
        <View style={styles.flex}>
          <Text style={styles.vehiclePlate} numberOfLines={1}>
            {vehicle.plate}
          </Text>
          <Text style={styles.vehicleMeta} numberOfLines={1}>
            {vehicleTypeLabels[vehicle.type]} · {vehicle.status}
          </Text>
        </View>
      </View>

      <View style={styles.occupancyTrack}>
        <View
          style={[
            styles.occupancyFill,
            {
              width: `${fill * 100}%`,
              backgroundColor: occupancyColors[level],
            },
          ]}
        />
      </View>
      <Text style={styles.vehicleMeta} numberOfLines={1}>
        {vehicle.currentCapacity}/{vehicle.maxCapacity} · {level}
      </Text>
      <View style={styles.towardsRow}>
        <Navigation color={brandBlue} size={10} strokeWidth={2.5} />
        <Text style={styles.towardsText} numberOfLines={1}>
          To {vehicle.towards}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#e8eaed" },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0 },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  infoCard: {
    position: "absolute",
    right: 12,
    width: 190,
    padding: 12,
    borderRadius: 10,
    backgroundColor: cardNavy,
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  infoIconBackdrop: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  infoIcon: { width: 28, height: 28 },
  infoPlate: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 17 },
  infoType: { color: "#ffffff", fontFamily: "Sora", fontSize: 8 },
  infoLine: {
    color: "#ffffff",
    fontFamily: "Sora",
    fontSize: 9,
    lineHeight: 14,
  },
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
  chipIcon: { width: 20, height: 20 },
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
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: headerBlue,
  },
  vehicleSection: { overflow: "hidden" },
  vehicleSectionOpen: { maxHeight: 240, opacity: 1, marginBottom: 14 },
  vehicleSectionClosed: { maxHeight: 0, opacity: 0, marginBottom: 0 },
  vehicleSectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  vehicleSectionTitle: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 13,
  },
  vehicleSectionCount: {
    color: "rgba(255, 255, 255, 0.8)",
    fontFamily: "Sora",
    fontSize: 10,
  },
  vehicleEmpty: {
    color: "rgba(255, 255, 255, 0.85)",
    fontFamily: "Sora",
    fontSize: 10,
    paddingVertical: 18,
    textAlign: "center",
  },
  vehicleList: { gap: 10, paddingRight: 4 },
  vehicleCard: {
    width: 150,
    padding: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "#ffffff",
  },
  vehicleCardSelected: { borderColor: "#1e9e45" },
  vehicleCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  vehicleIconBackdrop: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: softBlue,
  },
  vehicleIcon: { width: 20, height: 20 },
  vehiclePlate: { color: brandBlue, fontFamily: "SoraBold", fontSize: 12 },
  vehicleMeta: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 9,
    marginTop: 2,
  },
  occupancyTrack: {
    height: 5,
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: "#e6e9f0",
  },
  occupancyFill: { height: "100%", borderRadius: 3 },
  towardsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  towardsText: {
    flex: 1,
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 9,
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
