import { router } from "expo-router";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import MapPin from "lucide-react-native/icons/map-pin";
import MapPinSearch from "lucide-react-native/icons/map-pin-search";
import Search from "lucide-react-native/icons/search";
import X from "lucide-react-native/icons/x";
import { useEffect, useState, type ReactElement } from "react";
import {
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  createPlacesSession,
  minPlaceQueryLength,
  resolvePlace,
  searchPlaces,
  type Place,
  type PlaceSuggestion,
} from "@/api/v1/places/controllers";
import {
  findRoutesNear,
  nearDestinationMeters,
  searchDestinations,
  type RouteNearPlace,
  type TransitRoute,
} from "@/api/v1/transit-routes/controllers";
import { formatDistance } from "@/api/v1/waiting-areas/controllers";
import { LoadingSprite } from "@/components/brand-logo";
import { Routes } from "@/constants/routes";
import { useTransitRoutes } from "@/hooks/use-transit-routes";

const brandBlue = "#193caf";
const softBlue = "#e3ecfb";
const mutedText = "#6b6b6b";
const cardEdgeBlue = "#1a2f8f";

const bodyPaddingTop = 14;
const searchCardHeight = 60;
const cardGap = 8;
const bottomMargin = 16;
const borderAllowance = 3;
const placeSearchDelayMs = 300;

type ChosenPlace = { place: Place; routes: RouteNearPlace[] };

function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

export function DestinationSearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <Pressable
      accessibilityRole="search"
      accessibilityLabel="Where to? Enter your destination"
      onPress={onOpen}
      style={({ pressed }) => [
        styles.card,
        styles.searchCard,
        pressed && styles.pressed,
      ]}
    >
      <MapPin color={brandBlue} size={28} strokeWidth={2} />
      <View style={styles.searchText}>
        <Text style={styles.searchTitle}>Where to?</Text>
        <Text style={[styles.searchInput, styles.placeholder]}>
          Enter your Destination
        </Text>
      </View>
      <View style={styles.searchDivider} />
      <View style={styles.searchButton}>
        <Search color="#ffffff" size={20} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

