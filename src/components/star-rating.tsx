import Star from "lucide-react-native/icons/star";
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import {
  maxFeedbackLength,
  rateTrip,
  scoreLabels,
} from "@/api/v1/ratings/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { moduleColors } from "@/components/module-ui";

const { brandBlue, mutedText, softBlue, text, error } = moduleColors;
const starGold = "#f5b301";
const starEmpty = "#d6dbe6";
const scores = [1, 2, 3, 4, 5];

export function StarRow({
  score,
  size = 14,
}: {
  score: number;
  size?: number;
}) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${score} out of 5 stars`}
    >
      {scores.map((value) => (
        <Star
          key={value}
          size={size}
          color={value <= Math.round(score) ? starGold : starEmpty}
          fill={value <= Math.round(score) ? starGold : starEmpty}
          strokeWidth={1.5}
        />
      ))}
    </View>
  );
}

export function StarBadge({ score }: { score: number }) {
  return (
    <View
      style={styles.badge}
      accessible
      accessibilityLabel={`Rated ${score} out of 5 stars`}
    >
      <Star color={starGold} fill={starGold} size={11} strokeWidth={1.5} />
      <Text style={styles.badgeText}>{score}.0</Text>
    </View>
  );
}

function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (score: number) => void;
}) {
  return (
    <View style={styles.inputRow} accessibilityRole="adjustable">
      {scores.map((score) => {
        const filled = score <= value;
        return (
          <Pressable
            key={score}
            accessibilityRole="button"
            accessibilityLabel={`${score} ${score === 1 ? "star" : "stars"}, ${scoreLabels[score]}`}
            accessibilityState={{ selected: score === value }}
            hitSlop={6}
            onPress={() => onChange(score)}
            style={({ pressed }) => pressed && styles.pressedStar}
          >
            <Star
              size={38}
              color={filled ? starGold : starEmpty}
              fill={filled ? starGold : "transparent"}
              strokeWidth={1.6}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

type RateTarget = { id: string; title: string; subtitle: string };

const openMs = 280;
const closeMs = 220;
const dismissDistance = 120;
const dismissVelocity = 900;
const offscreen = 800;

export function RateTripModal({
  target,
  onClose,
  onRated,
}: {
  target: RateTarget | null;
  onClose: () => void;
  onRated: (score: number, feedback: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState<RateTarget | null>(target);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  const backdrop = useSharedValue(0);
  const offset = useSharedValue(offscreen);
  const sheetHeight = useSharedValue(offscreen);

  if (target && target !== shown) setShown(target);

  useEffect(() => {
    if (!target) return;
    backdrop.set(withTiming(1, { duration: openMs }));
    offset.set(
      withTiming(0, {
        duration: openMs,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [target, backdrop, offset]);

  const reset = useCallback(() => {
    setShown(null);
    setScore(0);
    setFeedback("");
    setProblem("");
  }, []);

  const finish = useCallback(
    (after: () => void) => {
      reset();
      after();
    },
    [reset],
  );

  const animateOut = useCallback(
    (after: () => void) => {
      backdrop.set(withTiming(0, { duration: closeMs }));
      offset.set(
        withTiming(
          sheetHeight.get(),
          { duration: closeMs, easing: Easing.in(Easing.cubic) },
          (done) => {
            if (done) scheduleOnRN(finish, after);
          },
        ),
      );
    },
    [backdrop, offset, sheetHeight, finish],
  );

  const close = () => {
    if (saving) return;
    animateOut(onClose);
  };

  const submit = async () => {
    if (!shown || saving) return;
    if (score === 0) return setProblem("Tap a star to rate your rental.");
    setSaving(true);
    setProblem("");
    const result = await rateTrip(shown.id, score, feedback);
    setSaving(false);
    if (!result.ok) return setProblem(result.error);
    const saved = { score, feedback: feedback.trim() };
    animateOut(() => onRated(saved.score, saved.feedback));
  };

  const drag = Gesture.Pan()
    .enabled(!saving)
    .activeOffsetY(8)
    .failOffsetX([-20, 20])
    .onUpdate((event) => {
      offset.set(Math.max(0, event.translationY));
      backdrop.set(1 - Math.min(offset.get() / sheetHeight.get(), 1));
    })
    .onEnd((event) => {
      if (
        event.translationY > dismissDistance ||
        event.velocityY > dismissVelocity
      ) {
        backdrop.set(withTiming(0, { duration: closeMs }));
        offset.set(
          withTiming(sheetHeight.get(), { duration: closeMs }, (done) => {
            if (done) scheduleOnRN(finish, onClose);
          }),
        );
      } else {
        offset.set(withSpring(0, { damping: 22, stiffness: 240 }));
        backdrop.set(withTiming(1, { duration: 150 }));
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.get() }],
  }));

  return (
    <Modal
      visible={!!shown}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
    >
      <GestureHandlerRootView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
          >
            <Pressable
              accessibilityLabel="Close rating"
              style={StyleSheet.absoluteFill}
              onPress={close}
            />
          </Animated.View>
          <GestureDetector gesture={drag}>
            <Animated.View
              onLayout={(event) => {
                sheetHeight.set(event.nativeEvent.layout.height);
              }}
              style={[
                styles.sheet,
                { paddingBottom: insets.bottom + 20 },
                sheetStyle,
              ]}
            >
              <View style={styles.handleArea}>
                <View style={styles.handle} />
              </View>
              <Text style={styles.title}>How was your rental?</Text>
              {shown && (
                <Text style={styles.subtitle} numberOfLines={2}>
                  {shown.title}
                  {shown.subtitle ? ` · ${shown.subtitle}` : ""}
                </Text>
              )}

              <StarInput
                value={score}
                onChange={(next) => {
                  setProblem("");
                  setScore(next);
                }}
              />
              <Text style={[styles.scoreLabel, score === 0 && styles.muted]}>
                {score === 0 ? "Tap a star" : scoreLabels[score]}
              </Text>

              <TextInput
                value={feedback}
                onChangeText={setFeedback}
                placeholder="Tell us more about your driver (optional)"
                placeholderTextColor={mutedText}
                multiline
                maxLength={maxFeedbackLength}
                style={styles.feedback}
              />
              <Text style={styles.counter}>
                {feedback.length}/{maxFeedbackLength}
              </Text>

              {!!problem && <Text style={styles.problem}>{problem}</Text>}

              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Rate later"
                  disabled={saving}
                  onPress={close}
                  style={({ pressed }) => [
                    styles.button,
                    styles.secondary,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.buttonText, styles.secondaryText]}>
                    LATER
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Submit rating"
                  accessibilityState={{ disabled: score === 0, busy: saving }}
                  disabled={saving}
                  onPress={submit}
                  style={({ pressed }) => [
                    styles.button,
                    styles.primary,
                    (pressed || score === 0) && styles.pressed,
                  ]}
                >
                  {saving ? (
                    <LoadingLogo size={20} color="#ffffff" />
                  ) : (
                    <Text style={styles.buttonText}>SUBMIT</Text>
                  )}
                </Pressable>
              </View>
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 2 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#fef3c7",
  },
  badgeText: { color: "#92400e", fontFamily: "SoraBold", fontSize: 9 },
  inputRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 18,
  },
  pressedStar: { transform: [{ scale: 0.9 }] },
  flex: { flex: 1 },
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(0, 0, 0, 0.45)" },
  handleArea: { alignItems: "center", paddingTop: 4, paddingBottom: 14 },
  sheet: {
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#ffffff",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d9d9d9",
  },
  title: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 18,
    textAlign: "center",
  },
  subtitle: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },
  scoreLabel: {
    color: text,
    fontFamily: "SoraBold",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
  muted: { color: mutedText },
  feedback: {
    minHeight: 84,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 10,
    backgroundColor: softBlue,
    color: text,
    fontFamily: "Sora",
    fontSize: 11,
    textAlignVertical: "top",
  },
  counter: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 9,
    marginTop: 4,
    textAlign: "right",
  },
  problem: {
    color: error,
    fontFamily: "Sora",
    fontSize: 10,
    marginTop: 8,
    textAlign: "center",
  },
  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
  button: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  primary: { backgroundColor: brandBlue },
  secondary: {
    borderWidth: 1.5,
    borderColor: brandBlue,
    backgroundColor: "#ffffff",
  },
  buttonText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 13,
    letterSpacing: 1,
  },
  secondaryText: { color: brandBlue },
  pressed: { opacity: 0.6 },
});
