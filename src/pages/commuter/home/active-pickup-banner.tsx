import { router } from "expo-router";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Footprints from "lucide-react-native/icons/footprints";
import Users from "lucide-react-native/icons/users";
import BusFront from "lucide-react-native/icons/bus-front";
import UsersRound from "lucide-react-native/icons/users-round";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { LoadingLogo } from "@/components/LoadingLogo";
import { formatRentalTime } from "@/api/v1/rentals/controllers";
import { PickupIcon } from "@/components/module-icons";
import { Routes } from "@/constants/routes";
import type { PickupStatus } from "@/hooks/use-pickup-status";
import { palette } from "@/constants/colors";

const panelNavy = palette.navy;
const routeCyan = palette.cyan;

export type ActiveTone = "walk" | "waiting" | "matched";
type Tone = ActiveTone;

const toneColors: Record<Tone, { background: string; color: string }> = {
  walk: { background: "#fef3c7", color: "#92400e" },
  waiting: { background: "#dbeafe", color: "#1e40af" },
  matched: { background: "#dcfce7", color: palette.success },
};

function describe(status: NonNullable<PickupStatus>) {
  if (status.kind === "own") {
    const { request } = status;
    if (request.status === "accepted") {
      return {
        eyebrow: "YOUR PICKUP",
        label: "Driver on the way",
        tone: "matched" as Tone,
        hint: "Be at the pickup point. Tap to track your driver.",
        place: request.pickupName,
        passengers: request.passengers,
      };
    }
    return request.arrived
      ? {
          eyebrow: "YOUR PICKUP",
          label: "Waiting for a driver",
          tone: "waiting" as Tone,
          hint: "Nearby drivers can see your request.",
          place: request.pickupName,
          passengers: request.passengers,
        }
      : {
          eyebrow: "YOUR PICKUP",
          label: "Head to the pickup point",
          tone: "walk" as Tone,
          hint: "Drivers will see your request once you get there.",
          place: request.pickupName,
          passengers: request.passengers,
        };
  }
  if (status.kind === "rental") {
    const { rental } = status;
    const booked = rental.status === "accepted";
    const bookedCount = rental.units.filter(
      (unit) => unit.status !== "open",
    ).length;
    return {
      eyebrow: "YOUR RENTAL",
      label: booked
        ? "Booked"
        : bookedCount > 0
          ? `${bookedCount} of ${rental.units.length} booked`
          : "Waiting for a driver",
      tone: (booked ? "matched" : "waiting") as Tone,
      hint: booked
        ? `${rental.driverName ?? "Your driver"}${rental.plateNumber ? ` · ${rental.plateNumber}` : ""} · ${formatRentalTime(rental.pickupTime)}`
        : `${formatRentalTime(rental.pickupTime)} · on the job board for drivers`,
      place: rental.destination,
      passengers: rental.passengers,
    };
  }
  const { ride } = status;
  const labels = {
    "waiting-confirmation": ["Waiting for confirmation", "walk"],
    "waiting-driver": ["Waiting for a driver", "waiting"],
    "driver-on-the-way": ["Driver on the way", "matched"],
  } as const;
  const [label, tone] = labels[ride.stage];
  return {
    eyebrow: `SHARED RIDE WITH ${ride.owner.name.toUpperCase()}`,
    label,
    tone: tone as Tone,
    hint: "Tap to see the route to the pickup point.",
    place: ride.pickupName,
    passengers: ride.passengers,
  };
}

export function ActivePickupBanner({ status }: { status: PickupStatus }) {
  if (!status) return null;
  return (
    <ActiveStatusCard
      {...describe(status)}
      openLabel="Open pickup"
      onPress={() =>
        router.push(
          status.kind === "rental"
            ? Routes.commuterRental
            : Routes.commuterPickup,
        )
      }
      icon={
        status.kind === "rental" ? (
          <BusFront color={panelNavy} size={22} strokeWidth={2.2} />
        ) : status.kind === "shared" ? (
          <UsersRound color={panelNavy} size={22} strokeWidth={2.2} />
        ) : (
          <PickupIcon color={panelNavy} size={24} />
        )
      }
    />
  );
}

export function ActiveStatusCard({
  eyebrow,
  place,
  label,
  tone,
  hint,
  passengers,
  icon,
  openLabel,
  onPress,
}: {
  eyebrow: string;
  place: string;
  label: string;
  tone: ActiveTone;
  hint: string;
  passengers?: number;
  icon: ReactNode;
  openLabel: string;
  onPress: () => void;
}) {
  const info = { eyebrow, place, label, tone, hint, passengers };
  const colors = toneColors[tone];

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${info.label}. ${info.place}. ${openLabel}`}
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.icon}>{icon}</View>
        <View style={styles.content}>
          <Text style={styles.eyebrow} numberOfLines={1}>
            {info.eyebrow}
          </Text>
          <Text style={styles.place} numberOfLines={1}>
            {info.place}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.pill, { backgroundColor: colors.background }]}>
              {info.tone === "walk" ? (
                <Footprints color={colors.color} size={11} strokeWidth={2.4} />
              ) : info.tone === "waiting" ? (
                <LoadingLogo color={colors.color} size={11} />
              ) : null}
              <Text style={[styles.pillText, { color: colors.color }]}>
                {info.label.toUpperCase()}
              </Text>
            </View>
            {info.passengers !== undefined && (
              <View style={styles.passengers}>
                <Users color={routeCyan} size={12} strokeWidth={2.4} />
                <Text style={styles.passengerText}>{info.passengers}</Text>
              </View>
            )}
          </View>
          <Text style={styles.hint} numberOfLines={2}>
            {info.hint}
          </Text>
        </View>
        <ChevronRight color="#ffffff" size={20} strokeWidth={2.5} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: panelNavy,
  },
  pressed: { opacity: 0.85 },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: routeCyan,
  },
  content: { flex: 1, gap: 3 },
  eyebrow: { color: routeCyan, fontFamily: "SoraBold", fontSize: 10 },
  place: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 14 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  pillText: { fontFamily: "SoraBold", fontSize: 10 },
  passengers: { flexDirection: "row", alignItems: "center", gap: 3 },
  passengerText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 11 },
  hint: { color: "#d6e2f5", fontFamily: "Sora", fontSize: 10, lineHeight: 13 },
});
