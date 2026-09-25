import { BlurTargetView } from "expo-blur";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import Bus from "lucide-react-native/icons/bus";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import MapPin from "lucide-react-native/icons/map-pin";
import MapPinSearch from "lucide-react-native/icons/map-pin-search";
import Search from "lucide-react-native/icons/search";
import Star from "lucide-react-native/icons/star";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { loadCommuterHome } from "@/api/v1/profile/controllers";
import { BottomNav, bottomNavHeight } from "@/components/bottom-nav";
import { Routes } from "@/constants/routes";

const brandBlue = "#193caf";
const mutedText = "#6b6b6b";
const cardBorder = "#e6e6e6";
const cardEdgeBlue = "#1a2f8f";

type Trip = {
  id: string;
  from: { city: string; place: string };
  to: { city: string; place: string };
  date: string;
  rated: boolean;
};

const sampleTrips: Trip[] = [
  {
    id: "1",
    from: { city: "Naga City", place: "Bus Station" },
    to: { city: "Pili", place: "Diversion Bus Stop" },
    date: "Jul 1, 2026",
    rated: true,
  },
  {
    id: "2",
    from: { city: "Naga City", place: "Bus Station" },
    to: { city: "Iriga City", place: "Iriga Bus Stop" },
    date: "Jun 27, 2026",
    rated: true,
  },
  {
    id: "3",
    from: { city: "Naga City", place: "Bus Station" },
    to: { city: "Legazpi City", place: "SM Bus Stop" },
    date: "Jun 23, 2026",
    rated: false,
  },
];

