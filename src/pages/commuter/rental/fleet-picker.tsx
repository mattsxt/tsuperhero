import { Image } from "expo-image";
import Minus from "lucide-react-native/icons/minus";
import Plus from "lucide-react-native/icons/plus";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  charterVehicleOrder,
  fleetSize,
  type CharterVehicle,
  type Fleet,
} from "@/api/v1/rentals/controllers";
import { palette } from "@/constants/colors";

export const maxFleet = 10;

export const vehicleNames: Record<CharterVehicle, string> = {
  van: "Van",
  jeep: "Jeepney",
  bus: "Bus",
  tricy: "Tricycle",
};

export const vehicleCapacity: Record<CharterVehicle, number> = {
  van: 14,
  jeep: 20,
  bus: 50,
  tricy: 4,
};

const vehicleIcons: Record<CharterVehicle, number> = {
  van: require("@/assets/images/van.svg"),
  jeep: require("@/assets/images/jeepney.svg"),
  bus: require("@/assets/images/bus.svg"),
  tricy: require("@/assets/images/tricycle.svg"),
};

export const fleetSeats = (fleet: Fleet) =>
  charterVehicleOrder.reduce(
    (total, vehicle) => total + fleet[vehicle] * vehicleCapacity[vehicle],
    0,
  );

export const fleetLabel = (fleet: Fleet) =>
  charterVehicleOrder
    .filter((vehicle) => fleet[vehicle] > 0)
    .map(
      (vehicle) =>
        `${fleet[vehicle]} ${vehicleNames[vehicle]}${fleet[vehicle] === 1 ? "" : "s"}`,
    )
    .join(", ");

export function FleetPicker({
  fleet,
  onChange,
}: {
  fleet: Fleet;
  onChange: (fleet: Fleet) => void;
}) {
  const total = fleetSize(fleet);
  const change = (vehicle: CharterVehicle, by: number) =>
    onChange({ ...fleet, [vehicle]: Math.max(0, fleet[vehicle] + by) });

  return (
    <View style={styles.wrap}>
      <View style={styles.summary}>
        <Text style={styles.summaryCount}>
          {total} {total === 1 ? "vehicle" : "vehicles"}
        </Text>
        <Text style={styles.summaryText} numberOfLines={2}>
          {total > 0
            ? `${fleetLabel(fleet)} · seats up to ${fleetSeats(fleet)}`
            : "Add the vehicles you need below."}
        </Text>
      </View>

      {charterVehicleOrder.map((vehicle) => {
        const count = fleet[vehicle];
        const name = vehicleNames[vehicle];
        return (
          <View
            key={vehicle}
            style={[styles.row, count > 0 && styles.rowSelected]}
          >
            <View style={styles.icon}>
              <Image
                source={vehicleIcons[vehicle]}
                style={styles.iconImage}
                tintColor="#000000"
                contentFit="contain"
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.seats}>
                Seats up to {vehicleCapacity[vehicle]}
              </Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`One less ${name.toLowerCase()}`}
                accessibilityState={{ disabled: count === 0 }}
                disabled={count === 0}
                hitSlop={6}
                onPress={() => change(vehicle, -1)}
                style={[styles.stepButton, count === 0 && styles.stepDisabled]}
              >
                <Minus color={palette.brand} size={16} strokeWidth={2.5} />
              </Pressable>
              <Text
                style={styles.count}
                accessibilityLabel={`${count} ${name.toLowerCase()}`}
              >
                {count}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`One more ${name.toLowerCase()}`}
                accessibilityState={{ disabled: total >= maxFleet }}
                disabled={total >= maxFleet}
                hitSlop={6}
                onPress={() => change(vehicle, 1)}
                style={[
                  styles.stepButton,
                  total >= maxFleet && styles.stepDisabled,
                ]}
              >
                <Plus color={palette.brand} size={16} strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  flex: { flex: 1 },
  summary: {
    gap: 2,
    marginBottom: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: palette.navy,
  },
  summaryCount: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 15 },
  summaryText: { color: "#d6e2f5", fontFamily: "Sora", fontSize: 11 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: "#dbe4f5",
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  rowSelected: { borderColor: palette.brand, backgroundColor: "#e3ecfb" },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#e3ecfb",
  },
  iconImage: { width: 32, height: 32 },
  name: { color: palette.brand, fontFamily: "SoraBold", fontSize: 13 },
  seats: { color: "#6b6b6b", fontFamily: "Sora", fontSize: 11 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: palette.brand,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  stepDisabled: { opacity: 0.35 },
  count: {
    minWidth: 18,
    color: palette.brand,
    fontFamily: "SoraBold",
    fontSize: 15,
    textAlign: "center",
  },
});
