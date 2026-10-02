import Star from "lucide-react-native/icons/star";
import { StyleSheet, Text, View } from "react-native";

import { homeColors } from "@/components/home-ui";
import type { CommuterRating } from "@/pages/transit/types";
import { getInitials } from "@/utils/format";

const { brandBlue, mutedText, cardBorder, cardEdgeBlue } = homeColors;
const starColor = "#f5b301";
const softBlue = "#e3ecfb";

export function RatingsCard({
  ratings,
  shown = 3,
}: {
  ratings: CommuterRating[];
  shown?: number;
}) {
  const average =
    ratings.reduce((sum, rating) => sum + rating.stars, 0) /
    Math.max(ratings.length, 1);

  return (
    <View style={styles.card}>
      <View style={styles.summary}>
        <View style={styles.averageBlock}>
          <Text style={styles.average}>{average.toFixed(1)}</Text>
          <Stars value={Math.round(average)} size={14} />
          <Text style={styles.count}>
            {ratings.length} rating{ratings.length === 1 ? "" : "s"}
          </Text>
        </View>
        <View style={styles.bars}>
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = ratings.filter(
              (rating) => rating.stars === stars,
            ).length;
            return (
              <View key={stars} style={styles.barRow}>
                <Text style={styles.barLabel}>{stars}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${(count / Math.max(ratings.length, 1)) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {ratings.slice(0, shown).map((rating) => (
        <View key={rating.id} style={styles.review}>
          <View style={styles.reviewTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(rating.commuter)}
              </Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {rating.commuter}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {rating.trip} · {rating.date}
              </Text>
            </View>
            <Stars value={rating.stars} size={12} />
          </View>
          {!!rating.comment && (
            <Text style={styles.comment}>{rating.comment}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function Stars({ value, size }: { value: number; size: number }) {
  return (
    <View
      style={styles.stars}
      accessible
      accessibilityLabel={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          color={starColor}
          fill={index <= value ? starColor : "transparent"}
          size={size}
          strokeWidth={2}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: cardEdgeBlue,
    borderRadius: 10,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    padding: 16,
  },
  averageBlock: { alignItems: "center", gap: 4 },
  average: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 30,
    lineHeight: 36,
  },
  count: { color: mutedText, fontFamily: "Sora", fontSize: 8 },
  stars: { flexDirection: "row", gap: 2 },
  bars: { flex: 1, gap: 4 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: {
    width: 8,
    color: mutedText,
    fontFamily: "SoraBold",
    fontSize: 9,
  },
  barTrack: {
    flex: 1,
    height: 6,
    overflow: "hidden",
    borderRadius: 3,
    backgroundColor: softBlue,
  },
  barFill: { height: "100%", borderRadius: 3, backgroundColor: starColor },
  review: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: cardBorder,
  },
  reviewTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: softBlue,
  },
  avatarText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 11 },
  name: { color: brandBlue, fontFamily: "SoraBold", fontSize: 11 },
  meta: { color: mutedText, fontFamily: "Sora", fontSize: 8, marginTop: 2 },
  comment: {
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 8,
    marginLeft: 42,
  },
});
