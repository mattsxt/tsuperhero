import CloudOff from "lucide-react-native/icons/cloud-off";
import type { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useOnline } from "@/hooks/use-online";

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
  const online = useOnline();
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.icon, !online && styles.iconOffline]}>
        {online ? (
          icon
        ) : (
          <CloudOff color="#c2410c" size={30} strokeWidth={1.8} />
        )}
      </View>
      <Text style={[styles.title, !online && styles.titleOffline]}>
        {online ? title : "Nothing saved here yet"}
      </Text>
      <Text style={styles.message}>
        {online
          ? message
          : "You're offline and this hasn't been loaded on this phone. Connect once and it will stay available offline."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 28,
  },
  icon: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 34,
    backgroundColor: "#e3ecfb",
  },
  iconOffline: { backgroundColor: "#fff4e5" },
  titleOffline: { color: "#9a3412" },
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
