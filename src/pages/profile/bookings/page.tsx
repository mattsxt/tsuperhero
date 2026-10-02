import { StatusBar } from "expo-status-bar";
import Bus from "lucide-react-native/icons/bus";
import ClipboardList from "lucide-react-native/icons/clipboard-list";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/empty-state";
import { PickupIcon } from "@/components/module-icons";
import { Chip, ModuleHeader, moduleColors } from "@/components/module-ui";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { goBackOr } from "@/utils/navigation";

const { brandBlue, mutedText, text } = moduleColors;

type BookingKind = "rental" | "pickup";

type Booking = {
  id: string;
  kind: BookingKind;
  from: string;
  to: string;
  date: string;
  status: string;
};

const bookings: Booking[] = [];

const tabs: { value: BookingKind; label: string }[] = [
  { value: "rental", label: "Rental" },
  { value: "pickup", label: "Pickup" },
];

const emptyMessages: Record<BookingKind, string> = {
  rental: "Vehicles you charter in Rental will show up here with their status.",
  pickup: "Pickups you request will show up here with their status.",
};

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const [tab, setTab] = useState<BookingKind>("rental");

  const visible = bookings.filter((booking) => booking.kind === tab);

  const goBack = () => goBackOr(Routes.profile);

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

          {visible.length === 0 ? (
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
          ) : (
            <View style={styles.list}>
              {visible.map((booking) => (
                <View key={booking.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.route} numberOfLines={2}>
                      {booking.from} – {booking.to}
                    </Text>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{booking.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.date}>{booking.date}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <StickyHeader chrome={chrome}>
        <ModuleHeader
          title="My Bookings"
          subtitle="Track the rentals and pickups you’ve requested."
          icon={<ClipboardList color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={goBack}
          collapsed={chrome.collapsed}
        />
      </StickyHeader>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  body: { paddingHorizontal: 12, paddingTop: 18 },
  tabRow: { flexDirection: "row", gap: 8 },
  list: { gap: 12, marginTop: 16 },
  card: {
    padding: 14,
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: "#1a2f8f",
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  route: { flex: 1, color: text, fontFamily: "SoraBold", fontSize: 12 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: brandBlue,
  },
  badgeText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 9 },
  date: { color: mutedText, fontFamily: "Sora", fontSize: 10, marginTop: 6 },
});
