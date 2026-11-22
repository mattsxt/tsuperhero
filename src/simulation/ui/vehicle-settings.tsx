import Check from "lucide-react-native/icons/check";
import MapPin from "lucide-react-native/icons/map-pin";
import X from "lucide-react-native/icons/x";
import { useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { VehicleIcon } from "@/components/module-icons";
import { moduleColors } from "@/components/module-ui";
import { occupancyPinColors } from "@/components/transit-map-types";
import { palette } from "@/constants/colors";
import { demoJeepneyRoutes } from "@/simulation/engine";
import {
  generateVehicle,
  occupancyChoices,
  type GeneratedVehicleStatus,
  type GeneratedVehicleType,
  type OccupancyChoice,
} from "@/simulation/generated-vehicles";

const { brandBlue, headerBlue, softBlue, mutedText, text } = moduleColors;

const typeOptions: { value: GeneratedVehicleType; icon: "jeep" | "tricy"; seats: string; note: string }[] = [
  { value: "Jeepney", icon: "jeep", seats: "22 seats", note: "Runs a route" },
  { value: "Tricycle", icon: "tricy", seats: "4 seats", note: "Roams nearby" },
];

const statusOptions: { value: GeneratedVehicleStatus; label: string }[] = [
  { value: "on-trip", label: "In Transit" },
  { value: "loading", label: "Loading/Unloading" },
];

const updateOptions: { value: boolean; label: string }[] = [
  { value: true, label: "Dynamic" },
  { value: false, label: "Static" },
];

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Segmented<T>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text
              numberOfLines={1}
              style={[styles.segmentText, selected && styles.segmentTextSelected]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function OccupancyPicker({
  type,
  value,
  onChange,
}: {
  type: GeneratedVehicleType;
  value: OccupancyChoice;
  onChange: (value: OccupancyChoice) => void;
}) {
  const choices = occupancyChoices(type);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Occupancy level" style={styles.chips}>
      {choices.map((level) => {
        const selected = level === value;
        return (
          <Pressable
            key={level}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(level)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <View style={[styles.dot, { backgroundColor: occupancyPinColors[level] }]} />
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{level}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type VehicleSettingsValue = {
  status: GeneratedVehicleStatus;
  dynamic: boolean;
  occupancy: OccupancyChoice;
};

export function VehicleSettingsFields({
  type,
  value,
  onChange,
  showStatus,
}: {
  type: GeneratedVehicleType;
  value: VehicleSettingsValue;
  onChange: (value: VehicleSettingsValue) => void;
  showStatus: boolean;
}) {
  return (
    <>
      {showStatus && (
        <Section label="STATUS">
          <Segmented
            label="Status"
            options={statusOptions}
            value={value.status}
            onChange={(status) => onChange({ ...value, status })}
          />
        </Section>
      )}
      <Section label="OCCUPANCY UPDATES">
        <Segmented
          label="Occupancy updates"
          options={updateOptions}
          value={value.dynamic}
          onChange={(dynamic) => onChange({ ...value, dynamic })}
        />
      </Section>
      <Section label={value.dynamic ? "STARTING OCCUPANCY" : "OCCUPANCY LEVEL"}>
        <OccupancyPicker
          type={type}
          value={value.occupancy}
          onChange={(occupancy) => onChange({ ...value, occupancy })}
        />
      </Section>
    </>
  );
}

export function SettingsCard({
  title,
  subtitle,
  onClose,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={10}
          onPress={onClose}
          style={styles.close}
        >
          <X color="#ffffff" size={18} strokeWidth={2.5} />
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
        {children}
      </ScrollView>
      <View style={styles.footer}>{footer}</View>
    </View>
  );
}

export function FooterButtons({
  confirmLabel,
  onCancel,
  onConfirm,
  disabled = false,
}: {
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.footerRow}>
      <Pressable
        accessibilityRole="button"
        onPress={onCancel}
        style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryText}>CANCEL</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onConfirm}
        style={({ pressed }) => [
          styles.button,
          styles.primary,
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.primaryText}>{confirmLabel}</Text>
      </Pressable>
    </View>
  );
}

export function GenerateVehicleModal({
  visible,
  onClose,
  onDone,
}: {
  visible: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [type, setType] = useState<GeneratedVehicleType | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [settings, setSettings] = useState<VehicleSettingsValue>({
    status: "on-trip",
    dynamic: true,
    occupancy: "Available",
  });
  const [error, setError] = useState("");
  const routes = visible ? demoJeepneyRoutes() : [];

  const close = () => {
    setType(null);
    setRouteId(null);
    setSettings({ status: "on-trip", dynamic: true, occupancy: "Available" });
    setError("");
    onClose();
  };

  const chooseType = (next: GeneratedVehicleType) => {
    setType(next);
    setError("");
    if (!occupancyChoices(next).includes(settings.occupancy))
      setSettings({ ...settings, occupancy: "Available" });
  };

  const ready = !!type && (type === "Tricycle" || !!routeId);

  const submit = () => {
    if (!type) return;
    const result = generateVehicle({
      type,
      routeId,
      dynamic: settings.dynamic,
      occupancy: settings.occupancy,
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    close();
    onDone(result.message);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={close} />
        <SettingsCard
          title="Generate a vehicle"
          subtitle="Adds a live vehicle to the map."
          onClose={close}
          footer={
            <FooterButtons
              confirmLabel="GENERATE"
              disabled={!ready}
              onCancel={close}
              onConfirm={submit}
            />
          }
        >
          <Section label="VEHICLE TYPE">
            <View accessibilityRole="radiogroup" style={styles.types}>
              {typeOptions.map((option) => {
                const selected = option.value === type;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${option.value}, ${option.seats}`}
                    onPress={() => chooseType(option.value)}
                    style={[styles.typeCard, selected && styles.typeCardSelected]}
                  >
                    <View style={[styles.typeIcon, selected && styles.typeIconSelected]}>
                      <VehicleIcon
                        type={option.icon}
                        color={selected ? "#ffffff" : headerBlue}
                        size={26}
                      />
                    </View>
                    <Text style={styles.typeName}>{option.value}</Text>
                    <Text style={styles.typeMeta}>
                      {option.seats} · {option.note}
                    </Text>
                    {selected && (
                      <View style={styles.typeCheck}>
                        <Check color="#ffffff" size={12} strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {type === "Jeepney" && (
            <Section label="OPERATING ROUTE">
              <View accessibilityRole="radiogroup" accessibilityLabel="Operating route" style={styles.routes}>
                {routes.map((route) => {
                  const selected = route.routeId === routeId;
                  return (
                    <Pressable
                      key={route.routeId}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => {
                        setRouteId(route.routeId);
                        setError("");
                      }}
                      style={[styles.routeRow, selected && styles.routeRowSelected]}
                    >
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected && <View style={styles.radioDot} />}
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.routeName} numberOfLines={2}>
                          {route.name}
                        </Text>
                        <Text style={styles.routeCode}>{route.code}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Section>
          )}

          {type === "Tricycle" && (
            <View style={styles.note}>
              <MapPin color={brandBlue} size={16} strokeWidth={2.2} />
              <Text style={styles.noteText}>
                Appears near you and roams the nearby roads of the route on screen.
              </Text>
            </View>
          )}

          {type && (
            <VehicleSettingsFields
              type={type}
              value={settings}
              onChange={setSettings}
              showStatus={false}
            />
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}
        </SettingsCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(10, 22, 52, 0.55)",
  },
  flex: { flex: 1 },
  card: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "90%",
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 20,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: headerBlue,
  },
  title: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 17 },
  subtitle: {
    marginTop: 2,
    color: "rgba(255, 255, 255, 0.8)",
    fontFamily: "Sora",
    fontSize: 11,
  },
  close: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: 18, padding: 18, paddingBottom: 20 },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: "#e5eaf3",
    backgroundColor: "#ffffff",
  },
  footerRow: { flexDirection: "row", gap: 10 },
  section: { gap: 8 },
  sectionLabel: { color: mutedText, fontFamily: "SoraBold", fontSize: 10, letterSpacing: 0.5 },
  segmented: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: 12,
    backgroundColor: softBlue,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRadius: 9,
  },
  segmentSelected: {
    backgroundColor: "#ffffff",
    shadowColor: "#0a1634",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentText: { color: mutedText, fontFamily: "SoraBold", fontSize: 12 },
  segmentTextSelected: { color: brandBlue },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexGrow: 1,
    flexBasis: "45%",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#dbe3f0",
    backgroundColor: "#ffffff",
  },
  chipSelected: { borderColor: brandBlue, backgroundColor: softBlue },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(15, 42, 107, 0.35)",
  },
  chipText: { color: text, fontFamily: "Sora", fontSize: 12 },
  chipTextSelected: { color: brandBlue, fontFamily: "SoraBold" },
  types: { flexDirection: "row", gap: 10 },
  typeCard: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#dbe3f0",
    backgroundColor: "#ffffff",
  },
  typeCardSelected: { borderColor: brandBlue, backgroundColor: softBlue },
  typeIcon: {
    marginBottom: 4,
    padding: 8,
    borderRadius: 12,
    backgroundColor: softBlue,
  },
  typeIconSelected: { backgroundColor: headerBlue },
  typeName: { color: text, fontFamily: "SoraBold", fontSize: 13 },
  typeMeta: { color: mutedText, fontFamily: "Sora", fontSize: 10, textAlign: "center" },
  typeCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: brandBlue,
  },
  routes: { gap: 8 },
  routeRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#dbe3f0",
  },
  routeRowSelected: { borderColor: brandBlue, backgroundColor: softBlue },
  radio: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#9aa8c2",
  },
  radioSelected: { borderColor: brandBlue },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: brandBlue },
  routeName: { color: text, fontFamily: "SoraBold", fontSize: 12 },
  routeCode: { marginTop: 2, color: mutedText, fontFamily: "Sora", fontSize: 10 },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: softBlue,
  },
  noteText: { flex: 1, color: brandBlue, fontFamily: "Sora", fontSize: 12, lineHeight: 17 },
  error: { color: palette.danger, fontFamily: "SoraBold", fontSize: 12, textAlign: "center" },
  button: {
    flex: 1,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  primary: { backgroundColor: brandBlue },
  primaryText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 13, letterSpacing: 1 },
  secondary: { borderWidth: 1.5, borderColor: brandBlue, backgroundColor: "#ffffff" },
  secondaryText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 13, letterSpacing: 1 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
});
