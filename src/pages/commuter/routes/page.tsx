import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import MapPin from "lucide-react-native/icons/map-pin";
import Navigation from "lucide-react-native/icons/navigation";
import Search from "lucide-react-native/icons/search";
import X from "lucide-react-native/icons/x";
import { useEffect, useMemo, useState } from "react";
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
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  findRoute,
  findTerminal,
  getOccupancyLevel,
  getRouteTerminals,
  getRouteVehicles,
  isInBounds,
  loadRouteGeometry,
  transitRoutes,
  vehicleTickMs,
  vehicleTypeLabels,
  type LatLng,
  type MapBounds,
  type RouteVehicle,
  type VehicleType,
} from "@/api/v1/transit-routes/controllers";
import {
  ModuleHeader,
  moduleColors,
  tileTransition,
  vehicleOptions,
} from "@/components/module-ui";
import { TransitMap, type TransitMapState } from "@/components/transit-map";
import { Routes } from "@/constants/routes";

const { brandBlue, headerBlue, mutedText, softBlue, text } = moduleColors;
const cardNavy = "#0f2a5c";

const allTypes: VehicleType[] = ["bus", "jeep", "tricy", "van"];

const vehicleIcons = Object.fromEntries(
  vehicleOptions.map((option) => [option.value, option.icon]),
) as Record<VehicleType, number>;

const occupancyColors: Record<string, string> = {
  Available: "#1e9e45",
  Moderate: "#e0a800",
  "Almost Full": "#e8710a",
  Full: "#d93025",
};

export default function RoutesScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    routeId?: string;
    terminalId?: string;
  }>();
  const initialRoute = findRoute(params.routeId);

  const [headerHeight, setHeaderHeight] = useState(140);
  const [panelHeight, setPanelHeight] = useState(insets.bottom + 84);
  const [routeId, setRouteId] = useState<string | null>(
    initialRoute?.id ?? null,
  );
  const [terminalId, setTerminalId] = useState<string | null>(
    initialRoute ? (findTerminal(params.terminalId)?.id ?? null) : null,
  );
  const [path, setPath] = useState<LatLng[] | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(!!initialRoute);
  const [activeTypes, setActiveTypes] = useState<VehicleType[]>(allTypes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState(initialRoute?.name ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [focus, setFocus] = useState<TransitMapState["focus"]>(null);

  const route = findRoute(routeId);

  useEffect(() => {
    if (!route) return;
    let active = true;
    loadRouteGeometry(route).then((geometry) => {
      if (!active) return;
      setPath(geometry);
      setLoadingRoute(false);
    });
    return () => {
      active = false;
    };
  }, [route]);

  useEffect(() => {
    if (!routeId) return;
    const timer = setInterval(() => setNow(Date.now()), vehicleTickMs);
    return () => clearInterval(timer);
  }, [routeId]);

  const vehicles = useMemo(
    () => (route && path ? getRouteVehicles(route, path, now) : []),
    [route, path, now],
  );
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
      vehicles: visibleVehicles.map(({ id, lat, lng, type }) => ({
        id,
        lat,
        lng,
        type,
      })),
      terminals: routeTerminals.map(({ id, name, lat, lng }) => ({
        id,
        name,
        lat,
        lng,
      })),
      highlightedTerminalId: terminalId,
      selectedId: selected?.id ?? null,
      focus,
      padTop: headerHeight + 30,
      padBottom: panelHeight + 70,
    }),
    [
      routeId,
      path,
      visibleVehicles,
      routeTerminals,
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

  const showVehicleList = !!route && !loadingRoute && !pickerOpen;

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

      {route && (
        <View style={[styles.chipRow, { bottom: panelHeight + 12 }]}>
          {loadingRoute ? (
            <View style={styles.chip}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.chipText}>Loading route...</Text>
            </View>
          ) : (
            allTypes.map((type) => {
              const active = activeTypes.includes(type);
              return (
                <Pressable
                  key={type}
                  accessibilityRole="button"
                  accessibilityLabel={`${vehicleTypeLabels[type]} vehicles`}
                  accessibilityState={{ selected: active }}
                  onPress={() => toggleType(type)}
                >
                  <Animated.View
                    style={[
                      styles.chip,
                      active ? styles.chipActive : styles.chipInactive,
                      { transform: [{ scale: active ? 1.05 : 1 }] },
                      tileTransition,
                    ]}
                  >
                    <View style={styles.chipIconBackdrop}>
                      <Image
                        source={vehicleIcons[type]}
                        style={styles.chipIcon}
                        tintColor="#000000"
                        contentFit="contain"
                      />
                    </View>
                    {active && (
                      <Text style={styles.chipText}>
                        {vehicleTypeLabels[type]}
                      </Text>
                    )}
                  </Animated.View>
                </Pressable>
              );
            })
          )}
        </View>
      )}

      {pickerOpen && (
        <View style={[styles.picker, { bottom: panelHeight - 8 }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {matchingRoutes.length === 0 ? (
              <Text style={styles.pickerEmpty}>No routes found.</Text>
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

      <View
        style={[styles.bottomPanel, { paddingBottom: insets.bottom + 16 }]}
        onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}
      >
        {showVehicleList && (
          <View style={styles.vehicleSection}>
            <View style={styles.vehicleSectionHeader}>
              <Text style={styles.vehicleSectionTitle}>Vehicles in view</Text>
              <Text style={styles.vehicleSectionCount}>
                {vehiclesInView.length} of {visibleVehicles.length} on route
              </Text>
            </View>
            {vehiclesInView.length === 0 ? (
              <Text style={styles.vehicleEmpty}>
                {visibleVehicles.length === 0
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
          </View>
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
  const level = getOccupancyLevel(
    vehicle.currentCapacity,
    vehicle.maxCapacity,
  );
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
            { width: `${fill * 100}%`, backgroundColor: occupancyColors[level] },
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
  chipRow: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  chipActive: { backgroundColor: brandBlue },
  chipInactive: { backgroundColor: softBlue },
  chipIconBackdrop: {
    padding: 2,
    borderRadius: 6,
    backgroundColor: "#ffffff",
  },
  chipIcon: { width: 20, height: 20 },
  chipText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 12 },
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
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: headerBlue,
  },
  vehicleSection: { marginBottom: 14 },
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
