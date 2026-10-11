import { Image } from "expo-image";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import ClipboardList from "lucide-react-native/icons/clipboard-list";
import Sparkles from "lucide-react-native/icons/sparkles";
import Star from "lucide-react-native/icons/star";
import UserCheck from "lucide-react-native/icons/user-check";
import Users from "lucide-react-native/icons/users";
import UsersRound from "lucide-react-native/icons/users-round";
import X from "lucide-react-native/icons/x";
import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type {
  Booking,
  BookingDriver,
  Rider,
} from "@/api/v1/pickups/controllers";
import { SteeringWheelIcon } from "@/components/steering-wheel-icon";
import { palette } from "@/constants/colors";

const avatarSize = 26;
const maxShown = 4;
const starGold = "#f5b301";

type Person = Pick<Rider, "userId" | "name" | "initials" | "picture">;

function Avatar({ driver, size }: { driver: Person; size: number }) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
        {driver.initials}
      </Text>
      {!!driver.picture && (
        <Image
          source={{ uri: driver.picture }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      )}
    </View>
  );
}

export function DriverAvatars({
  drivers,
  label,
}: {
  drivers: Person[];
  label?: string;
}) {
  if (drivers.length === 0) return null;
  const shown = drivers.slice(0, maxShown);
  const extra = drivers.length - shown.length;
  return (
    <View
      style={styles.stackRow}
      accessibilityLabel={`${drivers.length} ${drivers.length === 1 ? "driver" : "drivers"}: ${drivers.map((driver) => driver.name).join(", ")}`}
    >
      <View style={styles.stack}>
        {shown.map((driver, index) => (
          <View
            key={driver.userId}
            style={[styles.stackItem, index > 0 && styles.overlap]}
          >
            <Avatar driver={driver} size={avatarSize} />
          </View>
        ))}
        {extra > 0 && (
          <View style={[styles.stackItem, styles.overlap, styles.more]}>
            <Text style={styles.moreText}>+{extra}</Text>
          </View>
        )}
      </View>
      <Text style={styles.stackLabel} numberOfLines={1}>
        {label ??
          (drivers.length === 1
            ? drivers[0].name
            : `${drivers.length} drivers`)}
      </Text>
    </View>
  );
}

