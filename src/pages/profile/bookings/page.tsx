import { StatusBar } from "expo-status-bar";
import Bus from "lucide-react-native/icons/bus";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import CircleCheck from "lucide-react-native/icons/circle-check";
import ClipboardList from "lucide-react-native/icons/clipboard-list";
import IdCard from "lucide-react-native/icons/id-card";
import UserRound from "lucide-react-native/icons/user-round";
import Users from "lucide-react-native/icons/users";
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  loadBookings,
  type Booking,
  type BookingKind,
} from "@/api/v1/pickups/controllers";
import { LoadingSprite } from "@/components/brand-logo";
import { EmptyState } from "@/components/empty-state";
import { PickupIcon } from "@/components/module-icons";
import { Chip, ModuleHeader, moduleColors } from "@/components/module-ui";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { goBackOr } from "@/utils/navigation";

const { brandBlue, softBlue, text, error } = moduleColors;
const cardEdgeBlue = "#1a2f8f";
const completedGreen = "#15803d";

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

  const goBack = () => goBackOr(Routes.profile);
  const visible = (bookings ?? []).filter((booking) => booking.kind === tab);

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
            {tabs.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={tab === option.value}
                onPress={() => setTab(option.value)}
                grow
              />
            ))}
          </View>

          {bookings === null ? (
            <LoadingSprite style={styles.loading} />
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
                <BookingCard key={booking.id} booking={booking} />
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
    </View>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  const vehicle = [booking.plateNumber, booking.vehicleType]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.destination} numberOfLines={2}>
          {booking.destination}
        </Text>
        <View style={styles.badge}>
          <CircleCheck color={completedGreen} size={11} strokeWidth={2.5} />
          <Text style={styles.badgeText}>COMPLETED</Text>
        </View>
      </View>
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
      {!!booking.purpose && (
        <Detail icon={<Bus color={brandBlue} size={13} strokeWidth={2} />}>
          {booking.purpose}
        </Detail>
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
  tabRow: { flexDirection: "row", gap: 8 },
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
    gap: 6,
    paddingVertical: 12,
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
    gap: 8,
    marginBottom: 2,
  },
  destination: {
    flex: 1,
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 13,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#dcfce7",
  },
  badgeText: { color: completedGreen, fontFamily: "SoraBold", fontSize: 8 },
  detail: { flexDirection: "row", alignItems: "center", gap: 8 },
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
