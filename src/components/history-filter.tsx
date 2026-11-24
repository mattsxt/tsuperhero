import Search from "lucide-react-native/icons/search";
import X from "lucide-react-native/icons/x";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { EmptyState } from "@/components/empty-state";
import { moduleColors } from "@/components/module-ui";
import {
  historyPeriods,
  type HistoryPeriod,
  type HistoryView,
} from "@/utils/history-filter";

const { brandBlue, mutedText, softBlue, text } = moduleColors;

export function HistoryFilter({
  period,
  onPeriodChange,
  query,
  onQueryChange,
  placeholder,
  style,
}: {
  period: HistoryPeriod;
  onPeriodChange: (period: HistoryPeriod) => void;
  query: string;
  onQueryChange: (query: string) => void;
  placeholder: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.search}>
        <Search color={mutedText} size={16} strokeWidth={2.2} />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder={placeholder}
          placeholderTextColor={mutedText}
          accessibilityLabel="Search history"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.input}
        />
        {!!query && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={10}
            onPress={() => onQueryChange("")}
            style={styles.clear}
          >
            <X color="#ffffff" size={12} strokeWidth={3} />
          </Pressable>
        )}
      </View>

      <View accessibilityRole="tablist" style={styles.segment}>
        {historyPeriods.map((option) => {
          const selected = option.value === period;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              onPress={() => onPeriodChange(option.value)}
              style={[styles.segmentItem, selected && styles.segmentItemOn]}
            >
              <Text
                numberOfLines={1}
                style={[styles.segmentText, selected && styles.segmentTextOn]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ShowMoreButton({
  remaining,
  step,
  noun,
  onPress,
}: {
  remaining: number;
  step: number;
  noun: { one: string; many: string };
  onPress: () => void;
}) {
  if (remaining <= 0) return null;
  const next = Math.min(step, remaining);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Show ${next} more ${next === 1 ? noun.one : noun.many}, ${remaining} left`}
      onPress={onPress}
      style={({ pressed }) => [styles.more, pressed && styles.morePressed]}
    >
      <Text style={styles.moreText}>Show more</Text>
      <Text style={styles.moreCount}>{remaining} left</Text>
    </Pressable>
  );
}

const periodPhrases: Record<HistoryPeriod, string> = {
  today: "today",
  week: "this week",
  month: "in the last month",
  all: "yet",
};

export function HistoryEmpty<T>({
  icon,
  noun,
  emptyMessage,
  period,
  query,
  view,
  onShowAll,
  onClearSearch,
  style,
}: {
  icon: ReactNode;
  noun: { one: string; many: string };
  emptyMessage: string;
  period: HistoryPeriod;
  query: string;
  view: HistoryView<T>;
  onShowAll: () => void;
  onClearSearch: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const searching = !!query.trim();
  const count = (n: number) => `${n} ${n === 1 ? noun.one : noun.many}`;

  if (view.total === 0) {
    return <EmptyState icon={icon} message={emptyMessage} style={style} />;
  }
  if (searching && view.matchesAllTime === 0) {
    return (
      <EmptyState
        icon={icon}
        title="No matches"
        message={`No ${noun.many} match "${query.trim()}". Check the spelling or try fewer words.`}
        action={{ label: "Clear search", onPress: onClearSearch }}
        style={style}
      />
    );
  }
  return (
    <EmptyState
      icon={icon}
      title={`No ${noun.many} ${periodPhrases[period]}`}
      message={
        searching
          ? `${count(view.matchesAllTime)} ${view.matchesAllTime === 1 ? "matches" : "match"} "${query.trim()}" at other times.`
          : `You have ${count(view.matchesAllTime)} from earlier.`
      }
      action={{
        label: `Show all ${count(view.matchesAllTime)}`,
        onPress: onShowAll,
      }}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  search: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: softBlue,
  },
  input: {
    flex: 1,
    padding: 0,
    color: text,
    fontFamily: "Sora",
    fontSize: 12,
  },
  clear: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#9aa7bd",
  },
  segment: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 12,
    backgroundColor: softBlue,
  },
  segmentItem: {
    flex: 1,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderRadius: 9,
  },
  segmentItemOn: {
    backgroundColor: "#ffffff",
    shadowColor: "#0a1634",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { color: mutedText, fontFamily: "SoraBold", fontSize: 11 },
  more: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRadius: 12,
  },
  morePressed: { opacity: 0.7 },
  moreText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 12 },
  moreCount: { color: mutedText, fontFamily: "Sora", fontSize: 11 },
  segmentTextOn: { color: brandBlue },
});
