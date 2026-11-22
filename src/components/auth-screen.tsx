import { useEffect, useState, type ReactNode } from "react";
import {
  Keyboard,
  Platform,
  StyleSheet,
  View,
  type TextStyle,
} from "react-native";
import Animated, {
  LinearTransition,
  type CSSTransitionProperties,
} from "react-native-reanimated";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { useStatusBarTop } from "@/hooks/use-status-bar-top";

import { brandCompactDuration } from "@/components/brand-header";
import { AnimatedErrorAlert } from "@/components/error-alert";

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

export function AuthScreen({
  compact = false,
  error,
  children,
}: {
  compact?: boolean;
  error?: { title: string; message: string };
  children: ReactNode;
}) {
  const statusBarTop = useStatusBarTop();
  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        pointerEvents="none"
        style={[styles.errorLayer, { top: statusBarTop + 12 }]}
      >
        <AnimatedErrorAlert
          title={error?.title ?? ""}
          message={error?.message ?? ""}
          style={styles.errorBanner}
        />
      </View>
      <KeyboardAwareScrollView
        bottomOffset={24}
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
      </KeyboardAwareScrollView>
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
  errorLayer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
    alignItems: "center",
  },
  errorBanner: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 10,
    backgroundColor: "#fff1f0",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
