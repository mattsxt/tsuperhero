import { Image } from "expo-image";
import Bus from "lucide-react-native/icons/bus";
import MapPin from "lucide-react-native/icons/map-pin";
import Star from "lucide-react-native/icons/star";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  loadMyRatings,
  type RatingSummary,
  type Review,
} from "@/api/v1/ratings/controllers";
import { EmptyState } from "@/components/empty-state";
import { homeColors } from "@/components/home-ui";
import { StarRow } from "@/components/star-rating";
import { usePolling } from "@/hooks/use-polling";
import { ErrorAlert } from "@/components/error-alert";
import { SkeletonCards } from "@/components/skeleton";

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

export function RatingsSummary({ refreshKey = 0 }: { refreshKey?: number }) {
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [problem, setProblem] = useState("");

  const apply = useCallback(
    (result: Awaited<ReturnType<typeof loadMyRatings>>) => {
      if (result.ok) {
        setSummary(result.data);
        setProblem("");
      } else setProblem(result.error);
    },
    [],
  );
  const refresh = useCallback(() => loadMyRatings().then(apply), [apply]);

  usePolling(refresh, refreshMs);

  useEffect(() => {
    if (refreshKey > 0) loadMyRatings().then(apply);
  }, [refreshKey, apply]);

  if (!summary) {
    return problem ? (
      <ErrorAlert title="Ratings" message={problem} style={styles.problem} />
    ) : (
      <SkeletonCards count={1} height={120} style={styles.loading} />
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

      {summary.recent.length > 0 && (
        <Text style={styles.sectionLabel}>RECENT REVIEWS</Text>
      )}
      {summary.recent.slice(0, visibleReviews).map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </View>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const name = review.commuterName?.trim() || "A commuter";
  const kindLabel = review.kind === "rental" ? "Rental" : "Pickup";
  const KindIcon = review.kind === "rental" ? Bus : MapPin;
  const trip = [kindLabel, review.destination].filter(Boolean).join(" · ");
  return (
    <View
      style={styles.review}
      accessible
      accessibilityLabel={`${name} rated ${review.score} out of 5 for a ${trip}`}
    >
      <View style={styles.reviewTop}>
        <View style={styles.avatar}>
          {review.commuterPicture ? (
            <Image
              source={{ uri: review.commuterPicture }}
              style={styles.avatarImage}
              contentFit="cover"
              transition={150}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Text style={styles.avatarText}>
              {name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.reviewWho}>
          <Text style={styles.reviewName} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.reviewTripRow}>
            <KindIcon
              color={mutedText}
              size={14}
              strokeWidth={2.2}
              accessibilityLabel={kindLabel}
            />
            <Text style={styles.reviewTrip} numberOfLines={1}>
              {review.destination ?? kindLabel}
            </Text>
          </View>
        </View>
        <View style={styles.reviewScore}>
          <StarRow score={review.score} size={15} />
          <Text style={styles.reviewDate}>
            {formatReviewDate(review.ratedAt)}
          </Text>
        </View>
      </View>
      {!!review.feedback && (
        <Text style={styles.reviewText}>“{review.feedback}”</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, paddingHorizontal: 8 },
  loading: { marginTop: 24 },
  problem: { marginTop: 12 },
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
  count: { color: mutedText, fontFamily: "Sora", fontSize: 10 },
  bars: { flex: 1, gap: 4 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  barLabel: {
    width: 8,
    color: mutedText,
    fontFamily: "SoraBold",
    fontSize: 10,
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
    fontSize: 10,
    textAlign: "right",
  },
  sectionLabel: {
    marginTop: 6,
    marginLeft: 2,
    color: mutedText,
    fontFamily: "SoraBold",
    fontSize: 11,
    letterSpacing: 0.6,
  },
  review: {
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },
  reviewTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: "#e0e7ff",
  },
  avatarImage: { width: 40, height: 40 },
  avatarText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 16 },
  reviewWho: { flex: 1, gap: 2 },
  reviewName: { color: "#111111", fontFamily: "SoraBold", fontSize: 14 },
  reviewTripRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  reviewTrip: {
    flexShrink: 1,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 12,
  },
  reviewScore: { alignItems: "flex-end", gap: 4 },
  reviewDate: { color: mutedText, fontFamily: "Sora", fontSize: 11 },
  reviewText: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#f5f7fb",
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 13,
    lineHeight: 19,
  },
});
