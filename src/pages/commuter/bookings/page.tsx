import { StatusBar } from "expo-status-bar";
import Bus from "lucide-react-native/icons/bus";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import ClipboardList from "lucide-react-native/icons/clipboard-list";
import Star from "lucide-react-native/icons/star";
import IdCard from "lucide-react-native/icons/id-card";
import UserRound from "lucide-react-native/icons/user-round";
import Users from "lucide-react-native/icons/users";
import UsersRound from "lucide-react-native/icons/users-round";
import { useLocalSearchParams } from "expo-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  loadBookings,
  type Booking,
  type BookingKind,
} from "@/api/v1/pickups/controllers";
import { EmptyState } from "@/components/empty-state";
import { PickupIcon } from "@/components/module-icons";
import { Chip, ModuleHeader, moduleColors } from "@/components/module-ui";
import {
  RatingCell,
  RatingFeedback,
  StatusPill,
} from "@/components/card-badges";
import { BookingRatingSheet } from "@/components/booking-rating-sheet";
import {
  BookingDetailsModal,
  DriverAvatars,
} from "@/pages/commuter/bookings/booking-details";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { goBackOr } from "@/utils/navigation";
import { ErrorAlert } from "@/components/error-alert";
import { SkeletonCards } from "@/components/skeleton";
import { palette } from "@/constants/colors";

const { brandBlue, softBlue, text } = moduleColors;
const cardEdgeBlue = "#1a2f8f";

type BookingTab = BookingKind;

const tabs: { value: BookingTab; label: string }[] = [
  { value: "rental", label: "Rental" },
  { value: "pickup", label: "Pickup" },
];

const emptyMessages: Record<BookingKind, string> = {
  rental: "Rentals you complete will be recorded here.",
  pickup: "Pickups you complete will be recorded here.",
};

