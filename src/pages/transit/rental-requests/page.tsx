import { StatusBar } from "expo-status-bar";
import BriefcaseBusiness from "lucide-react-native/icons/briefcase-business";
import CircleCheck from "lucide-react-native/icons/circle-check";
import Inbox from "lucide-react-native/icons/inbox";
import OctagonPause from "lucide-react-native/icons/octagon-pause";
import Timer from "lucide-react-native/icons/timer";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MiniToast, type MiniToastMessage } from "@/components/mini-toast";
import { useStatusBarTop } from "@/hooks/use-status-bar-top";

import {
  acceptBlock,
  acceptRentalJob,
  dismissRentalJob,
  dropRentalJob,
  formatRentalTime,
  loadJobBoard,
  loadRentalRequests,
  loadRentalStanding,
  type AcceptBlock,
  type Rental,
  type RentalStanding,
} from "@/api/v1/rentals/controllers";
import {
  dropOutcomeMessage,
  formatWait,
} from "@/api/v1/rentals/drop-policy";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import {
  HistoryEmpty,
  HistoryFilter,
  ShowMoreButton,
} from "@/components/history-filter";
import { Chip, ModuleHeader, moduleColors } from "@/components/module-ui";
import { RentalCard } from "@/components/rental-card";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { SkeletonCards } from "@/components/skeleton";
import { palette } from "@/constants/colors";
import { Routes } from "@/constants/routes";
import { historyPageSize, useIncremental } from "@/hooks/use-incremental";
import { useNow } from "@/hooks/use-now";
import { usePolling } from "@/hooks/use-polling";
import {
  defaultHistoryPeriod,
  filterHistory,
  type HistoryPeriod,
} from "@/utils/history-filter";
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

const emptyMessages: Record<Exclude<Tab, "history">, string> = {
  board:
    "No open rental jobs for your vehicle right now. New requests from commuters show up here.",
  mine: "Jobs you accept are saved here.",
};

const pollMs = 10_000;

const isMine = (rental: Rental) =>
  rental.status === "accepted" ||
  (rental.status === "pending" && !rental.expired);

