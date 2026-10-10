import { Image } from "expo-image";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import Minus from "lucide-react-native/icons/minus";
import Plus from "lucide-react-native/icons/plus";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, {
  type CSSTransitionProperties,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ExpandedOnly,
  headerLayoutTransition,
  headerLogoTransition,
  headerTitleTransition,
} from "@/components/scroll-chrome";

export const moduleColors = {
  brandBlue: "#193caf",
  headerBlue: "#1034A6",
  softBlue: "#e3ecfb",
  mutedText: "#6b6b6b",
  text: "#111111",
  error: "#d93025",
};

const { brandBlue, headerBlue, softBlue, mutedText } = moduleColors;

export type Vehicle = "jeep" | "tricy";

export type VehicleOption<T extends string = Vehicle> = {
  value: T;
  label: string;
  icon: number;
};

export const vehicleOptions: VehicleOption[] = [
  {
    value: "jeep",
    label: "JEEP",
    icon: require("@/assets/images/jeepney.svg"),
  },
  {
    value: "tricy",
    label: "TRICY",
    icon: require("@/assets/images/tricycle.svg"),
  },
];

const tileTransition: CSSTransitionProperties = {
  transitionProperty: ["backgroundColor", "transform"],
  transitionDuration: 250,
  transitionTimingFunction: "ease-in-out",
};

const labelTransition: CSSTransitionProperties<TextStyle> = {
  transitionProperty: "color",
  transitionDuration: 250,
  transitionTimingFunction: "ease-in-out",
};

export function ModuleHeader({
  title,
  subtitle,
  icon,
  onBack,
  collapsed = false,
  children,
<<<<<<< HEAD
=======
  titleStyle,
>>>>>>> origin/mapbox
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
<<<<<<< HEAD
  onBack: () => void;
  collapsed?: boolean;
  children?: ReactNode;
=======
  onBack?: () => void;
  collapsed?: boolean;
  children?: ReactNode;
  titleStyle?: StyleProp<TextStyle>;
>>>>>>> origin/mapbox
}) {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      layout={headerLayoutTransition}
      style={[
        styles.header,
        collapsed && styles.headerCollapsed,
        { paddingTop: insets.top + (collapsed ? 10 : 16) },
      ]}
    >
      <View style={[styles.headerRow, collapsed && styles.headerRowCollapsed]}>
<<<<<<< HEAD
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={onBack}
          style={[styles.backButton, collapsed && styles.backButtonCollapsed]}
        >
          <ChevronLeft color="#ffffff" size={22} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.headerText}>
=======
        {onBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={onBack}
            style={[styles.backButton, collapsed && styles.backButtonCollapsed]}
          >
            <ChevronLeft color="#ffffff" size={22} strokeWidth={2.5} />
          </Pressable>
        )}
        <View style={[styles.headerText, !onBack && styles.headerTextNoBack]}>
>>>>>>> origin/mapbox
          <Animated.Text
            style={[
              styles.title,
              collapsed && styles.titleCollapsed,
<<<<<<< HEAD
=======
              titleStyle,
>>>>>>> origin/mapbox
              headerTitleTransition,
            ]}
            numberOfLines={collapsed ? 1 : undefined}
          >
            {title}
          </Animated.Text>
          <ExpandedOnly collapsed={collapsed}>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </ExpandedOnly>
        </View>
        <Animated.View
          style={[
            styles.headerIcon,
            collapsed && styles.headerIconCollapsed,
            headerLogoTransition,
          ]}
        >
          {icon}
        </Animated.View>
      </View>
      {children}
    </Animated.View>
  );
}

