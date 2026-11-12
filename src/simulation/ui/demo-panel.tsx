import { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { moduleColors } from "@/components/module-ui";
import { palette } from "@/constants/colors";
import { currentUserId } from "@/simulation/auth";
import { db } from "@/simulation/db";
import * as engine from "@/simulation/engine";
import { resetDemo, switchRole } from "@/simulation/ui/actions";

const size = 56;
const openMs = 260;
const closeMs = 220;
const speeds: engine.Speed[] = [1, 4, 10];

const hasActiveTrip = () => {
  const id = currentUserId();
  const personnel = db.tables.transit_personnel.find((x) => x.user_id === id);
  const driver = db.tables.driver.find(
    (d) => d.personnel_id === personnel?.personnel_id && d.vehicle_id,
  );
  return db.tables.trip.some(
    (t) => t.vehicle_id === driver?.vehicle_id && t.trip_status === "active",
  );
};

const isDriver = () => {
  const id = currentUserId();
  return db.tables.user.some(
    (u) => u.user_id === id && u.user_type === "transit_personnel",
  );
};

export function DemoPanel() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const x = useSharedValue(width - size - 4);
  const y = useSharedValue(height / 2 - size / 2);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);
  const sheetHeight = useSharedValue(480);
  const [driver, setDriver] = useState(false);
  const [speed, setSpeed] = useState<engine.Speed>(engine.getSpeed());
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => engine.subscribe((state) => setSpeed(state.speed)), []);
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const show = (text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 3000);
  };

  const openSheet = () => {
    setDriver(isDriver());
    setSpeed(engine.getSpeed());
    setNotice("");
    setOpen(true);
    progress.value = withTiming(1, {
      duration: openMs,
      easing: Easing.out(Easing.cubic),
    });
  };

  const closeSheet = () => {
    progress.value = withTiming(
      0,
      { duration: closeMs, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) scheduleOnRN(setOpen, false);
      },
    );
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * sheetHeight.value }],
  }));

  const minY = insets.top + 8;
  const maxY = height - size - insets.bottom - 8;
  const maxX = width - size - 4;

  const pan = Gesture.Pan()
    .minDistance(6)
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      x.value = Math.min(maxX, Math.max(4, startX.value + e.translationX));
      y.value = Math.min(maxY, Math.max(minY, startY.value + e.translationY));
    });
  const tap = Gesture.Tap().onEnd((_e, ok) => {
    if (ok) scheduleOnRN(openSheet);
  });
  const gesture = Gesture.Exclusive(pan, tap);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  const chooseSpeed = (next: engine.Speed) => {
    engine.setSpeed(next);
    setSpeed(next);
  };

  const arrive = () => {
    if (engine.arriveNow()) {
      closeSheet();
    } else {
      show("Nothing is moving right now.");
    }
  };

  const sendRequest = () => {
    if (engine.sendPickupRequest()) {
      show("A pickup request was sent to the driver.");
    } else {
      show(
        hasActiveTrip()
          ? "No new request can be sent yet. Try again in a moment."
          : "Start a trip first to get pickup requests.",
      );
    }
  };

  return (
    <>
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessible
          accessibilityRole="button"
          accessibilityLabel="Open simulation controls"
          accessibilityActions={[{ name: "activate" }]}
          onAccessibilityAction={openSheet}
          style={[styles.fab, buttonStyle]}
        >
          <Text style={styles.fabText}>DEMO</Text>
        </Animated.View>
      </GestureDetector>

      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeSheet}
      >
        <View style={styles.root}>
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <Pressable
              accessibilityLabel="Close simulation controls"
              style={StyleSheet.absoluteFill}
              onPress={closeSheet}
            />
          </Animated.View>
          <Animated.View
            onLayout={(event) => {
              sheetHeight.value = event.nativeEvent.layout.height;
            }}
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + 18 },
              sheetStyle,
            ]}
          >
            <Text style={styles.title}>DEMO CONTROLS</Text>

            <Text style={styles.label}>SPEED</Text>
            <View style={styles.speedRow}>
              {speeds.map((value) => {
                const active = value === speed;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Speed ${value} times`}
                    onPress={() => chooseSpeed(value)}
                    style={[styles.speed, active && styles.speedActive]}
                  >
                    <Text
                      style={[
                        styles.speedText,
                        active && styles.speedTextActive,
                      ]}
                    >
                      {value}×
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <ActionButton label="ARRIVE NOW" onPress={arrive} />
            {driver && (
              <ActionButton
                label="SEND A PICKUP REQUEST"
                onPress={sendRequest}
              />
            )}
            <ActionButton
              label="SWITCH ROLE"
              onPress={() => {
                closeSheet();
                switchRole();
              }}
            />
            <ActionButton
              label="RESET DEMO"
              danger
              onPress={() => {
                closeSheet();
                resetDemo();
              }}
            />

            {!!notice && (
              <Text accessibilityLiveRegion="polite" style={styles.notice}>
                {notice}
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={closeSheet}
              style={styles.close}
            >
              <Text style={styles.closeText}>CLOSE</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function ActionButton({
  label,
  onPress,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        danger && styles.actionDanger,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 2000,
    elevation: 12,
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.warning,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  fabText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 11 },
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  title: {
    color: moduleColors.text,
    fontFamily: "SoraBold",
    fontSize: 16,
    textAlign: "center",
  },
  label: {
    color: moduleColors.mutedText,
    fontFamily: "SoraBold",
    fontSize: 11,
  },
  speedRow: { flexDirection: "row", gap: 10 },
  speed: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.brand,
    backgroundColor: "#ffffff",
  },
  speedActive: { backgroundColor: palette.brand },
  speedText: { color: palette.brand, fontFamily: "SoraBold", fontSize: 15 },
  speedTextActive: { color: "#ffffff" },
  action: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: palette.brand,
  },
  actionDanger: { backgroundColor: palette.danger },
  pressed: { opacity: 0.75 },
  actionText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 13 },
  notice: {
    color: palette.warning,
    backgroundColor: palette.warningSoft,
    borderRadius: 10,
    padding: 10,
    fontFamily: "Sora",
    fontSize: 12,
    textAlign: "center",
  },
  close: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: moduleColors.mutedText,
    fontFamily: "SoraBold",
    fontSize: 12,
  },
});
