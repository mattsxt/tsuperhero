import { Image } from "expo-image";
<<<<<<< HEAD
import Search from "lucide-react-native/icons/search";
=======
import MailCheck from "lucide-react-native/icons/mail-check";
import MailClock from "lucide-react-native/icons/mail-clock";
import MailX from "lucide-react-native/icons/mail-x";
import SendHorizontal from "lucide-react-native/icons/send-horizontal";
>>>>>>> origin/mapbox
import UserPlus from "lucide-react-native/icons/user-plus";
import UserRound from "lucide-react-native/icons/user-round";
import X from "lucide-react-native/icons/x";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { searchRiders, type Rider } from "@/api/v1/pickups/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { moduleColors, SoftField } from "@/components/module-ui";

<<<<<<< HEAD
const { brandBlue, mutedText, softBlue, text, error } = moduleColors;
=======
import { PickupAlert } from "./pickup-alert";

const { brandBlue, mutedText, softBlue, text } = moduleColors;
>>>>>>> origin/mapbox
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
<<<<<<< HEAD
=======
  onInvite,
  onRemove,
>>>>>>> origin/mapbox
  max,
}: {
  riders: Rider[];
  onChange: (riders: Rider[]) => void;
<<<<<<< HEAD
=======
  onInvite: (rider: Rider) => Promise<string | null>;
  onRemove: (rider: Rider) => Promise<string | null>;
>>>>>>> origin/mapbox
  max: number;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Rider[]>([]);
<<<<<<< HEAD
  const [searching, setSearching] = useState(false);
  const [problem, setProblem] = useState("");
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = query.trim();
  const full = riders.length >= max;
=======
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [searching, setSearching] = useState(false);
  const [problem, setProblem] = useState("");
  const [sending, setSending] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = query.trim();
  const activeRiderCount = riders.filter(
    (rider) => rider.inviteStatus !== "rejected",
  ).length;
  const full = activeRiderCount >= max;
>>>>>>> origin/mapbox

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

<<<<<<< HEAD
  const add = (rider: Rider) => {
    if (full || riders.some((item) => item.userId === rider.userId)) return;
    onChange([...riders, rider]);
=======
  const send = async () => {
    if (!selectedRider || full || sending) return;
    setSending(true);
    setProblem("");
    const error = await onInvite(selectedRider);
    setSending(false);
    if (error) {
      setProblem(error);
      return;
    }
    onChange([...riders, { ...selectedRider, inviteStatus: "pending" }]);
    setSelectedRider(null);
>>>>>>> origin/mapbox
    setQuery("");
    setResults([]);
    setOpen(false);
    Keyboard.dismiss();
  };

<<<<<<< HEAD
  const remove = (userId: string) =>
    onChange(riders.filter((rider) => rider.userId !== userId));
=======
  const remove = async (rider: Rider) => {
    const error = await onRemove(rider);
    if (error) {
      setProblem(error);
      return;
    }
    onChange(riders.filter((item) => item.userId !== rider.userId));
  };
>>>>>>> origin/mapbox

  const available = results.filter(
    (result) => !riders.some((rider) => rider.userId === result.userId),
  );

  return (
    <View>
      <SoftField
        value={query}
        onChangeText={(next) => {
<<<<<<< HEAD
=======
          setSelectedRider(null);
>>>>>>> origin/mapbox
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
<<<<<<< HEAD
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
=======
          searching || sending ? (
            <LoadingLogo size={18} />
          ) : (
            <View style={styles.fieldActions}>
              {query.length > 0 && !selectedRider && (
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
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selectedRider ? `Send an invitation to ${selectedRider.name}` : "Select a search result before sending an invitation"}
                accessibilityState={{
                  disabled: !selectedRider || full || sending,
                }}
                disabled={!selectedRider || full || sending}
                hitSlop={8}
                onPress={send}
                style={({ pressed }) => [
                  styles.sendButton,
                  (!selectedRider || full || sending) && styles.sendButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <SendHorizontal
                  color={!selectedRider || full || sending ? mutedText : brandBlue}
                  size={19}
                  strokeWidth={2.2}
                />
              </Pressable>
            </View>
>>>>>>> origin/mapbox
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
<<<<<<< HEAD
            <Text style={[styles.status, styles.problem]}>{problem}</Text>
=======
            <PickupAlert source="Share a ride" message={problem} compact />
>>>>>>> origin/mapbox
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
<<<<<<< HEAD
                onPress={() => add(rider)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
=======
                onPress={() => {
                  setSelectedRider(rider);
                  setQuery(rider.name);
                  setOpen(false);
                  Keyboard.dismiss();
                }}
                style={({ pressed }) => [
                  styles.row,
                  selectedRider?.userId === rider.userId && styles.rowSelected,
                  pressed && styles.pressed,
                ]}
>>>>>>> origin/mapbox
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
<<<<<<< HEAD
=======
      {!!problem && !open && (
        <PickupAlert source="Share a ride" message={problem} compact />
      )}
>>>>>>> origin/mapbox

      {riders.length > 0 && (
        <View style={styles.chips}>
          {riders.map((rider) => (
<<<<<<< HEAD
            <View key={rider.userId} style={styles.chip}>
              <Avatar rider={rider} size={22} />
              <Text style={styles.chipText} numberOfLines={1}>
                {rider.name}
              </Text>
=======
            <View
              key={rider.userId}
              style={[
                styles.chip,
                rider.inviteStatus === "accepted"
                  ? styles.chipAccepted
                  : rider.inviteStatus === "rejected"
                    ? styles.chipRejected
                    : styles.chipPending,
              ]}
            >
              <Avatar rider={rider} size={22} />
              <Text
                style={[
                  styles.chipText,
                  rider.inviteStatus === "accepted"
                    ? styles.chipTextAccepted
                    : rider.inviteStatus === "rejected"
                      ? styles.chipTextRejected
                      : styles.chipTextPending,
                ]}
                numberOfLines={1}
              >
                {rider.name}
              </Text>
              {rider.inviteStatus === "accepted" ? (
                <MailCheck color="#16803c" size={17} strokeWidth={2} />
              ) : rider.inviteStatus === "rejected" ? (
                <MailX color="#c62828" size={17} strokeWidth={2} />
              ) : (
                <MailClock color="#7b8494" size={17} strokeWidth={2} />
              )}
>>>>>>> origin/mapbox
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${rider.name}`}
                hitSlop={8}
<<<<<<< HEAD
                onPress={() => remove(rider.userId)}
=======
                onPress={() => void remove(rider)}
>>>>>>> origin/mapbox
              >
                <X color={brandBlue} size={14} strokeWidth={2.5} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.hint}>
<<<<<<< HEAD
        {riders.length > 0
          ? "This pickup will also be recorded in their bookings and trip history."
          : "Riding with someone? Add them so the trip is recorded for them too."}
=======
        {riders.some((rider) => rider.inviteStatus === "pending")
          ? "Invitation sent. Confirm stays disabled until each companion responds or is removed."
          : riders.some((rider) => rider.inviteStatus === "accepted")
            ? "Accepted companions will be included in the shared pickup."
            : "Riding with someone? Search for them and send an invitation."}
>>>>>>> origin/mapbox
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 14, paddingHorizontal: 16 },
<<<<<<< HEAD
=======
  fieldActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  sendButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: "#ffffff",
  },
  sendButtonDisabled: { opacity: 0.55 },
>>>>>>> origin/mapbox
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
<<<<<<< HEAD
=======
  rowSelected: { backgroundColor: softBlue },
>>>>>>> origin/mapbox
  status: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
<<<<<<< HEAD
  problem: { color: error },
=======
>>>>>>> origin/mapbox
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
<<<<<<< HEAD
    backgroundColor: softBlue,
  },
  chipText: {
    flexShrink: 1,
    color: brandBlue,
=======
    borderWidth: 1,
  },
  chipPending: { backgroundColor: "#f1f3f5", borderColor: "#d5d9df" },
  chipAccepted: { backgroundColor: "#e8f5ec", borderColor: "#a8d5b5" },
  chipRejected: { backgroundColor: "#fdecec", borderColor: "#efb0b0" },
  chipTextPending: { color: "#68717e" },
  chipTextAccepted: { color: "#16803c" },
  chipTextRejected: { color: "#c62828" },
  chipText: {
    flexShrink: 1,
>>>>>>> origin/mapbox
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
