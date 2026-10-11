import BriefcaseBusiness from "lucide-react-native/icons/briefcase-business";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import Car from "lucide-react-native/icons/car";
import CircleCheck from "lucide-react-native/icons/circle-check";
import MapPin from "lucide-react-native/icons/map-pin";
import NotebookPen from "lucide-react-native/icons/notebook-pen";
import Repeat from "lucide-react-native/icons/repeat";
import Sparkles from "lucide-react-native/icons/sparkles";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import UserRound from "lucide-react-native/icons/user-round";
import Users from "lucide-react-native/icons/users";
import X from "lucide-react-native/icons/x";
import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import {
  describeFleet,
  formatRentalTime,
  type Rental,
} from "@/api/v1/rentals/controllers";
import { ErrorAlert } from "@/components/error-alert";
import { LoadingLogo } from "@/components/LoadingLogo";
import { palette } from "@/constants/colors";

const muted = "#6b6b6b";

export function JobModal({
  job,
  busy,
  problem,
  booked,
  onAccept,
  onDismiss,
  onClose,
  onViewJobs,
}: {
  job: Rental | null;
  busy: "accept" | "dismiss" | null;
  problem: string;
  booked: boolean;
  onAccept: () => void;
  onDismiss: () => void;
  onClose: () => void;
  onViewJobs: () => void;
}) {
  return (
    <Modal
      visible={!!job}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={busy ? () => undefined : onClose}
    >
      <View style={styles.backdrop}>
        {job && (
          <View accessibilityRole="alert" style={styles.card}>
            <View style={styles.header}>
              <View style={styles.badge}>
                {booked ? (
                  <CircleCheck color="#ffffff" size={22} strokeWidth={2.2} />
                ) : (
                  <BriefcaseBusiness
                    color="#ffffff"
                    size={22}
                    strokeWidth={2.2}
                  />
                )}
              </View>
              <View style={styles.flex}>
                <Text style={styles.headerEyebrow}>
                  {booked ? "JOB BOOKED" : "RENTAL JOB"}
                </Text>
                <Text style={styles.headerTitle} numberOfLines={2}>
                  {job.destination}
                </Text>
              </View>
              {!busy && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  hitSlop={10}
                  onPress={onClose}
                  style={styles.close}
                >
                  <X color="#ffffff" size={18} strokeWidth={2.5} />
                </Pressable>
              )}
            </View>

            {booked ? (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={styles.body}
              >
                <Text style={styles.bookedText}>
                  You&apos;re booked for this trip on{" "}
                  {formatRentalTime(job.pickupTime)}. The commuter has been
                  notified, and the job is saved in My jobs.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onViewJobs}
                  style={({ pressed }) => [
                    styles.button,
                    styles.primary,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryText}>VIEW MY JOBS</Text>
                </Pressable>
              </Animated.View>
            ) : (
              <View style={styles.body}>
                <Detail
                  icon={
                    <MapPin color={palette.brand} size={15} strokeWidth={2} />
                  }
                >
                  From {job.pickupLocation}
                </Detail>
                <Detail
                  icon={
                    <CalendarDays
                      color={palette.brand}
                      size={15}
                      strokeWidth={2}
                    />
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
                  icon={
                    <Users color={palette.brand} size={15} strokeWidth={2} />
                  }
                >
                  {job.passengers}{" "}
                  {job.passengers === 1 ? "passenger" : "passengers"} in total
                </Detail>
                <Detail
                  icon={<Car color={palette.brand} size={15} strokeWidth={2} />}
                >
                  You&apos;d drive: 1 {job.unitVehicleType ?? job.vehicleType}
                  {job.units.length > 1
                    ? ` · the rental needs ${describeFleet(job.units.map((unit) => unit.vehicleType))} (${job.units.filter((unit) => unit.status !== "open").length} of ${job.units.length} booked)`
                    : ""}
                </Detail>
                <Detail
                  icon={
                    <Sparkles color={palette.brand} size={15} strokeWidth={2} />
                  }
                >
                  {job.purpose}
                </Detail>
                {!!job.commuterName && (
                  <Detail
                    icon={
                      <UserRound
                        color={palette.brand}
                        size={15}
                        strokeWidth={2}
                      />
                    }
                  >
                    Requested by {job.commuterName}
                  </Detail>
                )}
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

                {job.scheduleConflict && (
                  <View style={styles.conflict}>
                    <TriangleAlert
                      color={palette.danger}
                      size={16}
                      strokeWidth={2.2}
                    />
                    <Text style={styles.conflictText}>
                      This clashes with a rental you already have on these
                      dates.
                    </Text>
                  </View>
                )}
                {!!problem && (
                  <ErrorAlert title="Rental job" message={problem} />
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: !!busy || job.scheduleConflict,
                    busy: busy === "accept",
                  }}
                  disabled={!!busy || job.scheduleConflict}
                  onPress={onAccept}
                  style={({ pressed }) => [
                    styles.button,
                    styles.primary,
                    (pressed || job.scheduleConflict) && styles.pressed,
                  ]}
                >
                  {busy === "accept" ? (
                    <LoadingLogo color="#ffffff" size={20} label="Accepting" />
                  ) : (
                    <Text style={styles.primaryText}>ACCEPT JOB</Text>
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={!!busy}
                  onPress={onDismiss}
                  style={({ pressed }) => [
                    styles.button,
                    styles.secondary,
                    pressed && styles.pressed,
                  ]}
                >
                  {busy === "dismiss" ? (
                    <LoadingLogo size={20} label="Removing" />
                  ) : (
                    <Text style={styles.secondaryText}>NOT INTERESTED</Text>
                  )}
                </Pressable>
                <Text style={styles.footnote}>
                  Not interested removes this job from your board. The first
                  driver to accept gets the trip.
                </Text>
              </View>
            )}
          </View>
        )}
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
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(10, 22, 52, 0.55)",
  },
  card: {
    width: "100%",
    maxWidth: 400,
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
  headerEyebrow: { color: palette.cyan, fontFamily: "SoraBold", fontSize: 10 },
  headerTitle: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 17,
    lineHeight: 22,
  },
  close: { alignSelf: "flex-start" },
  body: { gap: 10, padding: 18 },
  detail: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  detailText: {
    flex: 1,
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 12,
    lineHeight: 18,
  },
  conflict: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: palette.dangerSoft,
  },
  conflictText: {
    flex: 1,
    color: palette.dangerText,
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
  },
  bookedText: {
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  primary: { marginTop: 6, backgroundColor: palette.brand },
  secondary: { borderWidth: 1.5, borderColor: palette.brand },
  primaryText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 13,
    letterSpacing: 1,
  },
  secondaryText: {
    color: palette.brand,
    fontFamily: "SoraBold",
    fontSize: 13,
    letterSpacing: 1,
  },
  footnote: {
    color: muted,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
  },
  pressed: { opacity: 0.6 },
});
