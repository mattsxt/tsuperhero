import { StatusBar } from "expo-status-bar";
import Bus from "lucide-react-native/icons/bus";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import ClipboardList from "lucide-react-native/icons/clipboard-list";
import Star from "lucide-react-native/icons/star";
import IdCard from "lucide-react-native/icons/id-card";
import UserRound from "lucide-react-native/icons/user-round";
import Users from "lucide-react-native/icons/users";
import UsersRound from "lucide-react-native/icons/users-round";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  loadBookings,
  type Booking,
  type BookingKind,
} from "@/api/v1/pickups/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { EmptyState } from "@/components/empty-state";
import { PickupIcon } from "@/components/module-icons";
import { Chip, ModuleHeader, moduleColors } from "@/components/module-ui";
import {
  RatingCell,
  RatingFeedback,
  StatusPill,
} from "@/components/card-badges";
import { RateTripModal } from "@/components/star-rating";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { goBackOr } from "@/utils/navigation";

const { brandBlue, softBlue, text, error } = moduleColors;
const cardEdgeBlue = "#1a2f8f";

const tabs: { value: BookingKind; label: string }[] = [
  { value: "rental", label: "Rental" },
  { value: "pickup", label: "Pickup" },
];

const emptyMessages: Record<BookingKind, string> = {
  rental: "Rentals you complete will be recorded here.",
  pickup: "Pickups you complete will be recorded here.",
};

function formatBookingDate(date: Date) {
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
  const [tab, setTab] = useState<BookingKind>("rental");
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [problem, setProblem] = useState("");
  const [rating, setRating] = useState<Booking | null>(null);

  useEffect(() => {
    let active = true;
    loadBookings().then((result) => {
      if (!active) return;
      if (result.ok) setBookings(result.data);
      else {
        setBookings([]);
        setProblem(result.error);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const goBack = () => goBackOr(Routes.commuterHome);
  const visible = (bookings ?? []).filter((booking) => booking.kind === tab);
  const unrated = (bookings ?? []).filter(
    (booking) => booking.kind === "rental" && !booking.rating,
  );

  const saveRating = (score: number, feedback: string) => {
    if (!rating) return;
    const id = rating.id;
    setBookings((current) =>
      (current ?? []).map((booking) =>
        booking.id === id
          ? { ...booking, rating: { score, feedback: feedback || null } }
          : booking,
      ),
    );
    setRating(null);
  };

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
            <LoadingLogo style={styles.loading} />
          ) : visible.length === 0 ? (
            <>
              {!!problem && <Text style={styles.problem}>{problem}</Text>}
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

      <RateTripModal
        target={
          rating
            ? {
                id: rating.id,
                title: rating.destination,
                subtitle: rating.driverName ?? "",
              }
            : null
        }
        onClose={() => setRating(null)}
        onRated={saveRating}
      />
    </View>
  );
}

export function BookingCard({
  booking,
  onRate,
}: {
  booking: Booking;
  onRate: () => void;
}) {
  const vehicle = [booking.plateNumber, booking.vehicleType]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={styles.card}>
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
        {!!booking.driverName && (
          <Detail
            icon={<UserRound color={brandBlue} size={13} strokeWidth={2} />}
          >
            {booking.driverName}
          </Detail>
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
      </View>

      {booking.kind === "rental" && (
        <>
          {!!booking.rating?.feedback && (
            <RatingFeedback feedback={booking.rating.feedback} />
          )}
          {!booking.rating && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Rate your rental to ${booking.destination}`}
              onPress={onRate}
              style={({ pressed }) => [
                styles.rateButton,
                pressed && styles.pressed,
              ]}
            >
              <Star color="#ffffff" size={14} strokeWidth={2.2} />
              <Text style={styles.rateButtonText}>RATE THIS RENTAL</Text>
            </Pressable>
          )}
        </>
      )}
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
    backgroundColor: "#e5383b",
  },
  countText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 9 },
  loading: { marginTop: 48 },
  problem: {
    color: error,
    fontFamily: "Sora",
    fontSize: 10,
    marginTop: 16,
    textAlign: "center",
  },
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
    fontSize: 8,
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
