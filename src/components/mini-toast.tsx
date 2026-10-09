import { useEffect, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";

export type MiniToastMessage = { id: number; text: string };

export function MiniToast({
  message,
  top,
}: {
  message: MiniToastMessage | null;
  top: number;
}) {
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!message) return;

    opacity.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.delay(1800),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [message, opacity]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { top, opacity }]}
    >
      <Text style={styles.text}>{message.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    alignSelf: "center",
    maxWidth: 320,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(17, 17, 17, 0.9)",
    borderRadius: 999,
    zIndex: 100,
  },
  text: {
    color: "#ffffff",
    fontFamily: "Sora",
    fontSize: 11,
    textAlign: "center",
  },
});
