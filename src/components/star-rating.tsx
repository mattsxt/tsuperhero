import Star from "lucide-react-native/icons/star";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { scoreLabels } from "@/api/v1/ratings/controllers";

const starGold = "#f5b301";
const starEmpty = "#d6dbe6";
const scores = [1, 2, 3, 4, 5];

export function StarRow({
  score,
  size = 14,
}: {
  score: number;
  size?: number;
}) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${score} out of 5 stars`}
    >
      {scores.map((value) => (
        <Star
          key={value}
          size={size}
          color={value <= Math.round(score) ? starGold : starEmpty}
          fill={value <= Math.round(score) ? starGold : starEmpty}
          strokeWidth={1.5}
        />
      ))}
    </View>
  );
}

export function StarBadge({ score }: { score: number }) {
  return (
    <View
      style={styles.badge}
      accessible
      accessibilityLabel={`Rated ${score} out of 5 stars`}
    >
      <Star color={starGold} fill={starGold} size={11} strokeWidth={1.5} />
      <Text style={styles.badgeText}>{score}.0</Text>
    </View>
  );
}

export function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (score: number) => void;
}) {
  return (
    <View style={styles.inputRow} accessibilityRole="adjustable">
      {scores.map((score) => {
        const filled = score <= value;
        return (
          <Pressable
            key={score}
            accessibilityRole="button"
            accessibilityLabel={`${score} ${score === 1 ? "star" : "stars"}, ${scoreLabels[score]}`}
            accessibilityState={{ selected: score === value }}
            hitSlop={6}
            onPress={() => onChange(score)}
            style={({ pressed }) => pressed && styles.pressedStar}
          >
            <Star
              size={38}
              color={filled ? starGold : starEmpty}
              fill={filled ? starGold : "transparent"}
              strokeWidth={1.6}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 2 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#fef3c7",
  },
  badgeText: { color: "#92400e", fontFamily: "SoraBold", fontSize: 10 },
  inputRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 18,
  },
  pressedStar: { transform: [{ scale: 0.9 }] },
});
