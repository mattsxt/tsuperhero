import Route from "lucide-react-native/icons/route";
import X from "lucide-react-native/icons/x";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type {
  LiveVehicle,
  OccupancyLevel,
} from "@/api/v1/transit-routes/controllers";
import { VehicleIcon } from "@/components/module-icons";
import { moduleColors } from "@/components/module-ui";

const { brandBlue, headerBlue, mutedText, softBlue, text } = moduleColors;

const occupancyColors: Record<OccupancyLevel, string> = {
  Available: "#15803d",
  Moderate: "#b45309",
  "Almost Full": "#c2410c",
  Full: "#b91c1c",
};

export function VehicleCard({
  vehicle,
  width,
  onPress,
}: {
  vehicle: LiveVehicle;
  width: number;
  onPress: () => void;
}) {
  const fill = vehicle.isFull
    ? 1
    : Math.min(vehicle.currentCapacity / Math.max(vehicle.maxCapacity, 1), 1);
  const occupancyColor = occupancyColors[vehicle.occupancy];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${vehicle.plateNumber}, ${vehicle.occupancy}. Show details`}
      onPress={onPress}
      style={({ pressed }) => [
        cardStyles.card,
        { width },
        pressed && cardStyles.pressed,
      ]}
    >
      <View style={cardStyles.top}>
        <View style={cardStyles.icon}>
          <VehicleIcon type={vehicle.type} color="#ffffff" size={20} />
        </View>
        <View style={styles.flex}>
          <Text style={cardStyles.plate} numberOfLines={1}>
            {vehicle.plateNumber}
          </Text>
          <Text style={cardStyles.type}>{vehicle.typeLabel}</Text>
        </View>
        <View style={cardStyles.status}>
          <Text style={cardStyles.statusText} numberOfLines={1}>
            {vehicle.status}
          </Text>
        </View>
      </View>

      <View style={cardStyles.route}>
        <Route color={brandBlue} size={12} strokeWidth={2.2} />
        <Text style={cardStyles.routeText} numberOfLines={1}>
          {vehicle.routeName ?? "No route assigned"}
        </Text>
      </View>

      <View style={cardStyles.capacityRow}>
        <Text style={[cardStyles.occupancy, { color: occupancyColor }]}>
          {vehicle.occupancy}
        </Text>
        <Text style={cardStyles.capacity}>
          {vehicle.currentCapacity}/{vehicle.maxCapacity} passengers
        </Text>
      </View>
      <View style={styles.bar}>
        <View
          style={[
            styles.barFill,
            { width: `${fill * 100}%`, backgroundColor: occupancyColor },
          ]}
        />
      </View>
    </Pressable>
  );
}

export function VehicleDetailsModal({
  vehicle,
  onClose,
}: {
  vehicle: LiveVehicle | null;
  onClose: () => void;
}) {
  const fill = vehicle
    ? vehicle.isFull
      ? 1
      : Math.min(vehicle.currentCapacity / Math.max(vehicle.maxCapacity, 1), 1)
    : 0;
  const occupancyColor = vehicle ? occupancyColors[vehicle.occupancy] : text;

  return (
    <Modal
      visible={!!vehicle}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="Close vehicle details"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        {vehicle && (
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <VehicleIcon type={vehicle.type} color="#ffffff" size={30} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.plate} numberOfLines={1}>
                  {vehicle.plateNumber}
                </Text>
                <Text style={styles.type}>{vehicle.typeLabel}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close vehicle details"
                hitSlop={10}
                onPress={onClose}
                style={styles.close}
              >
                <X color="#ffffff" size={18} strokeWidth={2.5} />
              </Pressable>
            </View>

            <View style={styles.body}>
              <View style={styles.routeRow}>
                <Route color={brandBlue} size={15} strokeWidth={2.2} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {vehicle.routeName ?? "No route assigned"}
                </Text>
              </View>

              <View style={styles.statsRow}>
                <Stat label="Status" value={vehicle.status} />
                <Stat
                  label="Occupancy Level"
                  value={vehicle.occupancy}
                  color={occupancyColor}
                />
              </View>

              <View>
                <View style={styles.capacityHeader}>
                  <Text style={styles.label}>Capacity</Text>
                  <Text style={styles.capacityValue}>
                    {vehicle.currentCapacity} / {vehicle.maxCapacity} passengers
                  </Text>
                </View>
                <View style={styles.bar}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${fill * 100}%`,
                        backgroundColor: occupancyColor,
                      },
                    ]}
                  />
                </View>
                <View style={styles.capacityFooter}>
                  <Text style={styles.label}>
                    Current: {vehicle.currentCapacity}
                  </Text>
                  <Text style={styles.label}>Max: {vehicle.maxCapacity}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function Stat({
  label,
  value,
  color = text,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.statValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  flex: { flex: 1 },
  card: { overflow: "hidden", borderRadius: 16, backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    backgroundColor: headerBlue,
  },
  headerIcon: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  plate: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 17 },
  type: { color: "#ffffff", fontFamily: "Sora", fontSize: 11, marginTop: 2 },
  close: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  body: { gap: 16, padding: 16 },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: softBlue,
  },
  routeText: {
    flexShrink: 1,
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 11,
  },
  statsRow: { flexDirection: "row", gap: 12 },
  stat: {
    flex: 1,
    gap: 3,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f5f7fb",
  },
  label: { color: mutedText, fontFamily: "Sora", fontSize: 10 },
  statValue: { fontFamily: "SoraBold", fontSize: 13 },
  capacityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 6,
  },
  capacityValue: { color: text, fontFamily: "SoraBold", fontSize: 12 },
  bar: {
    height: 8,
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: "#e5e7eb",
  },
  barFill: { height: "100%", borderRadius: 4 },
  capacityFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    gap: 9,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },
  pressed: { opacity: 0.85 },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: {
    padding: 6,
    borderRadius: 9,
    backgroundColor: headerBlue,
  },
  plate: { color: brandBlue, fontFamily: "SoraBold", fontSize: 14 },
  type: { color: mutedText, fontFamily: "Sora", fontSize: 9, marginTop: 1 },
  status: {
    maxWidth: 96,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: softBlue,
  },
  statusText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 8 },
  route: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: softBlue,
  },
  routeText: {
    flexShrink: 1,
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 9,
  },
  capacityRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  occupancy: { fontFamily: "SoraBold", fontSize: 11 },
  capacity: { color: text, fontFamily: "Sora", fontSize: 9 },
});
