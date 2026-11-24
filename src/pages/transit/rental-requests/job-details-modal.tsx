import BriefcaseBusiness from "lucide-react-native/icons/briefcase-business";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import Car from "lucide-react-native/icons/car";
import MapPin from "lucide-react-native/icons/map-pin";
import NotebookPen from "lucide-react-native/icons/notebook-pen";
import Phone from "lucide-react-native/icons/phone";
import Repeat from "lucide-react-native/icons/repeat";
import Sparkles from "lucide-react-native/icons/sparkles";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import Users from "lucide-react-native/icons/users";
import { useState, type ReactNode } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { dropWarning } from "@/api/v1/rentals/drop-policy";
import {
  formatRentalTime,
  type Rental,
  type RentalStanding,
} from "@/api/v1/rentals/controllers";
import { VehicleTypeBadge } from "@/components/card-badges";
import { ReasonModal } from "@/components/reason-modal";
import { palette } from "@/constants/colors";
import { useNow } from "@/hooks/use-now";
import { initialsOf } from "@/utils/initials";

function statusOf(job: Rental) {
  if (job.status === "completed")
    return { label: "COMPLETED", tone: palette.success };
  if (job.status === "accepted")
    return { label: "BOOKED", tone: palette.success };
  if (job.status === "pending" && !job.expired) {
    return {
      label: "BOOKED · WAITING FOR OTHER DRIVERS",
      tone: palette.warning,
    };
  }
  return { label: "CLOSED", tone: "#6b6b6b" };
}

