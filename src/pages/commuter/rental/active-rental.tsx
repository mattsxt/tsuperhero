import BusFront from "lucide-react-native/icons/bus-front";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import CircleCheck from "lucide-react-native/icons/circle-check";
import MapPin from "lucide-react-native/icons/map-pin";
import NotebookPen from "lucide-react-native/icons/notebook-pen";
import Phone from "lucide-react-native/icons/phone";
import UserMinus from "lucide-react-native/icons/user-minus";
import Repeat from "lucide-react-native/icons/repeat";
import Sparkles from "lucide-react-native/icons/sparkles";
import Users from "lucide-react-native/icons/users";
import XCircle from "lucide-react-native/icons/circle-x";
import { useState, type ReactNode } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import {
  describeFleet,
  formatRentalTime,
  type Rental,
  type RentalUnit,
} from "@/api/v1/rentals/controllers";
import { ConfirmModal } from "@/components/confirm-modal";
import { ErrorAlert } from "@/components/error-alert";
import { LoadingLogo } from "@/components/LoadingLogo";
import { palette } from "@/constants/colors";

const panelText = "#d6e2f5";

function postedAgo(date: Date) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60_000),
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export function ActiveRental({
  rental,
  busy,
  completing,
  problem,
  onCancel,
  onComplete,
  removingId,
  onRemoveDriver,
}: {
  removingId: string | null;
  onRemoveDriver: (unitId: string) => void;
  rental: Rental;
  busy: boolean;
  completing: boolean;
  problem: string;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmingDone, setConfirmingDone] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RentalUnit | null>(null);
  const booked = rental.status === "accepted";
  const units: RentalUnit[] = rental.units.length
    ? rental.units
    : [
        {
          id: rental.id,
          vehicleType: rental.vehicleType ?? "Vehicle",
          status: booked ? "booked" : "open",
          isMine: false,
          driverName: rental.driverName,
          plateNumber: rental.plateNumber,
          driverContact: rental.driverContact,
          driverId: null,
          myScore: null,
        },
      ];
  const bookedCount = units.filter((unit) => unit.status !== "open").length;
  const partly = !booked && bookedCount > 0;
  const statusLabel = booked
    ? "BOOKED"
    : partly
      ? `${bookedCount} OF ${units.length} BOOKED`
      : units.length > 1
        ? "WAITING FOR DRIVERS"
        : "WAITING FOR A DRIVER";
  const fleet = describeFleet(units.map((unit) => unit.vehicleType));

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.wrap}>
      <View style={styles.card}>
        <View style={[styles.status, booked ? styles.booked : styles.waiting]}>
          {booked ? (
            <CircleCheck color={palette.success} size={13} strokeWidth={2.4} />
          ) : (
            <LoadingLogo color={palette.warning} size={13} label="Waiting" />
          )}
          <Text
            style={[
              styles.statusText,
              { color: booked ? palette.success : palette.warning },
            ]}
          >
            {statusLabel}
          </Text>
        </View>

        <Text style={styles.eyebrow}>YOUR RENTAL TO</Text>
        <Text style={styles.destination} numberOfLines={2}>
          {rental.destination}
        </Text>

        <View style={styles.details}>
          <Detail
            icon={<MapPin color={palette.cyan} size={15} strokeWidth={2} />}
          >
            From {rental.pickupLocation}
          </Detail>
          <Detail
            icon={
              <CalendarDays color={palette.cyan} size={15} strokeWidth={2} />
            }
          >
            {formatRentalTime(rental.pickupTime)}
          </Detail>
          {rental.tripType === "round_trip" && rental.returnTime && (
            <Detail
              icon={<Repeat color={palette.cyan} size={15} strokeWidth={2} />}
            >
              Return {formatRentalTime(rental.returnTime)}
            </Detail>
          )}
          <Detail
            icon={<Users color={palette.cyan} size={15} strokeWidth={2} />}
          >
            {rental.passengers}{" "}
            {rental.passengers === 1 ? "passenger" : "passengers"} · {fleet}
          </Detail>
          <Detail
            icon={<Sparkles color={palette.cyan} size={15} strokeWidth={2} />}
          >
            {rental.purpose}
          </Detail>
          {!!rental.notes && (
            <Detail
              icon={
                <NotebookPen color={palette.cyan} size={15} strokeWidth={2} />
              }
            >
              {rental.notes}
            </Detail>
          )}
        </View>

        <Text style={styles.eyebrow}>
          {units.length === 1 ? "YOUR VEHICLE" : "YOUR VEHICLES"}
        </Text>
        <View style={styles.units}>
          {units.map((unit) => (
            <View key={unit.id} style={styles.driver}>
              <View
                style={[
                  styles.driverAvatar,
                  unit.status === "open" && styles.driverAvatarOpen,
                ]}
              >
                {unit.status === "open" ? (
                  <LoadingLogo color={palette.cyan} size={18} label="Waiting" />
                ) : (
                  <Text style={styles.driverInitial}>
                    {(unit.driverName ?? "D").charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.flex}>
                <Text style={styles.driverLabel}>
                  {unit.vehicleType.toUpperCase()}
                </Text>
                <Text style={styles.driverName} numberOfLines={1}>
                  {unit.status === "open"
                    ? "Waiting for a driver"
                    : (unit.driverName ?? "Your driver")}
                </Text>
                {unit.status !== "open" && !!unit.plateNumber && (
                  <Text style={styles.driverMeta} numberOfLines={1}>
                    {unit.plateNumber}
                  </Text>
                )}
                {unit.status !== "open" && !!unit.driverContact && (
                  <Text
                    style={styles.driverPhone}
                    numberOfLines={1}
                    accessibilityLabel={`Mobile number ${unit.driverContact}`}
                  >
                    {unit.driverContact}
                  </Text>
                )}
              </View>
              {unit.status !== "open" && !!unit.driverContact && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${unit.driverName ?? "your driver"}`}
                  onPress={() => Linking.openURL(`tel:${unit.driverContact}`)}
                  style={({ pressed }) => [
                    styles.call,
                    pressed && styles.pressed,
                  ]}
                >
                  <Phone color={palette.navy} size={18} strokeWidth={2.2} />
                </Pressable>
              )}
              {unit.status === "booked" && rental.units.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${unit.driverName ?? "this driver"} from your rental`}
                  disabled={!!removingId || busy}
                  onPress={() => setRemoveTarget(unit)}
                  style={({ pressed }) => [
                    styles.remove,
                    (pressed || removingId === unit.id) && styles.pressed,
                  ]}
                >
                  {removingId === unit.id ? (
                    <LoadingLogo color="#ffffff" size={16} label="Removing" />
                  ) : (
                    <UserMinus color="#ffffff" size={17} strokeWidth={2.2} />
                  )}
                </Pressable>
              )}
            </View>
          ))}
        </View>

        {!booked && (
          <View style={styles.board}>
            <BusFront color={palette.cyan} size={18} strokeWidth={2} />
            <Text style={styles.boardText}>
              Your request is on the job board. Each vehicle is booked by its
              own driver, and you&apos;ll be notified as each one accepts.
              Posted {postedAgo(rental.requestedAt)}.
            </Text>
          </View>
        )}
      </View>

      {!!problem && <ErrorAlert title="Rental" message={problem} />}

      {bookedCount > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark this rental as completed"
          accessibilityState={{
            disabled: completing || busy,
            busy: completing,
          }}
          disabled={completing || busy}
          onPress={() => setConfirmingDone(true)}
          style={({ pressed }) => [
            styles.complete,
            (pressed || completing) && styles.pressed,
          ]}
        >
          <Text style={styles.completeText}>
            {completing ? "COMPLETING..." : "MARK AS COMPLETED"}
          </Text>
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel this rental"
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={() => setConfirming(true)}
        style={({ pressed }) => [
          styles.cancel,
          (pressed || busy) && styles.pressed,
        ]}
      >
        <Text style={styles.cancelText}>
          {busy ? "CANCELLING..." : "CANCEL RENTAL"}
        </Text>
      </Pressable>
      <Text style={styles.hint}>
        Need to change something? Cancel this request and post a new one.
      </Text>

      <ConfirmModal
        visible={!!removeTarget}
        title={`Remove ${removeTarget?.driverName ?? "this driver"} from this rental?`}
        message={`Their ${removeTarget?.vehicleType.toLowerCase() ?? "vehicle"} goes back on the job board for other drivers, and ${removeTarget?.driverName ?? "the driver"} will be notified.`}
        confirmLabel="Remove driver"
        cancelLabel="Keep driver"
        destructive
        icon={<UserMinus color="#ffffff" size={22} strokeWidth={2.2} />}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) onRemoveDriver(removeTarget.id);
          setRemoveTarget(null);
        }}
      />

      <ConfirmModal
        visible={confirmingDone}
        title="Mark this rental as completed?"
        message={`Do this once your trip is done. ${bookedCount === 1 ? "Your driver" : "Your drivers"} will be notified and the rental moves to your bookings.${bookedCount < units.length ? " Vehicles no driver took are dropped." : ""}`}
        confirmLabel="Mark as completed"
        cancelLabel="Not yet"
        icon={<CircleCheck color="#ffffff" size={22} strokeWidth={2.2} />}
        onCancel={() => setConfirmingDone(false)}
        onConfirm={() => {
          setConfirmingDone(false);
          onComplete();
        }}
      />

      <ConfirmModal
        visible={confirming}
        title="Cancel this rental?"
        message={
          bookedCount > 0
            ? `${bookedCount === 1 ? "Your driver" : "Your drivers"} will be notified that your rental to ${rental.destination} is cancelled.`
            : `Your request to ${rental.destination} will be taken off the job board.`
        }
        confirmLabel="Cancel rental"
        cancelLabel="Keep rental"
        destructive
        icon={<XCircle color="#ffffff" size={22} strokeWidth={2.2} />}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onCancel();
        }}
      />
    </Animated.View>
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
  wrap: { gap: 12, marginTop: 8 },
  flex: { flex: 1 },
  card: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: palette.navy,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  waiting: { backgroundColor: palette.warningSoft },
  booked: { backgroundColor: palette.successSoft },
  statusText: { fontFamily: "SoraBold", fontSize: 10 },
  eyebrow: {
    marginTop: 4,
    color: palette.cyan,
    fontFamily: "SoraBold",
    fontSize: 10,
  },
  destination: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 20,
    lineHeight: 26,
  },
  details: { gap: 8, marginTop: 4 },
  detail: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  detailText: {
    flex: 1,
    color: panelText,
    fontFamily: "Sora",
    fontSize: 12,
    lineHeight: 17,
  },
  board: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(127, 212, 247, 0.12)",
  },
  boardText: {
    flex: 1,
    color: "#ffffff",
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
  },
  driver: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  driverAvatar: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: palette.cyan,
  },
  units: { gap: 8 },
  driverAvatarOpen: { backgroundColor: "rgba(127, 212, 247, 0.16)" },
  driverInitial: { color: palette.navy, fontFamily: "SoraBold", fontSize: 16 },
  driverLabel: { color: palette.cyan, fontFamily: "SoraBold", fontSize: 10 },
  driverName: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 14 },
  driverMeta: { color: panelText, fontFamily: "Sora", fontSize: 11 },
  driverPhone: {
    marginTop: 1,
    color: palette.cyan,
    fontFamily: "SoraBold",
    fontSize: 12,
  },
  remove: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: palette.danger,
  },
  call: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: palette.cyan,
  },
  complete: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: palette.brand,
  },
  completeText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 13,
    letterSpacing: 1,
  },
  cancel: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: palette.danger,
  },
  cancelText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 13,
    letterSpacing: 1,
  },
  hint: {
    color: "#6b6b6b",
    fontFamily: "Sora",
    fontSize: 11,
    textAlign: "center",
  },
  pressed: { opacity: 0.8 },
});