export default function CommuterHomeScreen() {
  const insets = useSafeAreaInsets();
  const blurTarget = useRef<View | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const home = await loadCommuterHome();
      if ("redirect" in home) {
        router.replace(home.redirect);
        return;
      }
      if (active) setFirstName(home.firstName);
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  if (firstName === null) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={brandBlue} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <BlurTargetView ref={blurTarget} style={styles.blurTarget}>
        <ScrollView
          contentContainerStyle={{
            paddingBottom: insets.bottom + bottomNavHeight,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Text style={styles.greeting}>Hello, {firstName}!</Text>
                <Text style={styles.subGreeting}>
                  Connect with Available Drivers Nearby!
                </Text>
              </View>
              <Image
                source={require("@/assets/images/tsuperhero_icon.png")}
                style={styles.headerLogo}
                resizeMode="contain"
              />
            </View>
          </View>

          <View style={styles.body}>
            <View style={[styles.card, styles.searchCard]}>
              <MapPin color={brandBlue} size={28} strokeWidth={2} />
              <View style={styles.searchText}>
                <Text style={styles.searchTitle}>Where to?</Text>
                <TextInput
                  placeholder="Enter your Destination"
                  placeholderTextColor={mutedText}
                  style={styles.searchInput}
                />
              </View>
              <View style={styles.searchDivider} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Search destination"
                style={styles.searchButton}
              >
                <Search color="#ffffff" size={20} strokeWidth={2.5} />
              </Pressable>
            </View>

            <View style={styles.actionRow}>
              <ActionCard
                title="Routes"
                description="Find the best routes for you"
                icon={
                  <MapPinSearch color={brandBlue} size={40} strokeWidth={1.8} />
                }
              />
              <ActionCard
                title="Rental"
                description="Rent a vehicle for your trip"
                icon={<Bus color={brandBlue} size={40} strokeWidth={1.8} />}
              />
              <ActionCard
                title="Pickup"
                description="Schedule a pickup easily"
                icon={<PickupIcon size={40} />}
              />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Trip History</Text>
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                style={styles.viewAll}
              >
                <Text style={styles.viewAllText}>View All</Text>
                <ChevronRight color={brandBlue} size={16} strokeWidth={2.5} />
              </Pressable>
            </View>

            <View style={[styles.card, styles.tripList]}>
              {sampleTrips.map((trip, index) => (
                <TripRow
                  key={trip.id}
                  trip={trip}
                  last={index === sampleTrips.length - 1}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </BlurTargetView>

      <BottomNav
        active="home"
        homeRoute={Routes.commuterHome}
        blurTarget={blurTarget}
      />
    </View>
  );
}

function ActionCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.card,
        styles.actionCard,
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDescription}>{description}</Text>
      <View style={styles.actionArrow}>
        <ArrowRight color="#ffffff" size={15} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

function TripRow({ trip, last }: { trip: Trip; last: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Trip from ${trip.from.city} to ${trip.to.city}`}
      style={({ pressed }) => [
        styles.tripRow,
        !last && styles.tripRowDivider,
        pressed && styles.tripRowPressed,
      ]}
    >
      <View style={styles.timeline}>
        <View style={styles.timelineStart} />
        <View style={styles.timelineLine} />
        <View style={styles.timelineEnd} />
      </View>

      <View style={styles.tripStops}>
        <View>
          <Text style={styles.tripCity}>{trip.from.city}</Text>
          <Text style={styles.tripPlace}>{trip.from.place}</Text>
        </View>
        <View>
          <Text style={styles.tripCity}>{trip.to.city}</Text>
          <Text style={styles.tripPlace}>{trip.to.place}</Text>
        </View>
      </View>

      <View style={styles.tripMeta}>
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>
            {trip.rated ? "Rated" : "Not Rated"}
          </Text>
          <Star color="#ffffff" size={13} strokeWidth={2} />
        </View>
        <Text style={styles.tripDate}>{trip.date}</Text>
      </View>

      <ChevronRight color={brandBlue} size={20} strokeWidth={2.5} />
    </Pressable>
  );
}

function PickupIcon({ size }: { size: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={brandBlue}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx={10} cy={7.5} r={4.5} />
      <Path d="M2.5 21a7.5 7.5 0 0 1 12-6" />
      <Path d="M19 21.5v-7" />
      <Path d="m16 17.5 3-3 3 3" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  screen: { flex: 1, backgroundColor: "#ffffff" },
  blurTarget: { flex: 1 },
  header: {
    minHeight: 150,
    paddingHorizontal: 24,
    paddingBottom: 40,
    backgroundColor: "#1034A6",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerText: { flex: 1, paddingRight: 12 },
  greeting: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 21,
    lineHeight: 28,
  },
  subGreeting: {
    color: "#ffffff",
    fontFamily: "Sora",
    fontSize: 9,
    marginTop: 4,
  },
  headerLogo: { width: 60, height: 60 },
  body: { paddingHorizontal: 12, paddingTop: 14 },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: cardEdgeBlue,
    borderRadius: 10,
  },
  searchCard: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  searchText: { flex: 1, marginLeft: 10 },
  searchTitle: { color: brandBlue, fontFamily: "SoraBold", fontSize: 13 },
  searchInput: {
    padding: 0,
    marginTop: 1,
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 9,
  },
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
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 18,
    marginTop: 18,
  },
  actionCard: {
    flex: 1,
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  pressed: { opacity: 0.85 },
  actionTitle: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 11,
    marginTop: 12,
  },
  actionDescription: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 8,
    lineHeight: 11,
    textAlign: "center",
    marginTop: 4,
    minHeight: 22,
  },
  actionArrow: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: brandBlue,
    marginTop: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  sectionTitle: { color: brandBlue, fontFamily: "SoraBold", fontSize: 15 },
  viewAll: { flexDirection: "row", alignItems: "center", gap: 6 },
  viewAllText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 10 },
  tripList: { overflow: "hidden" },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 10,
  },
  tripRowDivider: { borderBottomWidth: 1, borderBottomColor: cardBorder },
  tripRowPressed: { backgroundColor: "#f4f6fc" },
  timeline: { alignItems: "center", alignSelf: "stretch", paddingVertical: 4 },
  timelineStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: brandBlue,
  },
  timelineLine: { flex: 1, width: 2, backgroundColor: brandBlue },
  timelineEnd: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: brandBlue,
    backgroundColor: "#ffffff",
  },
  tripStops: { flex: 1, gap: 14, marginLeft: 12 },
  tripCity: { color: brandBlue, fontFamily: "SoraBold", fontSize: 11 },
  tripPlace: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 8,
    marginTop: 2,
  },
  tripMeta: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    alignSelf: "stretch",
    paddingVertical: 8,
    marginRight: 6,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: brandBlue,
  },
  ratingText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 10 },
  tripDate: { color: mutedText, fontFamily: "Sora", fontSize: 8 },
});
