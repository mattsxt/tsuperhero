import { router } from "expo-router";
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
  searchDestinations,
  type TransitRoute,
} from "@/api/v1/transit-routes/controllers";
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

  const openRoute = (route: TransitRoute) => {
    Keyboard.dismiss();
    onClose();
    router.push({
      pathname: Routes.commuterRoutes,
      params: { routeId: route.id },
    });
  };

  const openBestMatch = () => {
    if (query.trim() && routes[0]) openRoute(routes[0]);
  };

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  const { items, stickyIndices } = buildResultItems(query, routes, openRoute);

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, styles.searchCard]}>
        <MapPin color={brandBlue} size={28} strokeWidth={2} />
        <View style={styles.searchText}>
          <Text style={styles.searchTitle}>Where to?</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
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
            if (!query.trim()) setPopularHeight(height + borderAllowance);
          }}
        >
          {items}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function buildResultItems(
  query: string,
  routes: TransitRoute[],
  onOpenRoute: (route: TransitRoute) => void,
): { items: ReactElement[]; stickyIndices: number[] } {
  if (routes.length === 0) {
    return {
      items: [
        <Text key="empty" style={styles.empty}>
          No routes match “{query.trim()}”.
        </Text>,
      ],
      stickyIndices: [],
    };
  }

  const items: ReactElement[] = [
    <View key="routes-label" style={styles.sectionLabelWrap}>
      <Text style={styles.sectionLabel}>ROUTES</Text>
    </View>,
  ];
  routes.forEach((route) => {
    items.push(
      <Pressable
        key={route.id}
        accessibilityRole="button"
        accessibilityLabel={`View ${route.name} route`}
        onPress={() => onOpenRoute(route)}
        style={({ pressed }) => [
          styles.rowMain,
          styles.routeRow,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.rowIcon}>
          <MapPinSearch color={brandBlue} size={16} strokeWidth={2} />
        </View>
        <Text style={[styles.rowTitle, styles.rowText]}>{route.name}</Text>
        <ChevronRight color={brandBlue} size={16} strokeWidth={2.5} />
      </Pressable>,
    );
  });

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
});
