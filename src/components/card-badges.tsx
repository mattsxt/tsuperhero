import MessageSquareQuote from "lucide-react-native/icons/message-square-quote";
import { StyleSheet, Text, View } from "react-native";

import { moduleColors } from "@/components/module-ui";
import { StarBadge } from "@/components/star-rating";

const { brandBlue, softBlue, text } = moduleColors;

const tones = {
  completed: { background: "#dcfce7", color: "#15803d" },
  live: { background: softBlue, color: brandBlue },
  pending: { background: "#fef3c7", color: "#92400e" },
  accepted: { background: "#dcfce7", color: "#15803d" },
  rejected: { background: "#fee2e2", color: "#b91c1c" },
  muted: { background: "#eceef2", color: "#6b7280" },
} as const;

export type PillTone = keyof typeof tones;

export function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  const colors = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: colors.background }]}>
      <Text style={[styles.pillText, { color: colors.color }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function RatingPill({ score }: { score: number | null }) {
  return score === null ? (
    <StatusPill label="Not yet rated" tone="muted" />
  ) : (
    <StarBadge score={score} />
  );
}

export function RatingCell({ score }: { score: number | null }) {
  return (
    <View style={styles.ratingCell}>
      <RatingPill score={score} />
    </View>
  );
}

export function RatingFeedback({ feedback }: { feedback: string }) {
  return (
    <View style={styles.feedback}>
      <MessageSquareQuote color={brandBlue} size={13} strokeWidth={2} />
      <Text style={styles.feedbackText} numberOfLines={3}>
        {feedback}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontFamily: "SoraBold", fontSize: 8 },
  ratingCell: {
    flexGrow: 1,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  feedback: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  feedbackText: {
    flex: 1,
    color: text,
    fontFamily: "Sora",
    fontSize: 10,
    fontStyle: "italic",
  },
});
