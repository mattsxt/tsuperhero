import { useState, type ReactNode } from "react";
import { StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

// Scroll distance before the header shortens; it only expands again at the top.
const collapseOffset = 8;
// Ignore tiny finger jitter before toggling the bottom nav.
const directionThreshold = 6;

export const chromeDuration = 250;
export const headerLayoutTransition = LinearTransition.duration(chromeDuration);
export const headerFadeIn = FadeIn.duration(chromeDuration);
export const headerFadeOut = FadeOut.duration(150);

export type ScrollChrome = {
  collapsed: boolean;
  navHidden: SharedValue<number>;
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
  headerHeight: number;
  onHeaderLayout: (event: LayoutChangeEvent) => void;
};

export function useScrollChrome(): ScrollChrome {
  const [collapsed, setCollapsed] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const collapsedValue = useSharedValue(false);
  const navHidden = useSharedValue(0);
  const lastY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    const y = event.contentOffset.y;
    const dy = y - lastY.value;
    lastY.value = y;

    const shouldCollapse = y > collapseOffset;
    if (shouldCollapse !== collapsedValue.value) {
      collapsedValue.value = shouldCollapse;
      scheduleOnRN(setCollapsed, shouldCollapse);
    }

    if (y <= 0) {
      navHidden.value = withTiming(0, { duration: chromeDuration });
    } else if (dy > directionThreshold && navHidden.value < 1) {
      navHidden.value = withTiming(1, { duration: chromeDuration });
    } else if (dy < -directionThreshold && navHidden.value > 0) {
      navHidden.value = withTiming(0, { duration: chromeDuration });
    }
  });

  const onHeaderLayout = (event: LayoutChangeEvent) => {
    // Content is padded by the full-size header so it never jumps.
    if (!collapsed) setHeaderHeight(event.nativeEvent.layout.height);
  };

  return { collapsed, navHidden, scrollHandler, headerHeight, onHeaderLayout };
}

export function StickyHeader({
  chrome,
  children,
}: {
  chrome: ScrollChrome;
  children: ReactNode;
}) {
  return (
    <Animated.View
      style={styles.sticky}
      onLayout={chrome.onHeaderLayout}
      pointerEvents="box-none"
    >
      {children}
    </Animated.View>
  );
}

// Content that only shows in the full-size header.
export function ExpandedOnly({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: ReactNode;
}) {
  if (collapsed) return null;
  return (
    <Animated.View entering={headerFadeIn} exiting={headerFadeOut}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sticky: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
});
