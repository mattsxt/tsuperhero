import { StatusBar } from "expo-status-bar";
import BusFront from "lucide-react-native/icons/bus-front";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import Clock from "lucide-react-native/icons/clock";
import Gauge from "lucide-react-native/icons/gauge";
import Route from "lucide-react-native/icons/route";
import Timer from "lucide-react-native/icons/timer";
import Users from "lucide-react-native/icons/users";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  formatDuration,
  loadMyTrips,
  type TripRecord,
} from "@/api/v1/operator/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { StatusPill } from "@/components/card-badges";
import { EmptyState } from "@/components/empty-state";
import { Chip, ModuleHeader, moduleColors } from "@/components/module-ui";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { goBackOr } from "@/utils/navigation";

const { brandBlue, mutedText, softBlue, text, error } = moduleColors;
const cardEdgeBlue = "#1a2f8f";

type Period = "all" | "week" | "month";

const periods: { value: Period; label: string }[] = [
  { value: "all", label: "All" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

const emptyMessages: Record<Period, string> = {
  all: "Trips you complete will show up here.",
  week: "You haven't made any trips this week.",
  month: "You haven't made any trips this month.",
};

function periodStart(period: Period) {
  const now = new Date();
  if (period === "week") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    return start;
  }
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  return null;
}

const formatDay = (date: Date) =>
  date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatTime = (date: Date) =>
  date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const formatKm = (km: number) => `${km.toFixed(km < 10 ? 1 : 0)} km`;

export default function TripHistoryScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const [period, setPeriod] = useState<Period>("all");
  const [trips, setTrips] = useState<TripRecord[] | null>(null);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    let active = true;
    loadMyTrips().then((result) => {
      if (!active) return;
      if (result.ok) setTrips(result.data);
      else {
        setTrips([]);
        setProblem(result.error);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const start = periodStart(period);
    return (trips ?? []).filter(
      (trip) => !start || (trip.departedAt && trip.departedAt >= start),
    );
  }, [trips, period]);

  const totals = useMemo(
    () =>
      visible.reduce(
        (sum, trip) => ({
          minutes: sum.minutes + (trip.durationMinutes ?? 0),
          km: sum.km + trip.distanceKm,
          pickups: sum.pickups + trip.pickups,
        }),
        { minutes: 0, km: 0, pickups: 0 },
      ),
    [visible],
  );

  const goBack = () => goBackOr(Routes.transitHome);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Animated.ScrollView
        onScroll={chrome.scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: chrome.headerHeight,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          <View style={styles.tabRow}>
            {periods.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={period === option.value}
                onPress={() => setPeriod(option.value)}
                grow
              />
            ))}
          </View>

          {trips === null ? (
            <LoadingLogo style={styles.loading} />
          ) : visible.length === 0 ? (
            <View style={styles.centered}>
              {!!problem && <Text style={styles.problem}>{problem}</Text>}
              <EmptyState
                icon={<Route color={brandBlue} size={32} strokeWidth={1.8} />}
                message={emptyMessages[period]}
              />
            </View>
          ) : (
            <>
              <View style={styles.summary}>
                <SummaryTile
                  icon={<Route color={brandBlue} size={16} strokeWidth={2} />}
                  value={String(visible.length)}
                  label={visible.length === 1 ? "Trip" : "Trips"}
                />
                <SummaryTile
                  icon={<Users color={brandBlue} size={16} strokeWidth={2} />}
                  value={String(totals.pickups)}
                  label="Pickups"
                />
                <SummaryTile
                  icon={<Timer color={brandBlue} size={16} strokeWidth={2} />}
                  value={formatDuration(totals.minutes)}
                  label="On the road"
                />
                <SummaryTile
                  icon={<Gauge color={brandBlue} size={16} strokeWidth={2} />}
                  value={formatKm(totals.km)}
                  label="Distance"
                />
              </View>

              <View style={styles.list}>
                {visible.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </View>
            </>
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

function SummaryTile({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileIcon}>{icon}</View>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function TripCard({ trip }: { trip: TripRecord }) {
  const times = trip.departedAt
    ? `${formatTime(trip.departedAt)} – ${
        trip.arrivedAt ? formatTime(trip.arrivedAt) : "now"
      }`
    : "Time unavailable";
  const vehicle = [trip.plateNumber, trip.vehicleType]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.route} numberOfLines={2}>
          {trip.routeName}
        </Text>
        <StatusPill
          label={trip.inProgress ? "In progress" : "Completed"}
          tone={trip.inProgress ? "live" : "completed"}
        />
      </View>

      <View style={styles.details}>
        <Detail
          icon={<CalendarDays color={brandBlue} size={13} strokeWidth={2} />}
        >
          {trip.departedAt ? formatDay(trip.departedAt) : "Date unavailable"}
        </Detail>
        <Detail icon={<Clock color={brandBlue} size={13} strokeWidth={2} />}>
          {times}
        </Detail>
        <Detail icon={<Timer color={brandBlue} size={13} strokeWidth={2} />}>
          {trip.durationMinutes === null
            ? "—"
            : formatDuration(trip.durationMinutes)}
        </Detail>
        <Detail icon={<Gauge color={brandBlue} size={13} strokeWidth={2} />}>
          {formatKm(trip.distanceKm)}
        </Detail>
        <Detail icon={<Users color={brandBlue} size={13} strokeWidth={2} />}>
          {trip.pickups} {trip.pickups === 1 ? "pickup" : "pickups"}
        </Detail>
        {!!vehicle && (
          <Detail
            icon={<BusFront color={brandBlue} size={13} strokeWidth={2} />}
          >
            {vehicle}
          </Detail>
        )}
      </View>
    </View>
  );
}

function Detail({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.detail}>
      <View style={styles.detailIcon}>{icon}</View>
      <Text style={styles.detailText} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  flex: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 12, paddingTop: 18 },
  tabRow: { flexDirection: "row", gap: 6 },
  loading: { marginTop: 48 },
  centered: { flex: 1, justifyContent: "center" },
  problem: {
    color: error,
    fontFamily: "Sora",
    fontSize: 10,
    textAlign: "center",
  },
  summary: { flexDirection: "row", gap: 8, marginTop: 16 },
  tile: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: softBlue,
  },
  tileIcon: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },
  tileValue: { color: brandBlue, fontFamily: "SoraBold", fontSize: 13 },
  tileLabel: { color: mutedText, fontFamily: "Sora", fontSize: 8 },
  list: { gap: 10, marginTop: 16 },
  card: {
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: cardEdgeBlue,
    borderRadius: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  route: {
    flex: 1,
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 17,
    lineHeight: 22,
  },
  details: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  detail: {
    width: "50%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 6,
  },
  detailIcon: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: softBlue,
  },
  detailText: { flex: 1, color: text, fontFamily: "Sora", fontSize: 10 },
});
