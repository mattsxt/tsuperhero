import Bus from "lucide-react-native/icons/bus";
import BusFront from "lucide-react-native/icons/bus-front";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import MapPin from "lucide-react-native/icons/map-pin";
import NotebookPen from "lucide-react-native/icons/notebook-pen";
import Phone from "lucide-react-native/icons/phone";
import Repeat from "lucide-react-native/icons/repeat";
import UserRound from "lucide-react-native/icons/user-round";
import Users from "lucide-react-native/icons/users";
import type { ReactNode } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import {
  formatRentalTime,
  rentalStatusLabels,
  type Rental,
} from "@/api/v1/rentals/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { moduleColors } from "@/components/module-ui";
import {
  RatingCell,
  RatingFeedback,
  StatusPill,
  type PillTone,
} from "@/components/card-badges";

const { brandBlue, softBlue, text } = moduleColors;
const cardEdgeBlue = "#1a2f8f";

const statusTones: Record<Rental["status"], PillTone> = {
  pending: "pending",
  accepted: "accepted",
  rejected: "rejected",
  completed: "completed",
};

export type RentalAction = {
  label: string;
  tone: "primary" | "secondary" | "danger";
  busy?: boolean;
  onPress: () => void;
};

export function RentalCard({
  rental,
  viewer,
  actions = [],
  disabled = false,
}: {
  rental: Rental;
  viewer: "commuter" | "driver";
  actions?: RentalAction[];
  disabled?: boolean;
}) {
  const statusTone: PillTone = rental.expired
    ? "muted"
    : statusTones[rental.status];
  const statusLabel = rental.expired
    ? "Expired"
    : viewer === "driver" && rental.status === "pending"
      ? "New request"
      : rentalStatusLabels[rental.status];
  const person =
    viewer === "driver"
      ? { name: rental.commuterName, contact: rental.commuterContact }
      : { name: rental.driverName, contact: rental.driverContact };
  const vehicle = [rental.plateNumber, rental.vehicleType]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.titleBlock}>
          {viewer === "commuter" && <Text style={styles.kind}>RENTAL</Text>}
          <Text style={styles.destination} numberOfLines={2}>
            {rental.destination}
          </Text>
        </View>
        <StatusPill label={statusLabel} tone={statusTone} />
      </View>

      <View style={styles.details}>
        <Detail
          wide
          icon={<MapPin color={brandBlue} size={13} strokeWidth={2} />}
        >
          From {rental.pickupLocation}
        </Detail>
        <Detail
          icon={<CalendarDays color={brandBlue} size={13} strokeWidth={2} />}
        >
          {formatRentalTime(rental.pickupTime)}
        </Detail>
        <Detail icon={<Users color={brandBlue} size={13} strokeWidth={2} />}>
          {rental.passengers}{" "}
          {rental.passengers === 1 ? "passenger" : "passengers"}
        </Detail>
        {rental.tripType === "round_trip" && rental.returnTime && (
          <Detail icon={<Repeat color={brandBlue} size={13} strokeWidth={2} />}>
            Return {formatRentalTime(rental.returnTime)}
          </Detail>
        )}
        <Detail icon={<Bus color={brandBlue} size={13} strokeWidth={2} />}>
          {rental.purpose}
        </Detail>
        {viewer === "commuter" && !!vehicle && (
          <Detail
            icon={<BusFront color={brandBlue} size={13} strokeWidth={2} />}
          >
            {vehicle}
          </Detail>
        )}
        {!!person.name && (
          <Detail
            icon={<UserRound color={brandBlue} size={13} strokeWidth={2} />}
          >
            {person.name}
          </Detail>
        )}
        {!!person.contact && (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Call ${person.contact}`}
            onPress={() => Linking.openURL(`tel:${person.contact}`)}
            style={styles.half}
          >
            <Detail
              fill
              icon={<Phone color={brandBlue} size={13} strokeWidth={2} />}
            >
              <Text style={styles.link}>{person.contact}</Text>
            </Detail>
          </Pressable>
        )}
        {!!rental.notes && (
          <Detail
            wide
            lines={3}
            icon={<NotebookPen color={brandBlue} size={13} strokeWidth={2} />}
          >
            {rental.notes}
          </Detail>
        )}
        {rental.status === "completed" && (
          <RatingCell score={rental.rating?.score ?? null} />
        )}
      </View>

      {!!rental.rating?.feedback && (
        <RatingFeedback feedback={rental.rating.feedback} />
      )}

      {actions.length > 0 && (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityState={{ disabled, busy: action.busy }}
              disabled={disabled}
              onPress={action.onPress}
              style={({ pressed }) => [
                styles.action,
                actionStyles[action.tone],
                (pressed || disabled) && styles.pressed,
              ]}
            >
              {action.busy ? (
                <LoadingLogo
                  size={18}
                  color={action.tone === "primary" ? "#ffffff" : brandBlue}
                />
              ) : (
                <Text
                  style={[styles.actionText, actionTextStyles[action.tone]]}
                >
                  {action.label}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function Detail({
  icon,
  children,
  lines = 1,
  wide = false,
  fill = false,
}: {
  icon: ReactNode;
  children: ReactNode;
  lines?: number;
  wide?: boolean;
  fill?: boolean;
}) {
  return (
    <View
      style={[
        styles.detail,
        fill ? styles.fill : wide ? styles.wide : styles.half,
      ]}
    >
      <View style={styles.detailIcon}>{icon}</View>
      <Text style={styles.detailText} numberOfLines={lines}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: cardEdgeBlue,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  titleBlock: { flex: 1, gap: 2 },
  kind: {
    color: "#6b6b6b",
    fontFamily: "SoraBold",
    fontSize: 8,
    letterSpacing: 0.8,
  },
  destination: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 17,
    lineHeight: 22,
  },
  details: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  half: { width: "50%" },
  wide: { width: "100%" },
  fill: { width: "100%", paddingRight: 0 },
  detail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 6,
  },
  detailIcon: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: softBlue,
  },
  detailText: { flex: 1, color: text, fontFamily: "Sora", fontSize: 10 },
  link: { color: brandBlue, fontFamily: "SoraBold" },
  actions: { flexDirection: "row", gap: 8 },
  action: {
    flex: 1,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  actionText: { fontFamily: "SoraBold", fontSize: 11, letterSpacing: 0.5 },
  pressed: { opacity: 0.7 },
});

const actionStyles = StyleSheet.create({
  primary: { backgroundColor: brandBlue },
  secondary: {
    borderWidth: 1.5,
    borderColor: brandBlue,
    backgroundColor: "#ffffff",
  },
  danger: {
    borderWidth: 1.5,
    borderColor: "#e5383b",
    backgroundColor: "#ffffff",
  },
});

const actionTextStyles = StyleSheet.create({
  primary: { color: "#ffffff" },
  secondary: { color: brandBlue },
  danger: { color: "#e5383b" },
});