export function SectionTitle({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionIcon}>{icon}</View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export function SoftField({
  icon,
  trailing,
  style,
  inputStyle,
  ...inputProps
}: Omit<TextInputProps, "style"> & {
  icon?: ReactNode;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View
      style={[
        styles.softField,
        inputProps.multiline && styles.softFieldTall,
        style,
      ]}
    >
      {icon}
      <TextInput
        placeholderTextColor={mutedText}
        style={[
          styles.softFieldInput,
          inputProps.multiline && styles.softFieldInputTall,
          inputStyle,
        ]}
        {...inputProps}
      />
      {trailing}
    </View>
  );
}

export function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export function VehiclePicker<T extends string = Vehicle>({
  value,
  onChange,
  options = vehicleOptions as VehicleOption<T>[],
}: {
  value: T;
  onChange: (vehicle: T) => void;
  options?: VehicleOption<T>[];
}) {
  return (
    <View style={styles.vehicleRow}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={styles.vehicleOption}
          >
            <Animated.View
              style={[
                styles.vehicleTile,
                selected && styles.vehicleTileSelected,
                { transform: [{ scale: selected ? 1.05 : 1 }] },
                tileTransition,
              ]}
            >
              <View style={styles.vehicleIconBackdrop}>
                <Image
                  source={option.icon}
                  style={styles.vehicleIcon}
                  tintColor="#000000"
                  contentFit="contain"
                />
              </View>
              <Animated.Text
                style={[
                  styles.vehicleLabel,
                  selected && styles.vehicleLabelSelected,
                  labelTransition,
                ]}
              >
                {option.label}
              </Animated.Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PassengerStepper({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  return (
    <View style={styles.stepper}>
      <StepperButton
        label="Remove a passenger"
        disabled={value <= min}
        onPress={() => onChange(Math.max(value - 1, min))}
      >
        <Minus color={brandBlue} size={16} strokeWidth={2.5} />
      </StepperButton>
      <Text style={styles.stepperCount}>{value}</Text>
      <StepperButton
        label="Add a passenger"
        disabled={value >= max}
        onPress={() => onChange(Math.min(value + 1, max))}
      >
        <Plus color={brandBlue} size={16} strokeWidth={2.5} />
      </StepperButton>
    </View>
  );
}

function StepperButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={[styles.stepperButton, disabled && styles.stepperButtonDisabled]}
    >
      {children}
    </Pressable>
  );
}

const chipTransition: CSSTransitionProperties = {
  transitionProperty: ["backgroundColor", "borderColor"],
  transitionDuration: 250,
  transitionTimingFunction: "ease-in-out",
};

export function Chip({
  label,
  selected,
  onPress,
  grow,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  grow?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[grow && styles.grow, style]}
    >
      <Animated.View
        style={[styles.chip, selected && styles.chipSelected, chipTransition]}
      >
        <Animated.Text
          style={[
            styles.chipText,
            selected && styles.chipTextSelected,
            labelTransition,
          ]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

export function ModuleButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        (pressed || disabled) && styles.pressed,
        style,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
      <ArrowRight
        color="#ffffff"
        size={20}
        strokeWidth={2.5}
        style={styles.buttonArrow}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 26,
    backgroundColor: headerBlue,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerCollapsed: { paddingBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "flex-start" },
  headerRowCollapsed: { alignItems: "center" },
  backButtonCollapsed: { marginTop: 0 },
  headerIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    opacity: 1,
    transform: [{ scale: 1 }],
  },
  headerIconCollapsed: {
    width: 0,
    height: 0,
    opacity: 0,
    transform: [{ scale: 0.4 }],
  },
  titleCollapsed: { fontSize: 18, lineHeight: 24 },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.7)",
  },
  headerText: { flex: 1, marginLeft: 12, marginRight: 8 },
<<<<<<< HEAD
=======
  headerTextNoBack: { marginLeft: 0 },
>>>>>>> origin/mapbox
  title: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 30,
    lineHeight: 38,
  },
  subtitle: {
    color: "#ffffff",
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 22,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: brandBlue,
  },
  sectionTitle: {
    flex: 1,
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 17,
  },
  softField: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: softBlue,
  },
  softFieldTall: { minHeight: 84, alignItems: "flex-start", paddingTop: 12 },
  softFieldInput: {
    flex: 1,
    padding: 0,
    color: moduleColors.text,
    fontFamily: "Sora",
    fontSize: 11,
  },
  softFieldInputTall: { minHeight: 60, textAlignVertical: "top" },
  fieldLabel: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 11,
    marginBottom: 8,
  },
  vehicleRow: { flexDirection: "row", gap: 10 },
  vehicleOption: { flex: 1 },
  vehicleTile: {
    width: "100%",
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    backgroundColor: softBlue,
  },
  vehicleTileSelected: { backgroundColor: brandBlue },
  vehicleIcon: { width: 36, height: 36 },
  vehicleIconBackdrop: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: softBlue,
  },
  vehicleLabel: { color: brandBlue, fontFamily: "SoraBold", fontSize: 10 },
  vehicleLabelSelected: { color: "#ffffff" },
  stepper: {
    width: 158,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRadius: 12,
  },
  stepperButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: softBlue,
  },
  stepperButtonDisabled: { opacity: 0.4 },
  stepperCount: { color: moduleColors.text, fontFamily: "Sora", fontSize: 15 },
  grow: { flex: 1 },
  chip: {
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: softBlue,
    borderRadius: 18,
    backgroundColor: softBlue,
  },
  chipSelected: { borderColor: brandBlue, backgroundColor: brandBlue },
  chipText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 11 },
  chipTextSelected: { color: "#ffffff" },
  button: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 30,
    borderRadius: 14,
    backgroundColor: brandBlue,
  },
  pressed: { opacity: 0.8 },
  buttonText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 15,
    letterSpacing: 1,
  },
  buttonArrow: { position: "absolute", right: 18 },
});
