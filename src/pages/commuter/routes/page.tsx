import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import MapPin from "lucide-react-native/icons/map-pin";
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
  getOccupancyLevel,
  getRouteVehicles,
  loadRouteGeometry,
  transitRoutes,
  vehicleTypeLabels,
  type LatLng,
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

export default function RoutesScreen() {
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(140);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [path, setPath] = useState<LatLng[] | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [activeTypes, setActiveTypes] = useState<VehicleType[]>(allTypes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const route = transitRoutes.find((option) => option.id === routeId) ?? null;

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

  const vehicles = useMemo(
    () => (route && path ? getRouteVehicles(route, path) : []),
    [route, path],
  );
  const visibleVehicles = useMemo(
    () => vehicles.filter((vehicle) => activeTypes.includes(vehicle.type)),
    [vehicles, activeTypes],
  );
  const selected = visibleVehicles.find((vehicle) => vehicle.id === selectedId);

  const bottomPanelHeight = insets.bottom + 84;

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
      selectedId: selected?.id ?? null,
      padTop: headerHeight + 30,
      padBottom: bottomPanelHeight + 70,
    }),
    [routeId, path, visibleVehicles, selected, headerHeight, bottomPanelHeight],
  );

  const matchingRoutes = transitRoutes.filter((option) =>
    option.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const selectRoute = (id: string) => {
    setRouteId(id);
    setPath(null);
    setLoadingRoute(true);
    setSelectedId(null);
    setActiveTypes(allTypes);
    setQuery(transitRoutes.find((option) => option.id === id)?.name ?? "");
    setPickerOpen(false);
    Keyboard.dismiss();
  };

  const clearRoute = () => {
    setRouteId(null);
    setPath(null);
    setLoadingRoute(false);
    setSelectedId(null);
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

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace(Routes.commuterHome);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <TransitMap state={mapState} onSelect={setSelectedId} />

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
        </View>
      )}

      {route && (
        <View style={[styles.chipRow, { bottom: bottomPanelHeight + 12 }]}>
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
        <View style={[styles.picker, { bottom: bottomPanelHeight - 8 }]}>
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

      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 16 }]}>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#e8eaed" },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0 },
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
