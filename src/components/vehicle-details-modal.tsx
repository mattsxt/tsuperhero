import Route from "lucide-react-native/icons/route";
import Settings from "lucide-react-native/icons/settings";
import Sparkles from "lucide-react-native/icons/sparkles";
import X from "lucide-react-native/icons/x";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type {
  LiveVehicle,
  OccupancyLevel,
} from "@/api/v1/transit-routes/controllers";
import { VehicleIcon } from "@/components/module-icons";
import { moduleColors } from "@/components/module-ui";
import { palette } from "@/constants/colors";
import { isSimulation } from "@/simulation/flag";
import {
  generatedVehicleSettings,
  updateGeneratedVehicle,
} from "@/simulation/generated-vehicles";
import {
  FooterButtons,
  SettingsCard,
  VehicleSettingsFields,
  type VehicleSettingsValue,
} from "@/simulation/ui/vehicle-settings";

const { brandBlue, headerBlue, mutedText, softBlue, text } = moduleColors;

const occupancyColors: Record<OccupancyLevel, string> = {
  Available: palette.success,
  Moderate: "#b45309",
  "Almost Full": "#c2410c",
  Full: palette.danger,
};

export function VehicleCard({
  vehicle,
  width,
  onPress,
  mine = false,
}: {
  vehicle: LiveVehicle;
  width: number;
  onPress: () => void;
  mine?: boolean;
}) {
  const fill = vehicle.isFull
    ? 1
    : Math.min(vehicle.currentCapacity / Math.max(vehicle.maxCapacity, 1), 1);
  const occupancyColor = occupancyColors[vehicle.occupancy];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${mine ? "Your ride, " : ""}${vehicle.plateNumber}${vehicle.generated ? ", generated" : ""}, ${vehicle.occupancy}. Show details`}
      onPress={onPress}
      style={({ pressed }) => [
        cardStyles.card,
        { width },
        mine && cardStyles.mine,
        vehicle.stale && cardStyles.stale,
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
        {vehicle.generated && <GeneratedTag compact />}
        <View style={cardStyles.status}>
          <Text style={cardStyles.statusText} numberOfLines={1}>
            {vehicle.stale
              ? `Last seen ${vehicle.minutesSinceSeen} min ago`
              : vehicle.status}
          </Text>
        </View>
      </View>

      <View style={cardStyles.routeLine}>
        <View style={cardStyles.route}>
          <Route color={brandBlue} size={12} strokeWidth={2.2} />
          <Text style={cardStyles.routeText} numberOfLines={1}>
            {vehicle.routeName ?? (mine ? "Coming to pick you up" : "No route assigned")}
          </Text>
        </View>
        {mine && (
          <View style={cardStyles.mineTag}>
            <Text style={cardStyles.mineTagText}>YOUR RIDE</Text>
          </View>
        )}
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
  const [controlsFor, setControlsFor] = useState<string | null>(null);
  const controls = !!vehicle && controlsFor === vehicle.id;
  const setControls = (open: boolean) =>
    setControlsFor(open && vehicle ? vehicle.id : null);
  const close = () => {
    setControls(false);
    onClose();
  };
  const canControl = isSimulation() && !!vehicle?.generated;

  return (
    <Modal
      visible={!!vehicle}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={controls ? () => setControls(false) : close}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="Close vehicle details"
          style={StyleSheet.absoluteFill}
          onPress={close}
        />
        {vehicle && controls && canControl && (
          <VehicleControls
            vehicleId={vehicle.id}
            plate={vehicle.plateNumber}
            onDone={() => setControls(false)}
          />
        )}
        {vehicle && !controls && (
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
              {vehicle.generated && <GeneratedTag />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close vehicle details"
                hitSlop={10}
                onPress={close}
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

              {canControl && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Vehicle controls"
                  accessibilityHint="Change this generated vehicle's status and occupancy"
                  onPress={() => setControls(true)}
                  style={({ pressed }) => [
                    styles.controlsButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Settings color={brandBlue} size={18} strokeWidth={2.2} />
                  <Text style={styles.controlsText}>CONTROLS</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function GeneratedTag({ compact = false }: { compact?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel="Generated for the demo"
      style={[styles.generatedTag, compact && styles.generatedTagCompact]}
    >
      <Sparkles color={palette.warning} size={compact ? 10 : 12} strokeWidth={2.4} />
      {!compact && <Text style={styles.generatedText}>GENERATED</Text>}
    </View>
  );
}

function VehicleControls({
  vehicleId,
  plate,
  onDone,
}: {
  vehicleId: string;
  plate: string;
  onDone: () => void;
}) {
  const [current] = useState(() => generatedVehicleSettings(vehicleId));
  const [value, setValue] = useState<VehicleSettingsValue | null>(
    current
      ? {
          status: current.status,
          dynamic: current.dynamic,
          occupancy: current.occupancy,
        }
      : null,
  );
  const [error, setError] = useState("");

  const save = () => {
    if (!value) return onDone();
    const result = updateGeneratedVehicle(vehicleId, value);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onDone();
  };

  return (
    <SettingsCard
      title="Vehicle controls"
      subtitle={plate}
      onClose={onDone}
      footer={
        <FooterButtons
          confirmLabel="SAVE"
          disabled={!value}
          onCancel={onDone}
          onConfirm={save}
        />
      }
    >
      {current && value ? (
        <VehicleSettingsFields
          type={current.type}
          value={value}
          onChange={setValue}
          showStatus
        />
      ) : (
        <Text style={styles.label}>This vehicle is no longer in the demo.</Text>
      )}
      {!!error && <Text style={styles.controlsError}>{error}</Text>}
    </SettingsCard>
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
  generatedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: palette.warningSoft,
  },
  generatedTagCompact: { paddingHorizontal: 5, paddingVertical: 5 },
  generatedText: {
    color: palette.warning,
    fontFamily: "SoraBold",
    fontSize: 9,
    letterSpacing: 0.5,
  },
  controlsButton: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: brandBlue,
    backgroundColor: "#ffffff",
  },
  controlsText: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 13,
    letterSpacing: 1,
  },
  controlsError: {
    color: palette.danger,
    fontFamily: "SoraBold",
    fontSize: 12,
    textAlign: "center",
  },
  pressed: { opacity: 0.8 },
  capacityFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
});

const cardStyles = StyleSheet.create({
  stale: { opacity: 0.6 },
  mine: { borderWidth: 2, borderColor: "#1e9e45" },
  routeLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  mineTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: palette.successSoft,
  },
  mineTagText: {
    color: palette.success,
    fontFamily: "SoraBold",
    fontSize: 9,
    letterSpacing: 0.5,
  },
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
  type: { color: mutedText, fontFamily: "Sora", fontSize: 10, marginTop: 1 },
  status: {
    maxWidth: 96,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: softBlue,
  },
  statusText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 10 },
  route: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
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
    fontSize: 10,
  },
  capacityRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  occupancy: { fontFamily: "SoraBold", fontSize: 11 },
  capacity: { color: text, fontFamily: "Sora", fontSize: 10 },
});
