import type { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { moduleColors } from "@/components/module-ui";
import { palette } from "@/constants/colors";

const { brandBlue, text } = moduleColors;

const titleColors = {
  info: brandBlue,
  warning: "#92400e",
  danger: palette.danger,
} as const;

export function Notice({
  tone,
  icon,
  title,
  body,
  style,
}: {
  tone: keyof typeof titleColors;
  icon: ReactNode;
  title: string;
  body?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.notice,
        styles[tone],
        !body && styles.single,
        style,
      ]}
    >
      <View style={!!body && styles.icon}>{icon}</View>
      <View style={styles.flex}>
        <Text
          style={[styles.title, { color: titleColors[tone] }]}
          numberOfLines={body ? undefined : 1}
        >
          {title}
        </Text>
        {!!body && <Text style={styles.body}>{body}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  notice: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  single: { alignItems: "center" },
  info: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  warning: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  danger: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  icon: { paddingTop: 1 },
  title: { fontFamily: "SoraBold", fontSize: 11 },
  body: {
    marginTop: 3,
    color: text,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
  },
});
