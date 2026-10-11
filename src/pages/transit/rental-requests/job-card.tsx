import CalendarDays from "lucide-react-native/icons/calendar-days";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import MapPin from "lucide-react-native/icons/map-pin";
import Repeat from "lucide-react-native/icons/repeat";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import Users from "lucide-react-native/icons/users";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  describeFleet,
  formatRentalTime,
  type Rental,
} from "@/api/v1/rentals/controllers";
import { palette } from "@/constants/colors";

const muted = "#6b6b6b";

export function postedAgo(date: Date) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60_000),
  );
  if (minutes < 1) return "Just posted";
  if (minutes < 60) return `Posted ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Posted ${hours}h ago`;
  return `Posted ${Math.floor(hours / 24)}d ago`;
}

export function JobCard({
  job,
  onPress,
}: {
  job: Rental;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rental job to ${job.destination}, ${formatRentalTime(job.pickupTime)}, ${job.passengers} passengers`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.accent} />
      <View style={styles.content}>
        <View style={styles.tags}>
          {!!(job.unitVehicleType ?? job.vehicleType) && (
            <View style={[styles.tag, styles.vehicleTag]}>
              <Text style={styles.vehicleTagText}>
                {(job.unitVehicleType ?? job.vehicleType ?? "").toUpperCase()}
              </Text>
            </View>
          )}
          {job.units.length > 1 && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{job.units.length} VEHICLES</Text>
            </View>
          )}
          <View style={styles.tag}>
            <Users color={palette.brand} size={11} strokeWidth={2.4} />
            <Text style={styles.tagText}>{job.passengers}</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{job.purpose}</Text>
          </View>
          <Text style={styles.posted}>{postedAgo(job.requestedAt)}</Text>
        </View>

        <Text style={styles.destination} numberOfLines={2}>
          {job.destination}
        </Text>

        <View style={styles.line}>
          <MapPin color={muted} size={13} strokeWidth={2} />
          <Text style={styles.lineText} numberOfLines={1}>
            From {job.pickupLocation}
          </Text>
        </View>
        <View style={styles.line}>
          <CalendarDays color={muted} size={13} strokeWidth={2} />
          <Text style={styles.lineText} numberOfLines={1}>
            {formatRentalTime(job.pickupTime)}
          </Text>
        </View>
        {job.tripType === "round_trip" && job.returnTime && (
          <View style={styles.line}>
            <Repeat color={muted} size={13} strokeWidth={2} />
            <Text style={styles.lineText} numberOfLines={1}>
              Return {formatRentalTime(job.returnTime)}
            </Text>
          </View>
        )}
        {job.units.length > 1 && (
          <Text style={styles.fleet} numberOfLines={2}>
            Needs {describeFleet(job.units.map((unit) => unit.vehicleType))} ·{" "}
            {job.units.filter((unit) => unit.status !== "open").length} of{" "}
            {job.units.length} booked
          </Text>
        )}
        {!!job.notes && (
          <Text style={styles.notes} numberOfLines={2}>
            “{job.notes}”
          </Text>
        )}

        <View style={styles.footer}>
          {job.scheduleConflict ? (
            <View style={styles.conflict}>
              <TriangleAlert
                color={palette.danger}
                size={12}
                strokeWidth={2.4}
              />
              <Text style={styles.conflictText}>
                CLASHES WITH YOUR SCHEDULE
              </Text>
            </View>
          ) : (
            <View />
          )}
          <View style={styles.view}>
            <Text style={styles.viewText}>VIEW JOB</Text>
            <ChevronRight color={palette.brand} size={16} strokeWidth={2.5} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#dbe4f5",
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },
  pressed: { opacity: 0.85 },
  accent: { width: 6, backgroundColor: palette.brand },
  content: { flex: 1, gap: 6, padding: 14 },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "#e3ecfb",
  },
  vehicleTag: { backgroundColor: palette.brand },
  vehicleTagText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 10 },
  tagText: { color: palette.brand, fontFamily: "SoraBold", fontSize: 10 },
  posted: {
    marginLeft: "auto",
    color: muted,
    fontFamily: "Sora",
    fontSize: 10,
  },
  destination: {
    marginTop: 2,
    color: palette.brand,
    fontFamily: "SoraBold",
    fontSize: 16,
    lineHeight: 21,
  },
  line: { flexDirection: "row", alignItems: "center", gap: 6 },
  lineText: { flex: 1, color: "#111111", fontFamily: "Sora", fontSize: 12 },
  fleet: { color: palette.brand, fontFamily: "SoraBold", fontSize: 11 },
  notes: {
    color: muted,
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
    fontStyle: "italic",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eef1f6",
  },
  conflict: { flexDirection: "row", alignItems: "center", gap: 4 },
  conflictText: { color: palette.danger, fontFamily: "SoraBold", fontSize: 10 },
  view: { flexDirection: "row", alignItems: "center", gap: 2 },
  viewText: { color: palette.brand, fontFamily: "SoraBold", fontSize: 11 },
});
