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
import { LoadingSprite } from "@/components/brand-logo";
import { moduleColors } from "@/components/module-ui";
import { StarBadge, StarRow } from "@/components/star-rating";

const { brandBlue, softBlue, text } = moduleColors;
const cardEdgeBlue = "#1a2f8f";

const statusColors: Record<string, { background: string; color: string }> = {
  pending: { background: "#fef3c7", color: "#92400e" },
  accepted: { background: "#dcfce7", color: "#15803d" },
  rejected: { background: "#fee2e2", color: "#b91c1c" },
  completed: { background: softBlue, color: brandBlue },
  expired: { background: "#f3f4f6", color: "#6b7280" },
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
  const statusKey = rental.expired ? "expired" : rental.status;
  const status = statusColors[statusKey];
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
        <Text style={styles.destination} numberOfLines={2}>
          {rental.destination}
        </Text>
        <View style={styles.badges}>
          {rental.rating && <StarBadge score={rental.rating.score} />}
          <View style={[styles.status, { backgroundColor: status.background }]}>
            <Text style={[styles.statusText, { color: status.color }]}>
              {statusLabel.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <Detail icon={<MapPin color={brandBlue} size={13} strokeWidth={2} />}>
        From {rental.pickupLocation}
      </Detail>
      <Detail
        icon={<CalendarDays color={brandBlue} size={13} strokeWidth={2} />}
      >
        {formatRentalTime(rental.pickupTime)}
      </Detail>
      {rental.tripType === "round_trip" && rental.returnTime && (
        <Detail icon={<Repeat color={brandBlue} size={13} strokeWidth={2} />}>
          Return {formatRentalTime(rental.returnTime)}
        </Detail>
      )}
      <Detail icon={<Users color={brandBlue} size={13} strokeWidth={2} />}>
        {rental.passengers}{" "}
        {rental.passengers === 1 ? "passenger" : "passengers"} ·{" "}
        {rental.purpose}
      </Detail>
      {viewer === "commuter" && !!vehicle && (
        <Detail icon={<BusFront color={brandBlue} size={13} strokeWidth={2} />}>
          {vehicle}
        </Detail>
      )}
      {!!person.name && (
        <Detail
          icon={<UserRound color={brandBlue} size={13} strokeWidth={2} />}
        >
          {viewer === "driver" ? "Commuter: " : "Driver: "}
          {person.name}
        </Detail>
      )}
      {!!person.contact && (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Call ${person.contact}`}
          onPress={() => Linking.openURL(`tel:${person.contact}`)}
        >
          <Detail icon={<Phone color={brandBlue} size={13} strokeWidth={2} />}>
            <Text style={styles.link}>{person.contact}</Text>
          </Detail>
        </Pressable>
      )}
      {!!rental.notes && (
        <Detail
          icon={<NotebookPen color={brandBlue} size={13} strokeWidth={2} />}
          lines={3}
        >
          {rental.notes}
        </Detail>
      )}

      {rental.rating && (
        <View style={styles.rating}>
          <View style={styles.ratingTop}>
            <Text style={styles.ratingLabel}>
              {viewer === "driver" ? "Commuter rating" : "Your rating"}
            </Text>
            <StarRow score={rental.rating.score} />
          </View>
          {!!rental.rating.feedback && (
            <Text style={styles.ratingFeedback} numberOfLines={3}>
              &ldquo;{rental.rating.feedback}&rdquo;
            </Text>
          )}
        </View>
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
                <LoadingSprite
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
}: {
  icon: ReactNode;
  children: ReactNode;
  lines?: number;
}) {
  return (
    <View style={styles.detail}>
      <View style={styles.detailIcon}>{icon}</View>
      <Text style={styles.detailText} numberOfLines={lines}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 6,
    paddingVertical: 12,
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
    gap: 8,
    marginBottom: 2,
  },
  destination: {
    flex: 1,
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 13,
  },
  badges: { alignItems: "flex-end", gap: 4 },
  status: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontFamily: "SoraBold", fontSize: 8 },
  detail: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  actions: { flexDirection: "row", gap: 8, marginTop: 6 },
  rating: {
    gap: 4,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eef1f7",
  },
  ratingTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ratingLabel: { color: brandBlue, fontFamily: "SoraBold", fontSize: 10 },
  ratingFeedback: {
    color: text,
    fontFamily: "Sora",
    fontSize: 10,
    fontStyle: "italic",
  },
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