export function JobDetailsModal({
  job,
  standing,
  onClose,
  onDrop,
}: {
  job: Rental | null;
  standing: RentalStanding | null;
  onClose: () => void;
  onDrop: (
    job: Rental,
    reason: string,
    details: string,
  ) => Promise<string | null>;
}) {
  const [confirmingDrop, setConfirmingDrop] = useState(false);
  const now = useNow(30_000);
  if (!job) return null;
  const close = () => {
    setConfirmingDrop(false);
    onClose();
  };
  const status = statusOf(job);
  const mine = job.units.find((unit) => unit.isMine);
  const others = job.units.filter((unit) => !unit.isMine);
  const droppable =
    mine?.status === "booked" &&
    (job.status === "pending" || job.status === "accepted") &&
    job.pickupTime.getTime() > now;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        <View accessibilityRole="alert" style={styles.card}>
          <View style={styles.header}>
            <View style={styles.badge}>
              <BriefcaseBusiness color="#ffffff" size={22} strokeWidth={2.2} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.headerEyebrow, { color: palette.cyan }]}>
                {status.label}
              </Text>
              <Text style={styles.headerTitle} numberOfLines={2}>
                {job.destination}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
            <Detail
              icon={<MapPin color={palette.brand} size={15} strokeWidth={2} />}
            >
              From {job.pickupLocation}
            </Detail>
            <Detail
              icon={
                <CalendarDays color={palette.brand} size={15} strokeWidth={2} />
              }
            >
              {formatRentalTime(job.pickupTime)}
            </Detail>
            {job.tripType === "round_trip" && job.returnTime && (
              <Detail
                icon={
                  <Repeat color={palette.brand} size={15} strokeWidth={2} />
                }
              >
                Round trip · return {formatRentalTime(job.returnTime)}
              </Detail>
            )}
            <Detail
              icon={<Users color={palette.brand} size={15} strokeWidth={2} />}
            >
              {job.passengers}{" "}
              {job.passengers === 1 ? "passenger" : "passengers"} in total
            </Detail>
            <Detail
              icon={
                <Sparkles color={palette.brand} size={15} strokeWidth={2} />
              }
            >
              {job.purpose}
            </Detail>
            {!!job.notes && (
              <Detail
                icon={
                  <NotebookPen
                    color={palette.brand}
                    size={15}
                    strokeWidth={2}
                  />
                }
              >
                {job.notes}
              </Detail>
            )}

            <Text style={styles.section}>YOUR VEHICLE</Text>
            <Detail
              raw
              icon={<Car color={palette.brand} size={15} strokeWidth={2} />}
            >
              {!!mine?.plateNumber && (
                <Text style={[styles.detailText, styles.plate]}>
                  {mine.plateNumber}
                </Text>
              )}
              <VehicleTypeBadge
                type={mine?.vehicleType ?? job.vehicleType ?? "Vehicle"}
              />
            </Detail>

            {others.length > 0 && (
              <>
                <Text style={styles.section}>OTHER VEHICLES</Text>
                {others.map((unit) => (
                  <Detail
                    key={unit.id}
                    raw
                    icon={<Car color="#6b6b6b" size={15} strokeWidth={2} />}
                  >
                    <VehicleTypeBadge type={unit.vehicleType} />
                    <Text style={[styles.detailText, styles.plate]}>
                      {unit.status === "open"
                        ? "Waiting for a driver"
                        : `${unit.driverName ?? "Driver"}${unit.plateNumber ? ` (${unit.plateNumber})` : ""}`}
                    </Text>
                  </Detail>
                ))}
              </>
            )}

            <Text style={styles.section}>COMMUTER</Text>
            <View style={styles.commuter}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {initialsOf(job.commuterName, "C")}
                </Text>
              </View>
              <Text style={styles.commuterName} numberOfLines={1}>
                {job.commuterName ?? "Commuter"}
              </Text>
              {!!job.commuterContact && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${job.commuterName ?? "the commuter"}`}
                  onPress={() => Linking.openURL(`tel:${job.commuterContact}`)}
                  style={({ pressed }) => [
                    styles.call,
                    pressed && styles.pressed,
                  ]}
                >
                  <Phone color="#ffffff" size={16} strokeWidth={2.2} />
                </Pressable>
              )}
            </View>

            {droppable && (
              <View style={styles.dropBox}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint="Asks for a reason before the job is dropped"
                  onPress={() => setConfirmingDrop(true)}
                  style={({ pressed }) => [
                    styles.drop,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.dropText}>DROP THIS JOB</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={close}
              style={({ pressed }) => [styles.done, pressed && styles.pressed]}
            >
              <Text style={styles.doneText}>DONE</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ReasonModal
        visible={confirmingDrop}
        actor="driver"
        title="Drop this job?"
        subtitle={`${job.destination} · ${formatRentalTime(job.pickupTime)}`}
        message={`Your ${mine?.vehicleType.toLowerCase() ?? "vehicle"} goes back on the job board for other drivers.`}
        notice={
          standing ? dropWarning(standing.nextPenalty, standing.drops) : null
        }
        privacyNote="The commuter sees the reason you pick. Your details are only shared with your cooperative."
        confirmLabel="Drop job"
        cancelLabel="Keep job"
        icon={<TriangleAlert color="#ffffff" size={22} strokeWidth={2.2} />}
        onCancel={() => setConfirmingDrop(false)}
        onConfirm={async (reason, details) => {
          const error = await onDrop(job, reason, details);
          if (!error) setConfirmingDrop(false);
          return error;
        }}
      />
    </Modal>
  );
}

function Detail({
  icon,
  raw = false,
  children,
}: {
  icon: ReactNode;
  raw?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.detail, raw && styles.detailCentered]}>
      {icon}
      {raw ? (
        <View style={styles.badgeLine}>{children}</View>
      ) : (
        <Text style={styles.detailText}>{children}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dropBox: { gap: 8, marginTop: 12 },
  drop: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: palette.danger,
  },
  dropText: { color: palette.danger, fontFamily: "SoraBold", fontSize: 13 },
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
  flex: { flex: 1 },
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
  headerEyebrow: { fontFamily: "SoraBold", fontSize: 10 },
  headerTitle: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 17,
    lineHeight: 22,
  },
  close: { alignSelf: "flex-start" },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: 10, padding: 18, paddingBottom: 20 },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: "#e5eaf3",
    backgroundColor: "#ffffff",
  },
  section: {
    marginTop: 6,
    color: "#6b6b6b",
    fontFamily: "SoraBold",
    fontSize: 10,
  },
  detail: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  detailCentered: { alignItems: "center" },
  badgeLine: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  plate: { flex: 0, flexShrink: 1 },
  detailText: {
    flex: 1,
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 12,
    lineHeight: 18,
  },
  commuter: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#e3ecfb",
  },
  avatarText: { color: palette.brand, fontFamily: "SoraBold", fontSize: 14 },
  commuterName: {
    flex: 1,
    color: palette.brand,
    fontFamily: "SoraBold",
    fontSize: 13,
  },
  call: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: palette.brand,
  },
  done: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: palette.brand,
  },
  doneText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 13,
    letterSpacing: 1,
  },
  pressed: { opacity: 0.8 },
});
