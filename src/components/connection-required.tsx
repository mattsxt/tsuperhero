import WifiOff from "lucide-react-native/icons/wifi-off";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { moduleColors } from "@/components/module-ui";

const { text } = moduleColors;

export function ConnectionRequired({ action }: { action: string }) {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={styles.card}
      accessibilityRole="alert"
    >
      <View style={styles.icon}>
        <WifiOff color="#ffffff" size={18} strokeWidth={2.2} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.title}>No internet connection</Text>
        <Text style={styles.body}>
          {action} needs a stable connection so drivers can see it right away.
          Requests are never saved to send later. Connect to the internet, then
          try again.
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fff4e5",
    borderWidth: 1,
    borderColor: "#f5c27a",
  },
  icon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#c2410c",
  },
  flex: { flex: 1 },
  title: { color: "#9a3412", fontFamily: "SoraBold", fontSize: 13 },
  body: {
    color: text,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },
});
