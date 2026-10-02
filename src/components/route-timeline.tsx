import { StyleSheet, View } from "react-native";

const brandBlue = "#193caf";

export function RouteTimeline({ stretch = true }: { stretch?: boolean }) {
  return (
    <View style={[styles.timeline, stretch && styles.stretch]}>
      <View style={styles.start} />
      <View style={styles.line} />
      <View style={styles.end} />
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { alignItems: "center", paddingVertical: 4 },
  stretch: { alignSelf: "stretch" },
  start: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: brandBlue,
  },
  line: { flex: 1, width: 2, backgroundColor: brandBlue },
  end: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: brandBlue,
    backgroundColor: "#ffffff",
  },
});
