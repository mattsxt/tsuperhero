import { Image } from "expo-image";
import MailCheck from "lucide-react-native/icons/mail-check";
import MailClock from "lucide-react-native/icons/mail-clock";
import MailX from "lucide-react-native/icons/mail-x";
import SendHorizontal from "lucide-react-native/icons/send-horizontal";
import UserPlus from "lucide-react-native/icons/user-plus";
import UserRound from "lucide-react-native/icons/user-round";
import X from "lucide-react-native/icons/x";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { searchRiders, type Rider } from "@/api/v1/pickups/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { moduleColors, SoftField } from "@/components/module-ui";

import { PickupAlert } from "./pickup-alert";

const { brandBlue, mutedText, softBlue, text } = moduleColors;
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
  onInvite,
  onRemove,
  max,
}: {
  riders: Rider[];
  onChange: (riders: Rider[]) => void;
  onInvite: (rider: Rider) => Promise<string | null>;
  onRemove: (rider: Rider) => Promise<string | null>;
  max: number;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Rider[]>([]);
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
    setQuery("");
    setResults([]);
    setOpen(false);
    Keyboard.dismiss();
  };

  const remove = async (rider: Rider) => {
    const error = await onRemove(rider);
    if (error) {
      setProblem(error);
      return;
    }
    onChange(riders.filter((item) => item.userId !== rider.userId));
  };

  const available = results.filter(
    (result) => !riders.some((rider) => rider.userId === result.userId),
  );

  return (
    <View>
      <SoftField
        value={query}
        onChangeText={(next) => {
          setSelectedRider(null);
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
            <PickupAlert source="Share a ride" message={problem} compact />
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
      {!!problem && !open && (
        <PickupAlert source="Share a ride" message={problem} compact />
      )}

      {riders.length > 0 && (
        <View style={styles.chips}>
          {riders.map((rider) => (
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${rider.name}`}
                hitSlop={8}
                onPress={() => void remove(rider)}
              >
                <X color={brandBlue} size={14} strokeWidth={2.5} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.hint}>
        {riders.some((rider) => rider.inviteStatus === "pending")
          ? "Invitation sent. Confirm stays disabled until each companion responds or is removed."
          : riders.some((rider) => rider.inviteStatus === "accepted")
            ? "Accepted companions will be included in the shared pickup."
            : "Riding with someone? Search for them and send an invitation."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 14, paddingHorizontal: 16 },
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
  rowSelected: { backgroundColor: softBlue },
  status: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
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