export function formatBookingDate(date: Date) {
  const day = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const params = useLocalSearchParams<{ tab?: string; open?: string }>();
  const [tab, setTab] = useState<BookingTab>(() =>
    tabs.some((option) => option.value === params.tab)
      ? (params.tab as BookingTab)
      : "rental",
  );
  const openedFromParams = useRef(false);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [problem, setProblem] = useState("");
  const [rating, setRating] = useState<Booking | null>(null);
  const [details, setDetails] = useState<Booking | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const applyBookings = useCallback(
    (result: Awaited<ReturnType<typeof loadBookings>>) => {
      if (result.ok) {
        setBookings(result.data);
        setProblem("");
        const match =
          !openedFromParams.current && params.open
            ? result.data.find((booking) => booking.id === params.open)
            : undefined;
        if (match) {
          openedFromParams.current = true;
          setDetails(match);
        }
      } else {
        setBookings((current) => current ?? []);
        setProblem(result.error);
      }
    },
    [params.open],
  );

  useEffect(() => {
    let active = true;
    loadBookings().then((result) => {
      if (active) applyBookings(result);
    });
    return () => {
      active = false;
    };
  }, [applyBookings]);

  const refresh = async () => {
    setRefreshing(true);
    applyBookings(await loadBookings());
    setRefreshing(false);
  };

  const goBack = () => goBackOr(Routes.commuterHome);
  const visible = (bookings ?? []).filter((booking) => booking.kind === tab);
  const unrated = (bookings ?? []).filter(
    (booking) => booking.kind === "rental" && booking.driversToRate > 0,
  );

  const closeRating = useCallback(
    (rated: number) => {
      if (rating && rated > 0) {
        const id = rating.id;
        setBookings((list) =>
          (list ?? []).map((booking) =>
            booking.id === id
              ? {
                  ...booking,
                  driversToRate: Math.max(0, booking.driversToRate - rated),
                }
              : booking,
          ),
        );
      }
      setRating(null);
    },
    [rating],
  );

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={palette.brand}
            colors={[palette.brand]}
            progressViewOffset={chrome.headerHeight}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          <View style={styles.tabRow}>
            {tabs.map((option) => {
              const pending = option.value === "rental" ? unrated.length : 0;
              return (
                <View key={option.value} style={styles.tab}>
                  <Chip
                    label={option.label}
                    selected={tab === option.value}
                    onPress={() => setTab(option.value)}
                    grow
                  />
                  {pending > 0 && (
                    <View
                      pointerEvents="none"
                      accessibilityLabel={`${pending} ${pending === 1 ? "rental" : "rentals"} to rate`}
                      style={styles.count}
                    >
                      <Text style={styles.countText}>
                        {pending > 99 ? "99+" : pending}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {bookings === null ? (
            <SkeletonCards style={styles.loading} />
          ) : visible.length === 0 ? (
            <>
              {!!problem && (
                <ErrorAlert
                  title="Bookings"
                  message={problem}
                  style={styles.problem}
                />
              )}
              <EmptyState
                icon={
                  tab === "rental" ? (
                    <Bus color={brandBlue} size={32} strokeWidth={1.8} />
                  ) : (
                    <PickupIcon color={brandBlue} size={32} />
                  )
                }
                message={emptyMessages[tab]}
              />
            </>
          ) : (
            <View style={styles.list}>
              {visible.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onRate={() => setRating(booking)}
                  onOpen={() => setDetails(booking)}
                />
              ))}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <StickyHeader chrome={chrome}>
        <ModuleHeader
          title="My Bookings"
          subtitle="Your completed rentals and pickups."
          icon={<ClipboardList color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={goBack}
          collapsed={chrome.collapsed}
        />
      </StickyHeader>

      <BookingDetailsModal
        booking={details}
        formatDate={formatBookingDate}
        onClose={() => setDetails(null)}
        onRate={() => {
          setRating(details);
          setDetails(null);
        }}
      />

      {rating && <BookingRatingSheet booking={rating} onClose={closeRating} />}
    </View>
  );
}

export function BookingCard({
  booking,
  onRate,
  onOpen,
}: {
  booking: Booking;
  onRate: () => void;
  onOpen?: () => void;
}) {
  const vehicle = [booking.plateNumber, booking.vehicleType]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${booking.kind === "rental" ? "Rental" : "Pickup"} to ${booking.destination}. Show details`}
      disabled={!onOpen}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardTop}>
        <View style={styles.titleBlock}>
          <Text style={styles.kind}>
            {booking.kind === "rental" ? "RENTAL" : "PICKUP"}
          </Text>
          <Text style={styles.destination} numberOfLines={2}>
            {booking.destination}
          </Text>
        </View>
        <StatusPill label="Completed" tone="completed" />
      </View>

      <View style={styles.details}>
        <Detail
          icon={<CalendarDays color={brandBlue} size={13} strokeWidth={2} />}
        >
          {formatBookingDate(booking.requestedAt)}
        </Detail>
        {booking.passengers !== null && (
          <Detail icon={<Users color={brandBlue} size={13} strokeWidth={2} />}>
            {booking.passengers}{" "}
            {booking.passengers === 1 ? "passenger" : "passengers"}
          </Detail>
        )}
        {!!vehicle && (
          <Detail icon={<IdCard color={brandBlue} size={13} strokeWidth={2} />}>
            {vehicle}
          </Detail>
        )}
        {booking.kind === "pickup" && booking.riders.length > 1 && (
          <DriverAvatars
            drivers={booking.riders}
            label={`Riding with ${booking.riders
              .filter((rider) => !rider.isMe)
              .map((rider) => rider.name.split(" ")[0])
              .join(", ")}`}
          />
        )}
        {booking.drivers.length > 0 ? (
          <DriverAvatars drivers={booking.drivers} />
        ) : (
          !!booking.driverName && (
            <Detail
              icon={<UserRound color={brandBlue} size={13} strokeWidth={2} />}
            >
              {booking.driverName}
            </Detail>
          )
        )}
        {!!booking.sharedBy && (
          <Detail
            icon={<UsersRound color={brandBlue} size={13} strokeWidth={2} />}
          >
            Shared by {booking.sharedBy}
          </Detail>
        )}
        {!!booking.purpose && (
          <Detail icon={<Bus color={brandBlue} size={13} strokeWidth={2} />}>
            {booking.purpose}
          </Detail>
        )}
        {booking.kind === "rental" && (
          <RatingCell score={booking.rating?.score ?? null} />
        )}
        {booking.kind === "rental" &&
          booking.driversTotal > 1 &&
          booking.driversToRate > 0 && (
            <Text style={styles.ratedCount}>
              {booking.driversTotal - booking.driversToRate} of{" "}
              {booking.driversTotal} drivers rated
            </Text>
          )}
      </View>

      {booking.kind === "rental" && (
        <>
          {!!booking.rating?.feedback && (
            <RatingFeedback feedback={booking.rating.feedback} />
          )}
          {booking.driversToRate > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Rate your drivers for the rental to ${booking.destination}`}
              onPress={onRate}
              style={({ pressed }) => [
                styles.rateButton,
                pressed && styles.pressed,
              ]}
            >
              <Star color="#ffffff" size={14} strokeWidth={2.2} />
              <Text style={styles.rateButtonText}>
                {booking.driversToRate === 1
                  ? "RATE YOUR DRIVER"
                  : `RATE YOUR DRIVERS (${booking.driversToRate} LEFT)`}
              </Text>
            </Pressable>
          )}
        </>
      )}
    </Pressable>
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
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  ratedCount: { color: "#6b6b6b", fontFamily: "Sora", fontSize: 10 },
  screen: { flex: 1, backgroundColor: "#ffffff" },
  body: { paddingHorizontal: 12, paddingTop: 18 },
  tabRow: { flexDirection: "row", gap: 8, paddingTop: 6 },
  tab: { flex: 1 },
  count: {
    position: "absolute",
    top: -6,
    right: -2,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: palette.danger,
  },
  countText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 10 },
  loading: { marginTop: 48 },
  problem: { marginTop: 16 },
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
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  titleBlock: { flex: 1, gap: 2 },
  kind: {
    color: "#6b6b6b",
    fontFamily: "SoraBold",
    fontSize: 10,
    letterSpacing: 0.8,
  },
  destination: {
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
  pressed: { opacity: 0.75 },
  rateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    gap: 6,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 9,
    backgroundColor: brandBlue,
  },
  rateButtonText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  detailText: { flex: 1, color: text, fontFamily: "Sora", fontSize: 10 },
});