function Stars({ score }: { score: number }) {
  return (
    <View style={styles.stars} accessibilityLabel={`${score} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          size={13}
          color={value <= score ? starGold : "#d6dbe6"}
          fill={value <= score ? starGold : "transparent"}
        />
      ))}
    </View>
  );
}

export function BookingDetailsModal({
  booking,
  formatDate,
  onRate,
  onClose,
}: {
  booking: Booking | null;
  formatDate: (date: Date) => string;
  onRate: () => void;
  onClose: () => void;
}) {
  if (!booking) return null;
  const rental = booking.kind === "rental";
  const drivers: BookingDriver[] =
    booking.drivers.length > 0
      ? booking.drivers
      : booking.driverName
        ? [
            {
              userId: `driver-${booking.id}`,
              name: booking.driverName,
              initials: booking.driverName.charAt(0).toUpperCase(),
              picture: null,
              vehicleType: booking.vehicleType,
              plateNumber: booking.plateNumber,
              score: booking.drivers.length
                ? null
                : (booking.rating?.score ?? null),
            },
          ]
        : [];

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View accessibilityRole="alert" style={styles.card}>
          <View style={styles.header}>
            <View style={styles.badge}>
              <ClipboardList color="#ffffff" size={22} strokeWidth={2.2} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>
                {rental ? "RENTAL · COMPLETED" : "PICKUP · COMPLETED"}
              </Text>
              <Text style={styles.title} numberOfLines={2}>
                {booking.destination}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              onPress={onClose}
            >
              <X color="#ffffff" size={18} strokeWidth={2.5} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <Detail
              icon={
                <CalendarDays color={palette.brand} size={15} strokeWidth={2} />
              }
            >
              {formatDate(booking.requestedAt)}
            </Detail>
            {booking.passengers !== null && (
              <Detail
                icon={<Users color={palette.brand} size={15} strokeWidth={2} />}
              >
                {booking.passengers}{" "}
                {booking.passengers === 1 ? "passenger" : "passengers"}
              </Detail>
            )}
            {!!booking.purpose && (
              <Detail
                icon={
                  <Sparkles color={palette.brand} size={15} strokeWidth={2} />
                }
              >
                {booking.purpose}
              </Detail>
            )}
            {!!booking.sharedBy && (
              <Detail
                icon={
                  <UsersRound color={palette.brand} size={15} strokeWidth={2} />
                }
              >
                Shared by {booking.sharedBy}
              </Detail>
            )}

            {!rental && booking.riders.length > 0 && (
              <View style={styles.group}>
                <Text style={styles.section}>PASSENGERS</Text>
                {booking.riders.map((rider) => (
                  <View key={rider.userId} style={styles.driverRow}>
                    <Avatar driver={rider} size={40} />
                    <View style={[styles.flex, styles.personText]}>
                      <Text style={styles.driverName} numberOfLines={1}>
                        {rider.isMe ? `${rider.name} (you)` : rider.name}
                      </Text>
                      <Text style={styles.driverMeta}>
                        {rider.isOwner ? "Requested the ride" : "Companion"}
                      </Text>
                    </View>
                    <UserCheck
                      color={palette.success}
                      size={20}
                      strokeWidth={2}
                      accessibilityLabel="Rode along"
                    />
                  </View>
                ))}
              </View>
            )}

            <View style={styles.group}>
              <Text style={styles.section}>
                {drivers.length === 1 ? "DRIVER" : "DRIVERS"}
              </Text>
              {drivers.length === 0 ? (
                <Text style={styles.muted}>
                  No driver details for this booking.
                </Text>
              ) : (
                drivers.map((driver) => (
                  <View key={driver.userId} style={styles.driverRow}>
                    <Avatar driver={driver} size={40} />
                    <View style={[styles.flex, styles.personText]}>
                      <Text style={styles.driverName} numberOfLines={1}>
                        {driver.name}
                      </Text>
                      <Text style={styles.driverMeta} numberOfLines={1}>
                        {[driver.vehicleType, driver.plateNumber]
                          .filter(Boolean)
                          .join(" · ") || "Vehicle details unavailable"}
                      </Text>
                      {rental &&
                        (driver.score ? (
                          <Stars score={driver.score} />
                        ) : (
                          <Text style={styles.notRated}>Not rated yet</Text>
                        ))}
                    </View>
                    <SteeringWheelIcon
                      color={palette.brand}
                      size={20}
                      strokeWidth={2}
                    />
                  </View>
                ))
              )}
            </View>

            {rental && booking.driversToRate > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={onRate}
                style={({ pressed }) => [
                  styles.button,
                  styles.primary,
                  pressed && styles.pressed,
                ]}
              >
                <Star color="#ffffff" size={16} strokeWidth={2.2} />
                <Text style={styles.primaryText}>
                  {booking.driversToRate === 1
                    ? "RATE YOUR DRIVER"
                    : `RATE YOUR DRIVERS (${booking.driversToRate})`}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.button,
                  styles.primary,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryText}>DONE</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Detail({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.detail}>
      {icon}
      <Text style={styles.detailText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  personText: { gap: 2, minWidth: 0 },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#dbe7fb",
  },
  avatarText: { color: palette.navy, fontFamily: "SoraBold" },
  stackRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stack: { flexDirection: "row", alignItems: "center" },
  stackItem: {
    borderWidth: 2,
    borderColor: "#ffffff",
    borderRadius: avatarSize / 2 + 2,
  },
  overlap: { marginLeft: -9 },
  more: {
    width: avatarSize + 4,
    height: avatarSize + 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef1f6",
  },
  moreText: { color: palette.navy, fontFamily: "SoraBold", fontSize: 10 },
  stackLabel: {
    flexShrink: 1,
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 11,
  },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(10, 22, 52, 0.55)",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "88%",
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
    backgroundColor: palette.header,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  badge: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  eyebrow: { color: palette.cyan, fontFamily: "SoraBold", fontSize: 10 },
  title: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 17,
    lineHeight: 22,
  },
  body: { gap: 10, padding: 18 },
  detail: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  detailText: {
    flex: 1,
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 12,
    lineHeight: 18,
  },
  group: { gap: 8, marginTop: 6 },
  section: {
    marginLeft: 2,
    color: "#6b6b6b",
    fontFamily: "SoraBold",
    fontSize: 10,
  },
  muted: { color: "#6b6b6b", fontFamily: "Sora", fontSize: 12 },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#f1f5fc",
  },
  driverName: { color: palette.brand, fontFamily: "SoraBold", fontSize: 13 },
  driverMeta: { color: "#6b6b6b", fontFamily: "Sora", fontSize: 11 },
  stars: { flexDirection: "row", gap: 2, marginTop: 4 },
  notRated: {
    marginTop: 3,
    color: palette.warning,
    fontFamily: "SoraBold",
    fontSize: 10,
  },
  button: {
    flexDirection: "row",
    gap: 8,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    borderRadius: 14,
  },
  primary: { backgroundColor: palette.brand },
  primaryText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 13,
    letterSpacing: 1,
  },
  pressed: { opacity: 0.8 },
});
