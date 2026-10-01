import type { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export function EmptyState({
  icon,
  title = "Nothing to see here yet",
  message,
  style,
}: {
  icon: ReactNode;
  title?: string;
  message: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.icon}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 28 },
  icon: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 34,
    backgroundColor: "#e3ecfb",
  },
  title: {
    color: "#193caf",
    fontFamily: "SoraBold",
    fontSize: 14,
    marginTop: 14,
    textAlign: "center",
  },
  message: {
    color: "#6b6b6b",
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
    textAlign: "center",
  },
});
