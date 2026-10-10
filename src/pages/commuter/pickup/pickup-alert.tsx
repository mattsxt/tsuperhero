import CircleAlert from "lucide-react-native/icons/circle-alert";
import { StyleSheet, Text, View } from "react-native";

const errorColor = "#b42318";

export function PickupAlert({
  source,
  message,
  compact = false,
}: {
  source: string;
  message: string;
  compact?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityRole="alert"
      style={[styles.alert, compact && styles.compact]}
    >
      <CircleAlert color={errorColor} size={16} strokeWidth={2} />
      <View style={styles.content}>
        <Text style={styles.source}>{source}</Text>
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
    marginTop: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    backgroundColor: "#fff1f0",
  },
  compact: {
    marginTop: 0,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  content: { flex: 1, gap: 4 },
  source: {
    color: errorColor,
    fontFamily: "SoraBold",
    fontSize: 10,
  },
  message: {
    color: "#8f1d18",
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
  },
});
