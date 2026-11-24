import { StatusBar } from "expo-status-bar";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import Clock from "lucide-react-native/icons/clock";
import Gauge from "lucide-react-native/icons/gauge";
import IdCard from "lucide-react-native/icons/id-card";
import Route from "lucide-react-native/icons/route";
import Timer from "lucide-react-native/icons/timer";
import Users from "lucide-react-native/icons/users";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  formatDuration,
  loadMyTrips,
  type TripRecord,
} from "@/api/v1/operator/controllers";
import {
  StatusPill,
  vehicleTypeCode,
  VehicleTypeBadge,
} from "@/components/card-badges";
import {
  HistoryEmpty,
  HistoryFilter,
  ShowMoreButton,
} from "@/components/history-filter";
import { ModuleHeader, moduleColors } from "@/components/module-ui";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { goBackOr } from "@/utils/navigation";
import {
  defaultHistoryPeriod,
  filterHistory,
  type HistoryPeriod,
} from "@/utils/history-filter";
import { ErrorAlert } from "@/components/error-alert";
import { SkeletonCards } from "@/components/skeleton";
import { historyPageSize, useIncremental } from "@/hooks/use-incremental";
import { useNow } from "@/hooks/use-now";

const { brandBlue, mutedText, softBlue, text } = moduleColors;
const cardEdgeBlue = "#1a2f8f";

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

const formatHours = (minutes: number) => {
  if (minutes < 60) return `${minutes}m`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)}h${rest ? ` ${rest}m` : ""}`;
};

export default function TripHistoryScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const [period, setPeriod] = useState<HistoryPeriod>(defaultHistoryPeriod);
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query);
  const now = useNow(60_000);
  const [trips, setTrips] = useState<TripRecord[] | null>(null);
  const [problem, setProblem] = useState("");

  const [refreshing, setRefreshing] = useState(false);
  const applyTrips = (result: Awaited<ReturnType<typeof loadMyTrips>>) => {
    if (result.ok) {
      setTrips(result.data);
      setProblem("");
    } else {
      setTrips((current) => current ?? []);
      setProblem(result.error);
    }
  };

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

  const pullRefresh = async () => {
    setRefreshing(true);
    applyTrips(await loadMyTrips());
    setRefreshing(false);
  };

  const view = useMemo(
    () =>
      filterHistory(trips ?? [], {
        period,
        query: search,
        now: new Date(now),
        dateOf: (trip) => trip.departedAt,
        searchFields: (trip) => [
          trip.routeName,
          trip.plateNumber,
          trip.vehicleType,
          trip.code,
          trip.departedAt ? formatDay(trip.departedAt) : null,
        ],
      }),
    [trips, period, search, now],
  );
  const visible = view.visible;
  const page = useIncremental(visible, `${period}|${search}`);

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={pullRefresh}
            tintColor={brandBlue}
            colors={[brandBlue]}
            progressViewOffset={chrome.headerHeight}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          <HistoryFilter
            period={period}
            onPeriodChange={setPeriod}
            query={query}
            onQueryChange={setQuery}
            placeholder="Search route, plate or date"
          />

          {trips === null ? (
            <SkeletonCards style={styles.loading} />
          ) : visible.length === 0 ? (
            <View style={styles.centered}>
              {!!problem && (
                <ErrorAlert
                  title="Trip history"
                  message={problem}
                  style={styles.problem}
                />
              )}
              <HistoryEmpty
                icon={<Route color={brandBlue} size={32} strokeWidth={1.8} />}
                noun={{ one: "trip", many: "trips" }}
                emptyMessage="Trips you complete will show up here."
                period={period}
                query={search}
                view={view}
                onShowAll={() => setPeriod("all")}
                onClearSearch={() => setQuery("")}
              />
            </View>
          ) : (
            <>
              {!!problem && (
                <ErrorAlert
                  title="Trip history"
                  message={problem}
                  style={styles.problemInline}
                />
              )}
              <View
                accessible
                accessibilityLabel={`${visible.length} ${visible.length === 1 ? "trip" : "trips"}, ${totals.pickups} pickups, ${formatDuration(totals.minutes)} on the road, ${formatKm(totals.km)}`}
                style={styles.summary}
              >
                <Stat
                  value={String(visible.length)}
                  label={visible.length === 1 ? "Trip" : "Trips"}
                />
                <Stat value={String(totals.pickups)} label="Pickups" />
                <Stat value={formatHours(totals.minutes)} label="On road" />
                <Stat value={formatKm(totals.km)} label="Distance" />
              </View>

              <View style={styles.list}>
                {page.shown.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </View>
              <ShowMoreButton
                remaining={page.remaining}
                step={historyPageSize}
                noun={{ one: "trip", many: "trips" }}
                onPress={page.showMore}
              />
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
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
  const hasVehicle = !!trip.plateNumber || !!vehicleTypeCode(trip.vehicleType);
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
        {hasVehicle && (
          <Detail
            icon={<IdCard color={brandBlue} size={13} strokeWidth={2} />}
            trailing={<VehicleTypeBadge type={trip.vehicleType} />}
          >
            {trip.plateNumber}
          </Detail>
        )}
      </View>
    </View>
  );
}

function Detail({
  icon,
  trailing,
  children,
}: {
  icon: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.detail}>
      <View style={styles.detailIcon}>{icon}</View>
      {!!children && (
        <Text
          style={[styles.detailText, !trailing && styles.detailTextGrow]}
          numberOfLines={1}
        >
          {children}
        </Text>
      )}
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  flex: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 12, paddingTop: 18 },
  loading: { marginTop: 48 },
  centered: { flex: 1, justifyContent: "center" },
  problem: { alignSelf: "stretch", marginBottom: 12 },
  problemInline: { marginTop: 16 },
  summary: {
    flexDirection: "row",
    marginTop: 18,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#d5dceb",
  },
  stat: { flex: 1, gap: 2, paddingHorizontal: 4 },
  statValue: { color: text, fontFamily: "SoraBold", fontSize: 15 },
  statLabel: { color: mutedText, fontFamily: "Sora", fontSize: 10 },
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
  detailText: { color: text, fontFamily: "Sora", fontSize: 10 },
  detailTextGrow: { flex: 1 },
});
