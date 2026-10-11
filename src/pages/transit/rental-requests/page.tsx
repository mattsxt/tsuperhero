import { StatusBar } from "expo-status-bar";
import BriefcaseBusiness from "lucide-react-native/icons/briefcase-business";
import CircleCheck from "lucide-react-native/icons/circle-check";
import Inbox from "lucide-react-native/icons/inbox";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  acceptRentalJob,
  dismissRentalJob,
  loadJobBoard,
  loadRentalRequests,
  type Rental,
} from "@/api/v1/rentals/controllers";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { Chip, ModuleHeader, moduleColors } from "@/components/module-ui";
import { RentalCard } from "@/components/rental-card";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { SkeletonCards } from "@/components/skeleton";
import { palette } from "@/constants/colors";
import { Routes } from "@/constants/routes";
import { usePolling } from "@/hooks/use-polling";
import { goBackOr } from "@/utils/navigation";

import { JobCard } from "./job-card";
import { JobDetailsModal } from "./job-details-modal";
import { JobModal } from "./job-modal";

const { brandBlue } = moduleColors;

type Tab = "board" | "mine" | "history";

const tabs: { value: Tab; label: string }[] = [
  { value: "board", label: "Job board" },
  { value: "mine", label: "My jobs" },
  { value: "history", label: "History" },
];

const emptyMessages: Record<Tab, string> = {
  board:
    "No open rental jobs for your vehicle right now. New requests from commuters show up here.",
  mine: "Jobs you accept are saved here.",
  history: "Rentals you complete will show up here.",
};

const pollMs = 10_000;

const isMine = (rental: Rental) =>
  rental.status === "accepted" ||
  (rental.status === "pending" && !rental.expired);

export default function RentalJobsScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const [tab, setTab] = useState<Tab>("board");
  const [board, setBoard] = useState<Rental[] | null>(null);
  const [jobs, setJobs] = useState<Rental[] | null>(null);
  const [problem, setProblem] = useState("");

  const [selected, setSelected] = useState<Rental | null>(null);
  const [jobBusy, setJobBusy] = useState<"accept" | "dismiss" | null>(null);
  const [jobProblem, setJobProblem] = useState("");
  const [booked, setBooked] = useState(false);

  /** A job from My jobs or History, shown in the details pop-up. */
  const [details, setDetails] = useState<Rental | null>(null);

  const refresh = useCallback(async () => {
    const [open, mine] = await Promise.all([
      loadJobBoard(),
      loadRentalRequests(),
    ]);
    if (open.ok) setBoard(open.data);
    else setBoard((current) => current ?? []);
    if (mine.ok) setJobs(mine.data);
    else setJobs((current) => current ?? []);
    setProblem(!open.ok ? open.error : !mine.ok ? mine.error : "");
  }, []);

  usePolling(refresh, pollMs);

  const lists = useMemo(() => {
    const all = jobs ?? [];
    return {
      board: board ?? [],
      mine: all.filter(isMine),
      history: all.filter((rental) => !isMine(rental)).reverse(),
    };
  }, [board, jobs]);
  const loading = tab === "board" ? board === null : jobs === null;
  const visible = lists[tab];

  const openJob = (job: Rental) => {
    setJobProblem("");
    setBooked(false);
    setSelected(job);
  };

  const closeJob = () => {
    setSelected(null);
    setBooked(false);
    setJobProblem("");
  };

  const acceptJob = async () => {
    if (!selected || jobBusy) return;
    setJobBusy("accept");
    setJobProblem("");
    const result = await acceptRentalJob(selected);
    setJobBusy(null);
    if (!result.ok) {
      setJobProblem(result.error);
      refresh();
      return;
    }
    setBooked(true);
    setBoard((current) =>
      (current ?? []).filter((job) => job.id !== selected.id),
    );
    refresh();
  };

  const dismissJob = async () => {
    if (!selected || jobBusy) return;
    setJobBusy("dismiss");
    const result = await dismissRentalJob(selected.id);
    setJobBusy(null);
    if (!result.ok) return setJobProblem(result.error);
    setBoard((current) =>
      (current ?? []).filter((job) => job.id !== selected.id),
    );
    closeJob();
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
            {tabs.map((option) => {
              const count = lists[option.value].length;
              return (
                <View key={option.value} style={styles.tab}>
                  <Chip
                    label={option.label}
                    selected={tab === option.value}
                    onPress={() => setTab(option.value)}
                    grow
                  />
                  {option.value !== "history" && count > 0 && (
                    <View
                      pointerEvents="none"
                      accessibilityLabel={`${count} ${option.label.toLowerCase()}`}
                      style={[
                        styles.count,
                        option.value === "board" && styles.countAlert,
                      ]}
                    >
                      <Text style={styles.countText}>
                        {count > 99 ? "99+" : count}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {tab === "board" && (
            <Text style={styles.intro}>
              Open charter requests for your vehicle. Tap a job to see the
              details and take it. The first driver to accept gets the trip.
            </Text>
          )}

          {!!problem && (
            <ErrorAlert
              title="Rental jobs"
              message={problem}
              style={styles.problem}
            />
          )}

          {loading ? (
            <SkeletonCards style={styles.loading} />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={
                tab === "board" ? (
                  <BriefcaseBusiness
                    color={brandBlue}
                    size={32}
                    strokeWidth={1.8}
                  />
                ) : tab === "mine" ? (
                  <Inbox color={brandBlue} size={32} strokeWidth={1.8} />
                ) : (
                  <CircleCheck color={brandBlue} size={32} strokeWidth={1.8} />
                )
              }
              message={emptyMessages[tab]}
              style={styles.centered}
            />
          ) : tab === "board" ? (
            <View style={styles.list}>
              {visible.map((job) => (
                <JobCard key={job.id} job={job} onPress={() => openJob(job)} />
              ))}
            </View>
          ) : (
            <View style={styles.list}>
              {visible.map((rental) => (
                <Pressable
                  key={rental.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Rental to ${rental.destination}. Show details`}
                  onPress={() => setDetails(rental)}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <RentalCard rental={rental} viewer="driver" />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      <StickyHeader chrome={chrome}>
        <ModuleHeader
          title="Rental Jobs"
          subtitle="Browse charter requests from commuters and take the trips you want."
          icon={
            <BriefcaseBusiness color="#ffffff" size={44} strokeWidth={1.8} />
          }
          onBack={goBack}
        />
      </StickyHeader>

      <JobModal
        job={selected}
        busy={jobBusy}
        problem={jobProblem}
        booked={booked}
        onAccept={acceptJob}
        onDismiss={dismissJob}
        onClose={closeJob}
        onViewJobs={() => {
          closeJob();
          setTab("mine");
        }}
      />

      <JobDetailsModal job={details} onClose={() => setDetails(null)} />
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
  countAlert: { backgroundColor: palette.danger },
  countText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 10 },
  intro: {
    marginTop: 14,
    color: "#6b6b6b",
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
  },
  loading: { marginTop: 24 },
  list: { gap: 12, marginTop: 16 },
  problem: { marginTop: 12 },
  pressed: { opacity: 0.85 },
});
