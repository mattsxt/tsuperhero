import { StatusBar } from "expo-status-bar";
import Bus from "lucide-react-native/icons/bus";
import ClipboardList from "lucide-react-native/icons/clipboard-list";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/empty-state";
import { PickupIcon } from "@/components/module-icons";
import { Chip, ModuleHeader, moduleColors } from "@/components/module-ui";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { goBackOr } from "@/utils/navigation";

const { brandBlue } = moduleColors;

type BookingKind = "rental" | "pickup";

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
});
