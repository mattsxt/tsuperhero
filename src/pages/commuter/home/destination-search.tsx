import { router } from "expo-router";
import Building from "lucide-react-native/icons/building";
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
  type DestinationResults,
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
  const results = searchDestinations(query);

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

  const openRoute = (route: TransitRoute, terminalId?: string) => {
    Keyboard.dismiss();
    onClose();
    router.push({
      pathname: Routes.commuterRoutes,
      params: terminalId
        ? { routeId: route.id, terminalId }
        : { routeId: route.id },
    });
  };

  const openBestMatch = () => {
    const [terminal] = results.terminals;
    if (query.trim() && terminal?.routes[0]) {
      openRoute(terminal.routes[0], terminal.id);
    } else if (query.trim() && results.routes[0]) {
      openRoute(results.routes[0]);
    }
  };

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  const { items, stickyIndices } = buildResultItems(query, results, openRoute);

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
  results: DestinationResults,
  onOpenRoute: (route: TransitRoute, terminalId?: string) => void,
): { items: ReactElement[]; stickyIndices: number[] } {
  const items: ReactElement[] = [];
  const stickyIndices: number[] = [];

  const addLabel = (key: string, label: string) => {
    stickyIndices.push(items.length);
    items.push(
      <View key={key} style={styles.sectionLabelWrap}>
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>,
    );
  };

  if (results.terminals.length === 0 && results.routes.length === 0) {
    items.push(
      <Text key="empty" style={styles.empty}>
        No terminals or routes match “{query.trim()}”.
      </Text>,
    );
    return { items, stickyIndices };
  }

  if (results.terminals.length > 0) {
    addLabel(
      "terminals-label",
      query.trim() ? "TERMINALS" : "POPULAR TERMINALS",
    );
  }
  results.terminals.forEach((terminal) => {
    items.push(
      <View key={terminal.id} style={styles.terminalRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${terminal.name}, ${terminal.city}`}
          disabled={terminal.routes.length === 0}
          onPress={() => onOpenRoute(terminal.routes[0], terminal.id)}
          style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
        >
          <View style={styles.rowIcon}>
            <Building color={brandBlue} size={16} strokeWidth={2} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {terminal.name}
            </Text>
            <Text style={styles.rowSubtitle}>{terminal.city}</Text>
          </View>
        </Pressable>
        <View style={styles.routeChips}>
          {terminal.routes.map((route) => (
            <Pressable
              key={route.id}
              accessibilityRole="button"
              accessibilityLabel={`View ${route.name} route to ${terminal.name}`}
              onPress={() => onOpenRoute(route, terminal.id)}
              style={({ pressed }) => [
                styles.routeChip,
                pressed && styles.pressed,
              ]}
            >
              <MapPinSearch color={brandBlue} size={11} strokeWidth={2.2} />
              <Text style={styles.routeChipText}>{route.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>,
    );
  });

  if (results.routes.length > 0) addLabel("routes-label", "ROUTES");
  results.routes.forEach((route) => {
    items.push(
      <Pressable
        key={`route-${route.id}`}
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

  return { items, stickyIndices };
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
  terminalRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eef1f7",
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
  rowSubtitle: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 9,
    marginTop: 1,
  },
  routeChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
    marginLeft: 40,
  },
  routeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: softBlue,
  },
  routeChipText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 9 },
});
