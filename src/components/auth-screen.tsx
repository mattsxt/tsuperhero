import { useEffect, useState, type ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type TextStyle,
} from "react-native";
import Animated, {
  LinearTransition,
  type CSSTransitionProperties,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { brandCompactDuration } from "@/components/brand-header";

// For titles that tighten their spacing alongside the brand header.
export const authSpacingTransition: CSSTransitionProperties<TextStyle> = {
  transitionProperty: ["marginTop", "marginBottom"],
  transitionDuration: brandCompactDuration,
  transitionTimingFunction: "ease-in-out",
};

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

// Centered auth layout. While the keyboard is open (compact), the content
// glides to the top so the fields sit above the keyboard; it stays
// scrollable for small screens.
export function AuthScreen({
  compact = false,
  children,
}: {
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, compact && styles.compact]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View
            layout={LinearTransition.duration(brandCompactDuration)}
            style={styles.column}
          >
            {children}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#ffffff" },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 20,
  },
  compact: { justifyContent: "flex-start", paddingTop: 12 },
  column: { alignItems: "center" },
});
