import { Image } from "expo-image";
import Search from "lucide-react-native/icons/search";
import UserPlus from "lucide-react-native/icons/user-plus";
import UserRound from "lucide-react-native/icons/user-round";
import X from "lucide-react-native/icons/x";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { searchRiders, type Rider } from "@/api/v1/pickups/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { moduleColors, SoftField } from "@/components/module-ui";

const { brandBlue, mutedText, softBlue, text, error } = moduleColors;
const searchDelayMs = 300;
const minQueryLength = 2;

function Avatar({ rider, size }: { rider: Rider; size: number }) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {rider.picture ? (
        <Image
          source={{ uri: rider.picture }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>
          {rider.initials}
        </Text>
      )}
    </View>
  );
}

export function ShareRideField({
  riders,
  onChange,
  max,
}: {
  riders: Rider[];
  onChange: (riders: Rider[]) => void;
  max: number;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Rider[]>([]);
  const [searching, setSearching] = useState(false);
  const [problem, setProblem] = useState("");
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = query.trim();
  const full = riders.length >= max;

  useEffect(() => {
    if (!open || trimmed.length < minQueryLength) return;
    let active = true;
    const timer = setTimeout(async () => {
      const result = await searchRiders(trimmed);
      if (!active) return;
      setSearching(false);
      if (!result.ok) {
        setProblem(result.error);
        setResults([]);
        return;
      }
      setProblem("");
      setResults(result.data);
    }, searchDelayMs);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [trimmed, open]);

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  const add = (rider: Rider) => {
    if (full || riders.some((item) => item.userId === rider.userId)) return;
    onChange([...riders, rider]);
    setQuery("");
    setResults([]);
    setOpen(false);
    Keyboard.dismiss();
  };

  const remove = (userId: string) =>
    onChange(riders.filter((rider) => rider.userId !== userId));

  const available = results.filter(
    (result) => !riders.some((rider) => rider.userId === result.userId),
  );

  return (
    <View>
      <SoftField
        value={query}
        onChangeText={(next) => {
          setQuery(next);
          setOpen(true);
          setSearching(next.trim().length >= minQueryLength);
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 200);
        }}
        editable={!full}
        placeholder={
          full
            ? "You've added the most riders"
            : "Search a user by name or email..."
        }
        accessibilityLabel="Search a user to share the ride with"
        autoCapitalize="none"
        autoCorrect={false}
        icon={<UserRound color={brandBlue} size={20} strokeWidth={2} />}
        trailing={
          searching ? (
            <LoadingLogo size={18} />
          ) : query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear user search"
              hitSlop={8}
              onPress={() => {
                setQuery("");
                setResults([]);
              }}
            >
              <X color={mutedText} size={18} strokeWidth={2} />
            </Pressable>
          ) : (
            <Search color={brandBlue} size={18} strokeWidth={2} />
          )
        }
        style={styles.field}
      />

      {open && trimmed.length >= minQueryLength && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={styles.dropdown}
        >
          {searching && available.length === 0 ? (
            <Text style={styles.status}>Searching users...</Text>
          ) : problem ? (
            <Text style={[styles.status, styles.problem]}>{problem}</Text>
          ) : available.length === 0 ? (
            <Text style={styles.status}>
              No registered commuter matches “{trimmed}”.
            </Text>
          ) : (
            available.map((rider) => (
              <Pressable
                key={rider.userId}
                accessibilityRole="button"
                accessibilityLabel={`Share the ride with ${rider.name}`}
                onPress={() => add(rider)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Avatar rider={rider} size={32} />
                <Text style={styles.rowName} numberOfLines={1}>
                  {rider.name}
                </Text>
                <UserPlus color={brandBlue} size={18} strokeWidth={2} />
              </Pressable>
            ))
          )}
        </Animated.View>
      )}

      {riders.length > 0 && (
        <View style={styles.chips}>
          {riders.map((rider) => (
            <View key={rider.userId} style={styles.chip}>
              <Avatar rider={rider} size={22} />
              <Text style={styles.chipText} numberOfLines={1}>
                {rider.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${rider.name}`}
                hitSlop={8}
                onPress={() => remove(rider.userId)}
              >
                <X color={brandBlue} size={14} strokeWidth={2.5} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.hint}>
        {riders.length > 0
          ? "This pickup will also be recorded in their bookings and trip history."
          : "Riding with someone? Add them so the trip is recorded for them too."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 14, paddingHorizontal: 16 },
  pressed: { opacity: 0.7 },
  dropdown: {
    marginTop: 6,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    backgroundColor: "#ffffff",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  rowName: {
    flex: 1,
    color: text,
    fontFamily: "SoraBold",
    fontSize: 12,
  },
  status: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  problem: { color: error },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: brandBlue,
  },
  avatarText: { color: "#ffffff", fontFamily: "SoraBold" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 999,
    backgroundColor: softBlue,
  },
  chipText: {
    flexShrink: 1,
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 11,
  },
  hint: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 9,
    lineHeight: 13,
    marginTop: 8,
    marginLeft: 4,
  },
});