export function DestinationSearchPanel({
  onClose,
  topOffset,
}: {
  onClose: () => void;
  topOffset: number;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight();
  const [query, setQuery] = useState("");
  const [popularHeight, setPopularHeight] = useState<number | null>(null);
  const [places, setPlaces] = useState<PlaceSuggestion[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<ChosenPlace | null>(null);
  const [placeProblem, setPlaceProblem] = useState("");
  // One Places session per search, renewed after a place is picked.
  const [session, setSession] = useState(createPlacesSession);

  // Google place suggestions, debounced while typing.
  useEffect(() => {
    const trimmed = query.trim();
    let active = true;
    const timer = setTimeout(async () => {
      if (trimmed.length < minPlaceQueryLength) {
        setPlaces([]);
        setSearchingPlaces(false);
        return;
      }
      setSearchingPlaces(true);
      const result = await searchPlaces(trimmed, session);
      if (!active) return;
      setPlaces(result.suggestions);
      setSearchingPlaces(false);
    }, placeSearchDelayMs);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, session]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        Keyboard.dismiss();
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onClose]);

  useTransitRoutes();
  const routes = searchDestinations(query);

  const availableHeight =
    windowHeight -
    topOffset -
    bodyPaddingTop -
    searchCardHeight -
    cardGap -
    bottomMargin -
    (keyboardHeight > 0 ? keyboardHeight : insets.bottom);
  const maxResultsHeight = Math.max(
    Math.min(popularHeight ?? availableHeight, availableHeight),
    120,
  );

  const openRoute = (route: TransitRoute, place?: Place) => {
    Keyboard.dismiss();
    onClose();
    router.push({
      pathname: Routes.commuterRoutes,
      params: place
        ? {
            routeId: route.id,
            destLat: String(place.lat),
            destLng: String(place.lng),
          }
        : { routeId: route.id },
    });
  };

  const choosePlace = async (suggestion: PlaceSuggestion) => {
    if (resolvingId) return;
    setResolvingId(suggestion.id);
    setPlaceProblem("");
    const result = await resolvePlace(suggestion, session);
    setSession(createPlacesSession());
    setResolvingId(null);
    if (!result.ok) {
      setPlaceProblem(result.error);
      return;
    }
    const nearby = findRoutesNear(result.data);
    if (nearby.length === 1) {
      openRoute(nearby[0].route, result.data);
      return;
    }
    Keyboard.dismiss();
    setChosen({ place: result.data, routes: nearby });
  };

  const changeQuery = (next: string) => {
    setQuery(next);
    setChosen(null);
    setPlaceProblem("");
  };

  const openBestMatch = () => {
    if (!query.trim()) return;
    if (routes[0]) openRoute(routes[0]);
    else if (places[0]) choosePlace(places[0]);
  };

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  const { items, stickyIndices } = chosen
    ? buildChosenItems(chosen, openRoute, () => setChosen(null))
    : buildResultItems({
        query,
        routes,
        places,
        searchingPlaces,
        resolvingId,
        placeProblem,
        onOpenRoute: openRoute,
        onChoosePlace: choosePlace,
      });

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, styles.searchCard]}>
        <MapPin color={brandBlue} size={28} strokeWidth={2} />
        <View style={styles.searchText}>
          <Text style={styles.searchTitle}>Where to?</Text>
          <TextInput
            value={query}
            onChangeText={changeQuery}
            onSubmitEditing={openBestMatch}
            autoFocus
            returnKeyType="search"
            placeholder="Enter your Destination"
            placeholderTextColor={mutedText}
            style={styles.searchInput}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close destination search"
          hitSlop={8}
          onPress={close}
        >
          <X color={mutedText} size={18} strokeWidth={2} />
        </Pressable>
        <View style={styles.searchDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search destination"
          onPress={openBestMatch}
          style={({ pressed }) => [
            styles.searchButton,
            pressed && styles.pressed,
          ]}
        >
          <Search color="#ffffff" size={20} strokeWidth={2.5} />
        </Pressable>
      </View>

      <Animated.View
        entering={FadeIn.duration(150)}
        style={[
          styles.card,
          styles.resultsCard,
          { maxHeight: maxResultsHeight },
        ]}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={stickyIndices}
          contentContainerStyle={styles.results}
          onContentSizeChange={(_width, height) => {
            if (!query.trim() && !chosen)
              setPopularHeight(height + borderAllowance);
          }}
        >
          {items}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <View style={styles.sectionLabelWrap}>
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

function RouteRow({
  route,
  detail,
  onPress,
}: {
  route: TransitRoute;
  detail?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${route.name} route`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowMain,
        styles.routeRow,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.rowIcon}>
        <MapPinSearch color={brandBlue} size={16} strokeWidth={2} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{route.name}</Text>
        {!!detail && <Text style={styles.rowDetail}>{detail}</Text>}
      </View>
      <ChevronRight color={brandBlue} size={16} strokeWidth={2.5} />
    </Pressable>
  );
}

function buildResultItems({
  query,
  routes,
  places,
  searchingPlaces,
  resolvingId,
  placeProblem,
  onOpenRoute,
  onChoosePlace,
}: {
  query: string;
  routes: TransitRoute[];
  places: PlaceSuggestion[];
  searchingPlaces: boolean;
  resolvingId: string | null;
  placeProblem: string;
  onOpenRoute: (route: TransitRoute) => void;
  onChoosePlace: (place: PlaceSuggestion) => void;
}): { items: ReactElement[]; stickyIndices: number[] } {
  const items: ReactElement[] = [];
  const stickyIndices: number[] = [];

  if (routes.length > 0) {
    stickyIndices.push(items.length);
    items.push(<SectionLabel key="routes-label" label="ROUTES" />);
    routes.forEach((route) =>
      items.push(
        <RouteRow
          key={route.id}
          route={route}
          onPress={() => onOpenRoute(route)}
        />,
      ),
    );
  }

  const placesActive = query.trim().length >= minPlaceQueryLength;
  if (placesActive && (places.length > 0 || searchingPlaces || placeProblem)) {
    stickyIndices.push(items.length);
    items.push(<SectionLabel key="places-label" label="PLACES" />);
    if (placeProblem) {
      items.push(
        <Text key="places-problem" style={styles.problem}>
          {placeProblem}
        </Text>,
      );
    }
    if (searchingPlaces && places.length === 0) {
      items.push(
        <View key="places-loading" style={styles.loadingRow}>
          <LoadingSprite size={18} />
        </View>,
      );
    }
    places.forEach((place) =>
      items.push(
        <Pressable
          key={place.id}
          accessibilityRole="button"
          accessibilityLabel={`Find routes to ${place.name}`}
          disabled={!!resolvingId}
          onPress={() => onChoosePlace(place)}
          style={({ pressed }) => [
            styles.rowMain,
            styles.routeRow,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.rowIcon, styles.placeIcon]}>
            <MapPin color="#ffffff" size={15} strokeWidth={2} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {place.name}
            </Text>
            {!!place.address && (
              <Text style={styles.rowDetail} numberOfLines={1}>
                {place.address}
              </Text>
            )}
          </View>
          {resolvingId === place.id ? (
            <LoadingSprite size={16} />
          ) : (
            <ChevronRight color={brandBlue} size={16} strokeWidth={2.5} />
          )}
        </Pressable>,
      ),
    );
  }

  if (items.length === 0) {
    items.push(
      <Text key="empty" style={styles.empty}>
        {placesActive
          ? `No routes or places match “${query.trim()}”.`
          : "Keep typing to search places."}
      </Text>,
    );
  }

  return { items, stickyIndices };
}

function buildChosenItems(
  { place, routes }: ChosenPlace,
  onOpenRoute: (route: TransitRoute, place: Place) => void,
  onBack: () => void,
): { items: ReactElement[]; stickyIndices: number[] } {
  const items: ReactElement[] = [
    <View key="chosen-label" style={styles.sectionLabelWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to search results"
        hitSlop={8}
        onPress={onBack}
        style={styles.chosenHeader}
      >
        <ArrowLeft color={brandBlue} size={14} strokeWidth={2.5} />
        <Text style={styles.sectionLabel} numberOfLines={1}>
          ROUTES NEAR {place.name.toUpperCase()}
        </Text>
      </Pressable>
    </View>,
  ];

  if (routes.length === 0) {
    items.push(
      <Text key="none" style={styles.empty}>
        No routes pass within {formatDistance(nearDestinationMeters)} of{" "}
        {place.name} yet.
      </Text>,
    );
  }
  routes.forEach(({ route, distanceMeters }) =>
    items.push(
      <RouteRow
        key={route.id}
        route={route}
        detail={
          distanceMeters < 25
            ? "Passes right by your destination"
            : `${formatDistance(distanceMeters)} walk from your destination`
        }
        onPress={() => onOpenRoute(route, place)}
      />,
    ),
  );

  return { items, stickyIndices: [0] };
}

const styles = StyleSheet.create({
  wrap: { gap: cardGap },
  pressed: { opacity: 0.7 },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: cardEdgeBlue,
    borderRadius: 10,
  },
  searchCard: {
    height: searchCardHeight,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  searchText: { flex: 1, marginLeft: 10, marginRight: 8 },
  searchTitle: { color: brandBlue, fontFamily: "SoraBold", fontSize: 13 },
  searchInput: {
    padding: 0,
    marginTop: 1,
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 9,
  },
  placeholder: { color: mutedText },
  searchDivider: {
    width: 1,
    height: 38,
    backgroundColor: "#d9d9d9",
    marginHorizontal: 12,
  },
  searchButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: brandBlue,
  },
  resultsCard: { overflow: "hidden" },
  results: { paddingBottom: 10, paddingHorizontal: 12 },
  sectionLabelWrap: {
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: "#ffffff",
  },
  sectionLabel: { color: brandBlue, fontFamily: "SoraBold", fontSize: 9 },
  empty: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    paddingVertical: 16,
    textAlign: "center",
  },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeRow: { paddingVertical: 8 },
  rowIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: softBlue,
  },
  rowText: { flex: 1 },
  rowTitle: { color: brandBlue, fontFamily: "SoraBold", fontSize: 11 },
  rowDetail: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 9,
    marginTop: 1,
  },
  placeIcon: { backgroundColor: "#c81e1e" },
  loadingRow: { paddingVertical: 10 },
  problem: {
    color: "#d93025",
    fontFamily: "Sora",
    fontSize: 10,
    paddingVertical: 8,
  },
  chosenHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
});
