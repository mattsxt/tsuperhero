import { Image } from "expo-image";
import UserPlus from "lucide-react-native/icons/user-plus";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import type { Rider } from "@/api/v1/pickups/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { moduleColors } from "@/components/module-ui";

const { brandBlue, mutedText, softBlue, text } = moduleColors;
const ROW_HEIGHT = 56;
const VISIBLE_ROWS = 5;

const highlight = (name: string, query: string) => {
  const at = query ? name.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return [{ text: name, match: false }];
  return [
    { text: name.slice(0, at), match: false },
    { text: name.slice(at, at + query.length), match: true },
    { text: name.slice(at + query.length), match: false },
  ].filter((part) => part.text);
};

export function CompanionDropdown({
  query,
  results,
  loading,
  excludedIds,
  selectedId,
  onSelect,
}: {
  query: string;
  results: Rider[];
  loading: boolean;
  excludedIds: string[];
  selectedId: string | null;
  onSelect: (rider: Rider) => void;
}) {
  const trimmed = query.trim();
  const shown = results.filter(
    (rider) =>
      !excludedIds.includes(rider.userId) &&
      (!trimmed || rider.name.toLowerCase().includes(trimmed.toLowerCase())),
  );
  const countLabel = loading
    ? "Loading commuters"
    : `${shown.length} ${shown.length === 1 ? "commuter" : "commuters"} found`;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
      style={styles.dropdown}
    >
      <Text style={styles.count} accessibilityLiveRegion="polite" accessibilityRole="text">
        {countLabel}
      </Text>
      {loading && shown.length === 0 ? (
        <View style={styles.state}>
          <LoadingLogo size={18} label="Loading commuters" />
        </View>
      ) : shown.length === 0 ? (
        <Text style={styles.empty}>No commuter matches “{trimmed}”.</Text>
      ) : (
        <ScrollView
          style={{ maxHeight: ROW_HEIGHT * VISIBLE_ROWS }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {shown.map((rider) => (
            <Pressable
              key={rider.userId}
              accessibilityRole="button"
              accessibilityLabel={`Add ${rider.name} as a companion`}
              accessibilityState={{ selected: selectedId === rider.userId }}
              onPress={() => onSelect(rider)}
              style={({ pressed }) => [
                styles.row,
                selectedId === rider.userId && styles.rowSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.avatar}>
                {rider.picture ? (
                  <Image source={{ uri: rider.picture }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarText}>{rider.initials}</Text>
                )}
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {highlight(rider.name, trimmed).map((part, index) => (
                  <Text key={index} style={part.match ? styles.match : undefined}>
                    {part.text}
                  </Text>
                ))}
              </Text>
              <UserPlus color={brandBlue} size={20} strokeWidth={2} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    backgroundColor: "#ffffff",
  },
  count: {
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: 14,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 11,
  },
  state: { alignItems: "center", paddingVertical: 14 },
  empty: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 12,
  },
  row: {
    minHeight: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
  },
  rowSelected: { backgroundColor: softBlue },
  pressed: { opacity: 0.7 },
  avatar: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: brandBlue,
  },
  avatarText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 14 },
  name: { flex: 1, color: text, fontFamily: "Sora", fontSize: 14 },
  match: { color: brandBlue, fontFamily: "SoraBold" },
});
