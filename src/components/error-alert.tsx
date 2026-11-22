import CircleAlert from "lucide-react-native/icons/circle-alert";
import type { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { FadeIn, FadeOutUp } from "react-native-reanimated";
import { palette } from "@/constants/colors";

const errorColor = palette.danger;

export function ErrorAlert({
  title,
  message,
  style,
}: {
  title: string;
  message: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View accessible accessibilityRole="alert" style={[styles.alert, style]}>
      <CircleAlert color={errorColor} size={16} strokeWidth={2} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  alert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    backgroundColor: "#fff1f0",
  },
  content: { flex: 1, gap: 4 },
  title: {
    color: errorColor,
    fontFamily: "SoraBold",
    fontSize: 10,
  },
  message: {
    color: palette.dangerText,
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
  },
});

export function AnimatedErrorAlert({
  title,
  message,
  style,
}: {
  title: string;
  message: string;
  style?: StyleProp<ViewStyle>;
}) {
  if (!message) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOutUp.duration(160)}
      accessibilityLiveRegion="assertive"
      style={style}
    >
      <ErrorAlert title={title} message={message} />
    </Animated.View>
  );
}

export function ErrorMark({ color = errorColor }: { color?: string }) {
  return (
    <CircleAlert
      accessibilityLabel="Has an error"
      color={color}
      size={11}
      strokeWidth={2.4}
    />
  );
}

export function ErrorOutline({
  invalid,
  color = errorColor,
  radius = 11,
  children,
}: {
  invalid: boolean;
  color?: string;
  radius?: number;
  children: ReactNode;
}) {
  return (
    <View
      style={
        invalid && {
          borderWidth: 1.5,
          borderColor: color,
          borderRadius: radius,
        }
      }
    >
      {children}
    </View>
  );
}

export function firstFieldError<K extends string>(
  errors: Partial<Record<K, string>>,
  order: readonly K[],
): K | undefined {
  return order.find((key) => !!errors[key]);
}
