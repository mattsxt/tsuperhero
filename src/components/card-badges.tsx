import MessageSquareQuote from "lucide-react-native/icons/message-square-quote";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { moduleColors } from "@/components/module-ui";
import { StarBadge } from "@/components/star-rating";
import { palette } from "@/constants/colors";

const { brandBlue, softBlue, text } = moduleColors;

const tones = {
  completed: { background: "#dcfce7", color: palette.success },
  live: { background: softBlue, color: brandBlue },
  pending: { background: "#fef3c7", color: "#92400e" },
  accepted: { background: "#dcfce7", color: palette.success },
  rejected: { background: "#fee2e2", color: palette.danger },
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

export function vehicleTypeCode(type: string | null): string | null {
  const normalized = type?.trim().toLowerCase() ?? "";
  if (!normalized) return null;
  if (normalized.startsWith("tric")) return "TRIC";
  if (normalized.startsWith("jeep")) return "JEEP";
  return normalized.toUpperCase();
}

export function VehicleTypeBadge({
  type,
  count,
}: {
  type: string | null;
  count?: number;
}) {
  const code = vehicleTypeCode(type);
  if (!code) return null;
  const name = type ?? code;
  return (
    <View
      accessibilityLabel={count ? `${count} ${name}` : name}
      style={[styles.pill, styles.vehiclePill]}
    >
      <Text style={[styles.pillText, styles.vehiclePillText]}>
        {count ? `${count}× ${code}` : code}
      </Text>
    </View>
  );
}

export function FleetBadges({
  types,
  style,
}: {
  types: string[];
  style?: StyleProp<ViewStyle>;
}) {
  const counts = new Map<string, number>();
  types.forEach((type) => counts.set(type, (counts.get(type) ?? 0) + 1));
  return (
    <View style={[styles.fleet, style]}>
      {[...counts].map(([type, count]) => (
        <VehicleTypeBadge key={type} type={type} count={count} />
      ))}
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
  pillText: { fontFamily: "SoraBold", fontSize: 10 },
  fleet: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  vehiclePill: { backgroundColor: softBlue, paddingVertical: 1 },
  vehiclePillText: { color: brandBlue, fontSize: 9, letterSpacing: 0.5 },
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
