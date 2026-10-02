import { StatusBar } from "expo-status-bar";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import Clock from "lucide-react-native/icons/clock";
import Route from "lucide-react-native/icons/route";
import Users from "lucide-react-native/icons/users";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { vehicleTypeLabels } from "@/api/v1/transit-routes/controllers";
import { EmptyState } from "@/components/empty-state";
import { Chip, ModuleHeader, moduleColors } from "@/components/module-ui";
import { RouteTimeline } from "@/components/route-timeline";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import type { TransitTrip } from "@/pages/transit/types";
import { formatDuration } from "@/utils/format";
import { goBackOr } from "@/utils/navigation";

const { brandBlue, softBlue, mutedText, text } = moduleColors;

type Filter = "all" | TransitTrip["kind"];

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "regular", label: "Regular" },
  { value: "rental", label: "Rental" },
];

const completedTrips: TransitTrip[] = [];

const layoutTransition = LinearTransition.duration(200);

function groupByDate(trips: TransitTrip[]) {
  const groups: { date: string; trips: TransitTrip[] }[] = [];
  for (const trip of trips) {
    const group = groups.find((entry) => entry.date === trip.date);
    if (group) group.trips.push(trip);
    else groups.push({ date: trip.date, trips: [trip] });
  }
  return groups;
}

export default function TripHistoryScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const trips = completedTrips.filter(
    (trip) => filter === "all" || trip.kind === filter,
  );
  const totalPassengers = trips.reduce((sum, trip) => sum + trip.passengers, 0);
  const totalMinutes = trips.reduce(
    (sum, trip) => sum + trip.durationMinutes,
    0,
  );

  const goBack = () => goBackOr(Routes.transitHome);

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
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          <View style={styles.statRow}>
            <StatTile
              icon={<Route color={brandBlue} size={18} strokeWidth={2} />}
              value={String(trips.length)}
              label="Trips"
            />
            <StatTile
              icon={<Users color={brandBlue} size={18} strokeWidth={2} />}
              value={String(totalPassengers)}
              label="Passengers"
            />
            <StatTile
              icon={<Clock color={brandBlue} size={18} strokeWidth={2} />}
              value={`${Math.round(totalMinutes / 60)} hr`}
              label="On the road"
            />
          </View>

          <View style={styles.filterRow}>
            {filters.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={filter === option.value}
                onPress={() => {
                  setFilter(option.value);
                  setExpandedId(null);
                }}
                grow
              />
            ))}
          </View>

          {trips.length === 0 ? (
            <EmptyState
              icon={<Route color={brandBlue} size={32} strokeWidth={1.8} />}
              message="Trips you complete will show up here."
            />
          ) : (
            groupByDate(trips).map((group) => (
              <Animated.View key={group.date} layout={layoutTransition}>
                <Text style={styles.dateHeading}>{group.date}</Text>
                <View style={styles.list}>
                  {group.trips.map((trip) => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      expanded={expandedId === trip.id}
                      onPress={() =>
                        setExpandedId((current) =>
                          current === trip.id ? null : trip.id,
                        )
                      }
                    />
                  ))}
                </View>
              </Animated.View>
            ))
          )}
        </View>
      </Animated.ScrollView>

      <StickyHeader chrome={chrome}>
        <ModuleHeader
          title="Trip History"
          subtitle="Look back on your completed trips, passengers served and time on the road."
          icon={<Clock color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={goBack}
          collapsed={chrome.collapsed}
        />
      </StickyHeader>
    </View>
  );
}

function StatTile({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.statTile}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TripCard({
  trip,
  expanded,
  onPress,
}: {
  trip: TransitTrip;
  expanded: boolean;
  onPress: () => void;
}) {
  return (
    <Animated.View layout={layoutTransition} style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Trip from ${trip.from.city} to ${trip.to.city}`}
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
      >
        <RouteTimeline />

        <View style={styles.stops}>
          <View>
            <Text style={styles.city}>{trip.from.city}</Text>
            <Text style={styles.place}>{trip.from.place}</Text>
          </View>
          <View>
            <Text style={styles.city}>{trip.to.city}</Text>
            <Text style={styles.place}>{trip.to.place}</Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <View
            style={[
              styles.kindBadge,
              trip.kind === "rental" && styles.kindBadgeRental,
            ]}
          >
            <Text
              style={[
                styles.kindText,
                trip.kind === "rental" && styles.kindTextRental,
              ]}
            >
              {trip.kind === "rental" ? "Rental" : "Regular"}
            </Text>
          </View>
          <Text style={styles.time}>{trip.startTime}</Text>
        </View>

        <View style={expanded && styles.chevronOpen}>
          <ChevronDown color={brandBlue} size={20} strokeWidth={2.5} />
        </View>
      </Pressable>

      {expanded && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(120)}
          style={styles.details}
        >
          <DetailRow
            label="Vehicle"
            value={`${vehicleTypeLabels[trip.vehicle]} · ${trip.plate}`}
          />
          <DetailRow
            label="Time"
            value={`${trip.startTime} – ${trip.endTime}`}
          />
          <DetailRow
            label="Duration"
            value={formatDuration(trip.durationMinutes)}
          />
          <DetailRow label="Passengers" value={String(trip.passengers)} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  body: { paddingHorizontal: 12, paddingTop: 18 },
  pressed: { opacity: 0.85 },
  statRow: { flexDirection: "row", gap: 10 },
  statTile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: softBlue,
  },
  statValue: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 18,
    marginTop: 6,
  },
  statLabel: { color: mutedText, fontFamily: "Sora", fontSize: 9 },
  filterRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  dateHeading: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 12,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  list: { gap: 10 },
  card: {
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: "#1a2f8f",
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 10,
  },
  stops: { flex: 1, gap: 14, marginLeft: 12 },
  city: { color: brandBlue, fontFamily: "SoraBold", fontSize: 11 },
  place: { color: mutedText, fontFamily: "Sora", fontSize: 8, marginTop: 2 },
  cardMeta: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    alignSelf: "stretch",
    paddingVertical: 8,
    marginRight: 6,
  },
  kindBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: brandBlue,
  },
  kindBadgeRental: { backgroundColor: softBlue },
  kindText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 10 },
  kindTextRental: { color: brandBlue },
  time: { color: mutedText, fontFamily: "Sora", fontSize: 8 },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  details: {
    marginHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: "#eef1f7",
  },
  detailRow: { flexDirection: "row", gap: 12, paddingVertical: 6 },
  detailLabel: {
    width: 90,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
  },
  detailValue: { flex: 1, color: text, fontFamily: "SoraBold", fontSize: 11 },
});
