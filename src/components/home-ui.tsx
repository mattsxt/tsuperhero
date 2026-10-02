import ArrowRight from "lucide-react-native/icons/arrow-right";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { RouteTimeline } from "@/components/route-timeline";
import {
  ExpandedOnly,
  headerLayoutTransition,
  headerTitleTransition,
} from "@/components/scroll-chrome";

export const homeColors = {
  brandBlue: "#193caf",
  mutedText: "#6b6b6b",
  cardBorder: "#e6e6e6",
  cardEdgeBlue: "#1a2f8f",
};

const { brandBlue, mutedText, cardBorder, cardEdgeBlue } = homeColors;

export function HomeHeader({
  firstName,
  subtitle,
  collapsed,
  topInset,
}: {
  firstName: string;
  subtitle: string;
  collapsed: boolean;
  topInset: number;
}) {
  return (
    <Animated.View
      layout={headerLayoutTransition}
      style={[
        styles.header,
        collapsed && styles.headerCollapsed,
        { paddingTop: topInset + (collapsed ? 10 : 20) },
      ]}
    >
      <View style={[styles.headerRow, collapsed && styles.headerRowCollapsed]}>
        <View style={styles.headerText}>
          <Animated.Text
            style={[
              styles.greeting,
              collapsed && styles.greetingCollapsed,
              headerTitleTransition,
            ]}
            numberOfLines={collapsed ? 1 : undefined}
          >
            Hello, {firstName}!
          </Animated.Text>
          <ExpandedOnly collapsed={collapsed}>
            <Text style={styles.subGreeting}>{subtitle}</Text>
          </ExpandedOnly>
        </View>
        <Image
          source={require("@/assets/images/tsuperhero_icon.png")}
          style={[styles.headerLogo, collapsed && styles.headerLogoCollapsed]}
          resizeMode="contain"
        />
      </View>
    </Animated.View>
  );
}

export function ActionRow({ children }: { children: ReactNode }) {
  return <View style={styles.actionRow}>{children}</View>;
}

export function ActionCard({
  title,
  description,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
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

export function SectionDivider() {
  return <View style={styles.sectionDivider} />;
}

export function SectionHeader({
  title,
  onViewAll,
  showViewAll = true,
}: {
  title: string;
  onViewAll?: () => void;
  showViewAll?: boolean;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {showViewAll && (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onViewAll}
          style={styles.viewAll}
        >
          <Text style={styles.viewAllText}>View All</Text>
          <ChevronRight color={brandBlue} size={16} strokeWidth={2.5} />
        </Pressable>
      )}
    </View>
  );
}

export type TripSummary = {
  id: string;
  from: { city: string; place: string };
  to: { city: string; place: string };
  date: string;
  badge: string;
  badgeIcon?: ReactNode;
};

export function TripList({ trips }: { trips: TripSummary[] }) {
  return (
    <View style={[styles.card, styles.tripList]}>
      {trips.map((trip, index) => (
        <TripRow key={trip.id} trip={trip} last={index === trips.length - 1} />
      ))}
    </View>
  );
}

function TripRow({ trip, last }: { trip: TripSummary; last: boolean }) {
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
      <RouteTimeline />

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
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{trip.badge}</Text>
          {trip.badgeIcon}
        </View>
        <Text style={styles.tripDate}>{trip.date}</Text>
      </View>

      <ChevronRight color={brandBlue} size={20} strokeWidth={2.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  headerCollapsed: { minHeight: 0, paddingBottom: 14 },
  headerRowCollapsed: { alignItems: "center" },
  greetingCollapsed: { fontSize: 17, lineHeight: 24 },
  headerLogo: { width: 60, height: 60 },
  headerLogoCollapsed: { width: 32, height: 32 },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: cardEdgeBlue,
    borderRadius: 10,
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
    textAlign: "center",
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
  sectionDivider: {
    height: 1,
    marginTop: 22,
    marginHorizontal: 8,
    backgroundColor: cardBorder,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
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
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: brandBlue,
  },
  badgeText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 10 },
  tripDate: { color: mutedText, fontFamily: "Sora", fontSize: 8 },
});