export default function RentalJobsScreen() {
  const insets = useSafeAreaInsets();
  const statusBarTop = useStatusBarTop();
  const [toast, setToast] = useState<MiniToastMessage | null>(null);
  const showToast = (text: string) => setToast({ id: Date.now(), text });
  const chrome = useScrollChrome();
  const [tab, setTab] = useState<Tab>("board");
  const [board, setBoard] = useState<Rental[] | null>(null);
  const [jobs, setJobs] = useState<Rental[] | null>(null);
  const [problem, setProblem] = useState("");

  const [selected, setSelected] = useState<Rental | null>(null);
  const [jobBusy, setJobBusy] = useState<"accept" | "dismiss" | null>(null);
  const [jobProblem, setJobProblem] = useState("");
  const [booked, setBooked] = useState(false);

  const [details, setDetails] = useState<Rental | null>(null);
  const [standing, setStanding] = useState<RentalStanding | null>(null);
  const now = useNow(15_000);
  const block = acceptBlock(standing, now);

  const [period, setPeriod] = useState<HistoryPeriod>(defaultHistoryPeriod);
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query);

  const refresh = useCallback(async () => {
    const [open, mine, standingResult] = await Promise.all([
      loadJobBoard(),
      loadRentalRequests(),
      loadRentalStanding(),
    ]);
    if (open.ok) setBoard(open.data);
    else setBoard((current) => current ?? []);
    if (mine.ok) setJobs(mine.data);
    else setJobs((current) => current ?? []);
    if (standingResult.ok) setStanding(standingResult.data);
    setProblem(!open.ok ? open.error : !mine.ok ? mine.error : "");
  }, []);

  usePolling(refresh, pollMs);

  const [refreshing, setRefreshing] = useState(false);
  const pullRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const historyView = useMemo(
    () =>
      filterHistory(
        (jobs ?? []).filter((rental) => !isMine(rental)),
        {
          period,
          query: search,
          now: new Date(now),
          dateOf: (rental) => rental.pickupTime,
          searchFields: (rental) => [
            rental.destination,
            rental.pickupLocation,
            rental.commuterName,
            rental.purpose,
            rental.plateNumber,
            formatRentalTime(rental.pickupTime),
          ],
        },
      ),
    [jobs, period, search, now],
  );

  const lists = useMemo(
    () => ({
      board: board ?? [],
      mine: (jobs ?? []).filter(isMine),
      history: historyView.visible,
    }),
    [board, jobs, historyView],
  );
  const loading = tab === "board" ? board === null : jobs === null;
  const visible = lists[tab];
  const page = useIncremental(visible, `${tab}|${period}|${search}`);

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
    if (!selected || jobBusy || block) return;
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

          {!!problem && (
            <ErrorAlert
              title="Rental jobs"
              message={problem}
              style={styles.problem}
            />
          )}

          {tab === "board" && block && (
            <StandingBanner block={block} standing={standing} now={now} />
          )}

          {tab === "history" && (
            <HistoryFilter
              period={period}
              onPeriodChange={setPeriod}
              query={query}
              onQueryChange={setQuery}
              placeholder="Search destination, commuter or date"
              style={styles.filter}
            />
          )}

          {loading ? (
            <SkeletonCards style={styles.loading} />
          ) : visible.length === 0 && tab === "history" ? (
            <HistoryEmpty
              icon={
                <CircleCheck color={brandBlue} size={32} strokeWidth={1.8} />
              }
              noun={{ one: "rental", many: "rentals" }}
              emptyMessage="Rentals you complete will show up here."
              period={period}
              query={search}
              view={historyView}
              onShowAll={() => setPeriod("all")}
              onClearSearch={() => setQuery("")}
              style={styles.centered}
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={
                tab === "board" ? (
                  <BriefcaseBusiness
                    color={brandBlue}
                    size={32}
                    strokeWidth={1.8}
                  />
                ) : (
                  <Inbox color={brandBlue} size={32} strokeWidth={1.8} />
                )
              }
              message={emptyMessages[tab === "board" ? "board" : "mine"]}
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
              {page.shown.map((rental) => (
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
              <ShowMoreButton
                remaining={page.remaining}
                step={historyPageSize}
                noun={{ one: "rental", many: "rentals" }}
                onPress={page.showMore}
              />
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
        block={block}
        now={now}
        onAccept={acceptJob}
        onDismiss={dismissJob}
        onClose={closeJob}
        onViewJobs={() => {
          closeJob();
          setTab("mine");
        }}
      />

      <JobDetailsModal
        job={details}
        standing={standing}
        onClose={() => setDetails(null)}
        onDrop={async (job, reason, reasonDetails) => {
          const result = await dropRentalJob(job.id, reason, reasonDetails);
          if (!result.ok) return result.error;
          setDetails(null);
          showToast(dropOutcomeMessage(result.data.penalty));
          await refresh();
          return null;
        }}
      />
      <MiniToast message={toast} top={statusBarTop + 12} />
    </View>
  );
}

function StandingBanner({
  block,
  standing,
  now,
}: {
  block: NonNullable<AcceptBlock>;
  standing: RentalStanding | null;
  now: number;
}) {
  const suspended = block.kind === "suspended";
  const drops = standing?.drops ?? 0;
  const windowDays = standing?.windowDays ?? 7;
  const tone = suspended
    ? { background: palette.dangerSoft, color: palette.dangerText }
    : { background: palette.warningSoft, color: palette.warning };
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: tone.background }]}
    >
      {suspended ? (
        <OctagonPause color={palette.danger} size={20} strokeWidth={2.2} />
      ) : (
        <Timer color={palette.warning} size={20} strokeWidth={2.2} />
      )}
      <View style={styles.bannerText}>
        <Text style={[styles.bannerTitle, { color: tone.color }]}>
          {block.kind === "cooldown"
            ? `You can accept another job in ${formatWait(block.until.getTime() - now)}`
            : "Rental jobs are paused"}
        </Text>
        <Text style={[styles.bannerBody, { color: tone.color }]}>
          {suspended
            ? `You dropped ${drops} accepted jobs in the last ${windowDays} days, so your cooperative head is reviewing it. Jobs you're already booked on stay yours.`
            : `You dropped ${drops} accepted ${drops === 1 ? "job" : "jobs"} in the last ${windowDays} days. ${
                standing?.nextPenalty.kind === "suspended"
                  ? "Another drop pauses rental jobs until your cooperative head reviews it."
                  : "Another drop means a longer wait."
              }`}
        </Text>
      </View>
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
  loading: { marginTop: 24 },
  list: { gap: 12, marginTop: 16 },
  problem: { marginTop: 12 },
  filter: { marginTop: 16 },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
  },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { fontFamily: "SoraBold", fontSize: 12, lineHeight: 17 },
  bannerBody: { fontFamily: "Sora", fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.85 },
});
