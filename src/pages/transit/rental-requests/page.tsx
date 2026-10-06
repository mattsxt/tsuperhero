import { StatusBar } from "expo-status-bar";
import Inbox from "lucide-react-native/icons/inbox";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/empty-state";
import { Chip, ModuleHeader, moduleColors } from "@/components/module-ui";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { goBackOr } from "@/utils/navigation";

const { brandBlue } = moduleColors;

type RentalStatus = "pending" | "accepted" | "declined";

const tabs: { value: RentalStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
];

const emptyMessages: Record<RentalStatus, string> = {
  pending: "Charter requests from commuters will show up here.",
  accepted: "You haven't accepted any requests yet.",
  declined: "You haven't declined any requests.",
};

export default function RentalRequestsScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const [tab, setTab] = useState<RentalStatus>("pending");

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
            icon={<Inbox color={brandBlue} size={32} strokeWidth={1.8} />}
            message={emptyMessages[tab]}
            style={styles.centered}
          />
        </View>
      </Animated.ScrollView>

      <StickyHeader chrome={chrome}>
        <ModuleHeader
          title="Rental Requests"
          subtitle="Review charter requests from commuters and choose which trips to take."
          icon={<Inbox color="#ffffff" size={44} strokeWidth={1.8} />}
          onBack={goBack}
          collapsed={chrome.collapsed}
        />
      </StickyHeader>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  body: { flex: 1, paddingHorizontal: 12, paddingTop: 18 },
  centered: { flex: 1, justifyContent: "center" },
  tabRow: { flexDirection: "row", gap: 6 },
});
