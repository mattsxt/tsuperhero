import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { BrandLogo } from "@/components/brand-logo";
import { LoadingLogo } from "@/components/LoadingLogo";

const navy = "#1034A6";
const brandBlue = "#193caf";
const messageMs = 1600;

const signInMessages = [
  "Logging you in...",
  "Signing in...",
  "Welcome back!",
  "Getting things ready...",
  "Almost there...",
];

export const signOutMessages = [
  "Logging you out...",
  "Signing out...",
  "Clearing your session...",
  "See you soon!",
];

export function LoadingScreen({
  messages = signInMessages,
}: {
  messages?: string[];
}) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (messages.length < 2) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % messages.length),
      messageMs,
    );
    return () => clearInterval(timer);
  }, [messages.length]);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(0.35);
    pulse.set(
      withRepeat(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(pulse);
  }, [reduceMotion, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  const message = messages[index % messages.length];

  return (
    <View style={styles.screen} aria-busy accessibilityLabel={message}>
      <StatusBar style="dark" />
      <Animated.View entering={FadeIn.duration(250)} style={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.badge}>
            <BrandLogo size={30} />
          </View>
          <Text style={styles.wordmark}>Tsuperhero</Text>
        </View>

        <View style={styles.spinner}>
          <LoadingLogo size={44} color="#ffffff" label={message} />
        </View>

        {/* Fade-in lives on the wrapper so it doesn't fight the pulse's opacity. */}
        <Animated.View key={message} entering={FadeIn.duration(250)}>
          <Animated.Text
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
            style={[styles.message, pulseStyle]}
          >
            {message}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "#ffffff",
  },
  content: { alignItems: "center", gap: 22 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: navy,
  },
  wordmark: {
    color: brandBlue,
    fontFamily: "WDXLLubrifontSC",
    fontSize: 32,
    lineHeight: 38,
  },
  spinner: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 40,
    backgroundColor: navy,
  },
  message: {
    color: "#6b6b6b",
    fontFamily: "SoraBold",
    fontSize: 13,
  },
});
