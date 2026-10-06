import { StatusBar } from "expo-status-bar";
import CircleCheckBig from "lucide-react-native/icons/circle-check-big";
import MapPin from "lucide-react-native/icons/map-pin";
import Route from "lucide-react-native/icons/route";
import Users from "lucide-react-native/icons/users";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PickupRequest } from "@/api/v1/pickups/controllers";
import { ModuleButton, moduleColors } from "@/components/module-ui";

const { brandBlue, mutedText, softBlue, text } = moduleColors;
const successGreen = "#1e9e45";

export function BoardedScreen({
  request,
  onDone,
}: {
  request: PickupRequest;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Animated.View
          entering={ZoomIn.springify().damping(14)}
          style={styles.badge}
        >
          <CircleCheckBig color="#ffffff" size={52} strokeWidth={2} />
        </Animated.View>

        <Animated.View entering={FadeIn.delay(150)} style={styles.copy}>
          <Text style={styles.title}>You&apos;re on board!</Text>
          <Text style={styles.message}>
            Your driver picked you up. Enjoy the ride!
          </Text>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(250)} style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <MapPin color={brandBlue} size={16} strokeWidth={2.2} />
            </View>
            <Text style={styles.rowText} numberOfLines={2}>
              {request.pickupName}
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Users color={brandBlue} size={16} strokeWidth={2.2} />
            </View>
            <Text style={styles.rowText}>
              {request.passengers}{" "}
              {request.passengers === 1 ? "passenger" : "passengers"}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(350)} style={styles.note}>
          <Route color={successGreen} size={16} strokeWidth={2.2} />
          <Text style={styles.noteText}>
            This ride was added to your trip history.
          </Text>
        </Animated.View>
      </View>

      <ModuleButton label="BACK TO HOME" onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    backgroundColor: "#ffffff",
  },
  content: { alignItems: "center" },
  badge: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 52,
    backgroundColor: successGreen,
  },
  copy: { alignItems: "center", marginTop: 22 },
  title: { color: brandBlue, fontFamily: "SoraBold", fontSize: 22 },
  message: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
  },
  card: {
    alignSelf: "stretch",
    gap: 10,
    marginTop: 28,
    padding: 14,
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: "#1a2f8f",
    borderRadius: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: softBlue,
  },
  rowText: { flex: 1, color: text, fontFamily: "SoraBold", fontSize: 12 },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#dcfce7",
  },
  noteText: { color: successGreen, fontFamily: "SoraBold", fontSize: 10 },
});
