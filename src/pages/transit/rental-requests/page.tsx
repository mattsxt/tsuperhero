import { StatusBar } from "expo-status-bar";
import Inbox from "lucide-react-native/icons/inbox";
import { useCallback, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  completeRental,
  loadRentalRequests,
  respondToRental,
  type Rental,
} from "@/api/v1/rentals/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { EmptyState } from "@/components/empty-state";
import { Chip, ModuleHeader, moduleColors } from "@/components/module-ui";
import { RentalCard, type RentalAction } from "@/components/rental-card";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { usePolling } from "@/hooks/use-polling";
import { goBackOr } from "@/utils/navigation";

const { brandBlue, error } = moduleColors;

type Tab = "pending" | "accepted" | "declined" | "done";

const tabs: { value: Tab; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "done", label: "Done" },
];

const emptyMessages: Record<Tab, string> = {
  pending: "Charter requests from commuters will show up here.",
  accepted: "You haven't accepted any requests yet.",
  declined: "You haven't declined any requests.",
  done: "Rentals you complete will show up here.",
};

const pollMs = 10_000;

function tabOf(rental: Rental): Tab {
  if (rental.status === "completed") return "done";
  if (rental.status === "rejected" || rental.expired) return "declined";
  return rental.status;
}

export default function RentalRequestsScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const [tab, setTab] = useState<Tab>("pending");
  const [rentals, setRentals] = useState<Rental[] | null>(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState<{ id: string; action: string } | null>(null);

  const refresh = useCallback(async () => {
    const result = await loadRentalRequests();
    if (result.ok) {
      setRentals(result.data);
      setProblem("");
    } else {
      setRentals((current) => current ?? []);
      setProblem(result.error);
    }
  }, []);

  usePolling(refresh, pollMs);

  const counts = useMemo(() => {
    const totals: Record<Tab, number> = {
      pending: 0,
      accepted: 0,
      declined: 0,
      done: 0,
    };
    (rentals ?? []).forEach((rental) => {
      totals[tabOf(rental)] += 1;
    });
    return totals;
  }, [rentals]);

  const visible = useMemo(() => {
    const list = (rentals ?? []).filter((rental) => tabOf(rental) === tab);
    return tab === "pending" || tab === "accepted"
      ? list
      : list.slice().reverse();
  }, [rentals, tab]);

  const run = async (
    rental: Rental,
    action: string,
    task: () => Promise<{ ok: boolean; error?: string }>,
  ) => {
    setBusy({ id: rental.id, action });
    const result = await task();
    setBusy(null);
    if (!result.ok) Alert.alert("Something went wrong", result.error);
    refresh();
  };

  const accept = (rental: Rental) =>
    run(rental, "accept", () => respondToRental(rental.id, true));

  const decline = (rental: Rental) =>
    Alert.alert(
      "Decline this request?",
      `The commuter will be told you can't take their trip to ${rental.destination}.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: () =>
            run(rental, "decline", () => respondToRental(rental.id, false)),
        },
      ],
    );

  const complete = (rental: Rental) =>
    Alert.alert(
      "Mark as completed?",
      "Only do this once the trip is finished. It will be added to the commuter's bookings.",
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Complete",
          onPress: () =>
            run(rental, "complete", () => completeRental(rental.id)),
        },
      ],
    );

  const actionsFor = (rental: Rental): RentalAction[] => {
    const isBusy = (action: string) =>
      busy?.id === rental.id && busy.action === action;
    if (rental.status === "pending" && !rental.expired) {
      return [
        {
          label: "DECLINE",
          tone: "danger",
          busy: isBusy("decline"),
          onPress: () => decline(rental),
        },
        {
          label: "ACCEPT",
          tone: "primary",
          busy: isBusy("accept"),
          onPress: () => accept(rental),
        },
      ];
    }
    if (rental.status === "accepted") {
      return [
        {
          label: "MARK AS COMPLETED",
          tone: "primary",
          busy: isBusy("complete"),
          onPress: () => complete(rental),
        },
      ];
    }
    return [];
  };

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
              <View key={option.value} style={styles.tab}>
                <Chip
                  label={option.label}
                  selected={tab === option.value}
                  onPress={() => setTab(option.value)}
                  grow
                />
                {counts[option.value] > 0 && (
                  <View
                    pointerEvents="none"
                    accessibilityLabel={`${counts[option.value]} ${option.label.toLowerCase()}`}
                    style={[
                      styles.count,
                      option.value === "pending" && styles.countAlert,
                    ]}
                  >
                    <Text style={styles.countText}>
                      {counts[option.value] > 99 ? "99+" : counts[option.value]}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {!!problem && <Text style={styles.problem}>{problem}</Text>}

          {rentals === null ? (
            <LoadingLogo style={styles.loading} />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Inbox color={brandBlue} size={32} strokeWidth={1.8} />}
              message={emptyMessages[tab]}
              style={styles.centered}
            />
          ) : (
            <View style={styles.list}>
              {visible.map((rental) => (
                <RentalCard
                  key={rental.id}
                  rental={rental}
                  viewer="driver"
                  disabled={!!busy}
                  actions={actionsFor(rental)}
                />
              ))}
            </View>
          )}
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
  tabRow: { flexDirection: "row", gap: 6, paddingTop: 6 },
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
    backgroundColor: brandBlue,
  },
  countAlert: { backgroundColor: "#e5383b" },
  countText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 9 },
  loading: { marginTop: 48 },
  list: { gap: 10, marginTop: 16 },
  problem: {
    color: error,
    fontFamily: "Sora",
    fontSize: 10,
    marginTop: 12,
    textAlign: "center",
  },
});
