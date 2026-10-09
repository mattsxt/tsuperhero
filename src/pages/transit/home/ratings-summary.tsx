import Star from "lucide-react-native/icons/star";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  loadMyRatings,
  type RatingSummary,
  type Review,
} from "@/api/v1/ratings/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { EmptyState } from "@/components/empty-state";
import { homeColors } from "@/components/home-ui";
import { StarRow } from "@/components/star-rating";
import { usePolling } from "@/hooks/use-polling";

const { brandBlue, mutedText, cardEdgeBlue } = homeColors;
const starGold = "#f5b301";
const visibleReviews = 5;
const refreshMs = 60_000;

function formatReviewDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RatingsSummary() {
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [problem, setProblem] = useState("");

  const refresh = useCallback(async () => {
    const result = await loadMyRatings();
    if (result.ok) {
      setSummary(result.data);
      setProblem("");
    } else setProblem(result.error);
  }, []);

  usePolling(refresh, refreshMs);

  if (!summary) {
    return problem ? (
      <Text style={styles.problem}>{problem}</Text>
    ) : (
      <LoadingLogo style={styles.loading} />
    );
  }

  if (summary.count === 0) {
    return (
      <EmptyState
        icon={<Star color={brandBlue} size={32} strokeWidth={1.8} />}
        message="Ratings from commuters will show up here after your trips."
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.scoreBlock}>
          <Text style={styles.average}>
            {(summary.average ?? 0).toFixed(1)}
          </Text>
          <StarRow score={summary.average ?? 0} size={13} />
          <Text style={styles.count}>
            {summary.count} {summary.count === 1 ? "rating" : "ratings"}
          </Text>
        </View>
        <View style={styles.bars}>
          {([5, 4, 3, 2, 1] as const).map((score) => {
            const total = summary.breakdown[score];
            const share = summary.count ? total / summary.count : 0;
            return (
              <View
                key={score}
                style={styles.barRow}
                accessible
                accessibilityLabel={`${score} stars: ${total}`}
              >
                <Text style={styles.barLabel}>{score}</Text>
                <Star
                  color={starGold}
                  fill={starGold}
                  size={10}
                  strokeWidth={1.5}
                />
                <View style={styles.barTrack}>
                  <View
                    style={[styles.barFill, { width: `${share * 100}%` }]}
                  />
                </View>
                <Text style={styles.barCount}>{total}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {summary.recent.slice(0, visibleReviews).map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </View>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <View style={styles.review}>
      <View style={styles.reviewTop}>
        <StarRow score={review.score} size={12} />
        <Text style={styles.reviewDate}>
          {formatReviewDate(review.ratedAt)}
        </Text>
      </View>
      {!!review.feedback && (
        <Text style={styles.reviewText}>&ldquo;{review.feedback}&rdquo;</Text>
      )}
      <Text style={styles.reviewMeta} numberOfLines={1}>
        {review.commuterName ?? "A commuter"} ·{" "}
        {review.kind === "rental" ? "Rental" : "Pickup"}
        {review.destination ? ` to ${review.destination}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, paddingHorizontal: 8 },
  loading: { marginTop: 24 },
  problem: {
    color: "#d93025",
    fontFamily: "Sora",
    fontSize: 10,
    marginTop: 12,
    textAlign: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: cardEdgeBlue,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  scoreBlock: { alignItems: "center", gap: 4, minWidth: 82 },
  average: { color: brandBlue, fontFamily: "SoraBold", fontSize: 32 },
  count: { color: mutedText, fontFamily: "Sora", fontSize: 9 },
  bars: { flex: 1, gap: 4 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  barLabel: {
    width: 8,
    color: mutedText,
    fontFamily: "SoraBold",
    fontSize: 9,
    textAlign: "right",
  },
  barTrack: {
    flex: 1,
    height: 6,
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: "#e5e7eb",
  },
  barFill: { height: "100%", borderRadius: 3, backgroundColor: starGold },
  barCount: {
    minWidth: 18,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 9,
    textAlign: "right",
  },
  review: {
    gap: 6,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f5f7fb",
  },
  reviewTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewDate: { color: mutedText, fontFamily: "Sora", fontSize: 9 },
  reviewText: {
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
    fontStyle: "italic",
  },
  reviewMeta: { color: mutedText, fontFamily: "Sora", fontSize: 9 },
});
