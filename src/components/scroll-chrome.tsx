import { useState, type ReactNode } from "react";
import {
  StyleSheet,
  type LayoutChangeEvent,
  type TextStyle,
} from "react-native";
import Animated, {
  type CSSTransitionProperties,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const collapseOffset = 8;
const directionThreshold = 6;

export const chromeDuration = 250;
export const headerLayoutTransition = LinearTransition.duration(chromeDuration);
export const headerTitleTransition: CSSTransitionProperties<TextStyle> = {
  transitionProperty: ["fontSize", "lineHeight"],
  transitionDuration: chromeDuration,
  transitionTimingFunction: "ease-in-out",
};
export const headerFadeIn = FadeIn.duration(chromeDuration);
export const headerFadeOut = FadeOut.duration(150);

export type ScrollChrome = {
  collapsed: boolean;
  navHidden: SharedValue<number>;
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
  headerHeight: number;
  collapsedHeaderHeight: number | null;
  onHeaderLayout: (event: LayoutChangeEvent) => void;
  setLocked: (locked: boolean) => void;
};

export function useScrollChrome(): ScrollChrome {
  const [scrolledPast, setScrolledPast] = useState(false);
  const [locked, setLockedState] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [collapsedHeaderHeight, setCollapsedHeaderHeight] = useState<
    number | null
  >(null);
  const collapsedValue = useSharedValue(false);
  const lockedValue = useSharedValue(false);
  const navHidden = useSharedValue(0);
  const lastY = useSharedValue(0);
  const collapsed = scrolledPast || locked;

  const scrollHandler = useAnimatedScrollHandler((event) => {
    const y = event.contentOffset.y;
    const dy = y - lastY.value;
    lastY.value = y;
    if (lockedValue.value) return;

    const shouldCollapse = y > collapseOffset;
    if (shouldCollapse !== collapsedValue.value) {
      collapsedValue.value = shouldCollapse;
      scheduleOnRN(setScrolledPast, shouldCollapse);
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
    const { height } = event.nativeEvent.layout;
    if (collapsed) setCollapsedHeaderHeight(height);
    else setHeaderHeight(height);
  };

  const setLocked = (next: boolean) => {
    lockedValue.set(next);
    navHidden.set(withTiming(next ? 1 : 0, { duration: chromeDuration }));
    collapsedValue.set(false);
    setScrolledPast(false);
    setLockedState(next);
  };

  return {
    collapsed,
    navHidden,
    scrollHandler,
    headerHeight,
    collapsedHeaderHeight,
    onHeaderLayout,
    setLocked,
  };
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
