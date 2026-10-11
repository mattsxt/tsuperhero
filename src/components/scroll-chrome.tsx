import { createContext, useContext, useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
} from "react-native";
import ChevronLeft from "lucide-react-native/icons/chevron-left";
import Animated, {
  Easing,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { palette } from "@/constants/colors";

const collapseOffset = 24;
const expandOffset = 8;
const directionThreshold = 6;

const chromeDuration = 220;
const chromeTiming = {
  duration: chromeDuration,
  easing: Easing.out(Easing.cubic),
};

const expandedPadTop = 16;
const collapsedPadTop = 10;
const expandedPadBottom = 26;
const collapsedPadBottom = 14;
const expandedRow = 68;
const collapsedRow = 34;
const titleScale = 18 / 30;
const collapsedIconShift = (collapsedRow - 44 * titleScale) / 2;

export const headerHeights = (topInset: number, footer = 0) => ({
  expanded:
    topInset + expandedPadTop + expandedRow + footer + expandedPadBottom,
  collapsed:
    topInset + collapsedPadTop + collapsedRow + footer + collapsedPadBottom,
});

type ScrollChrome = {
  collapsed: boolean;
  progress: SharedValue<number>;
  navHidden: SharedValue<number>;
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
  headerHeight: number;
  collapsedHeaderHeight: number;
  onHeaderLayout: (event: LayoutChangeEvent) => void;
  setLocked: (locked: boolean) => void;
};

export function useScrollChrome(): ScrollChrome {
  const insets = useSafeAreaInsets();
  const heights = headerHeights(insets.top);
  const [collapsed, setCollapsed] = useState(false);
  const progress = useSharedValue(0);
  const collapsedValue = useSharedValue(false);
  const lockedValue = useSharedValue(false);
  const navHidden = useSharedValue(0);
  const lastY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    const y = event.contentOffset.y;
    const dy = y - lastY.value;
    lastY.value = y;
    if (lockedValue.value) return;

    const shouldCollapse = collapsedValue.value
      ? y > expandOffset
      : y > collapseOffset && dy > 0;
    if (shouldCollapse !== collapsedValue.value) {
      collapsedValue.value = shouldCollapse;
      progress.value = withTiming(shouldCollapse ? 1 : 0, chromeTiming);
      scheduleOnRN(setCollapsed, shouldCollapse);
    }

    if (y <= 0) {
      navHidden.value = withTiming(0, chromeTiming);
    } else if (dy > directionThreshold && navHidden.value < 1) {
      navHidden.value = withTiming(1, chromeTiming);
    } else if (dy < -directionThreshold && navHidden.value > 0) {
      navHidden.value = withTiming(0, chromeTiming);
    }
  });

  const setLocked = (next: boolean) => {
    lockedValue.set(next);
    collapsedValue.set(next);
    progress.set(withTiming(next ? 1 : 0, chromeTiming));
    navHidden.set(withTiming(next ? 1 : 0, chromeTiming));
    setCollapsed(next);
  };

  return {
    collapsed,
    progress,
    navHidden,
    scrollHandler,
    headerHeight: heights.expanded,
    collapsedHeaderHeight: heights.collapsed,
    onHeaderLayout: () => {},
    setLocked,
  };
}

const HeaderProgress = createContext<SharedValue<number> | null>(null);

export function StickyHeader({
  chrome,
  children,
}: {
  chrome: ScrollChrome;
  children: ReactNode;
}) {
  return (
    <HeaderProgress.Provider value={chrome.progress}>
      <View style={styles.sticky} pointerEvents="box-none">
        {children}
      </View>
    </HeaderProgress.Provider>
  );
}

export function CollapsibleHeader({
  title,
  subtitle,
  icon,
  onBack,
  titleStyle,
  children,
  footerHeight = 0,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  onBack?: () => void;
  titleStyle?: StyleProp<TextStyle>;
  children?: ReactNode;
  footerHeight?: number;
}) {
  const insets = useSafeAreaInsets();
  const sticky = useContext(HeaderProgress);
  const still = useSharedValue(0);
  const progress = sticky ?? still;
  const heights = headerHeights(insets.top, footerHeight);

  const row = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [expandedRow, collapsedRow]),
  }));
  const container = useAnimatedStyle(() => ({
    height: interpolate(
      progress.value,
      [0, 1],
      [heights.expanded, heights.collapsed],
    ),
    paddingTop:
      insets.top +
      interpolate(progress.value, [0, 1], [expandedPadTop, collapsedPadTop]),
  }));
  const titleMotion = useAnimatedStyle(() => ({
    fontSize: interpolate(progress.value, [0, 1], [30, 18]),
    lineHeight: interpolate(progress.value, [0, 1], [38, 24]),
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [0, (collapsedRow - 24) / 2],
        ),
      },
    ],
  }));
  const subtitleMotion = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5], [1, 0], "clamp"),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -10]) }],
  }));
  const iconMotion = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [0, collapsedIconShift],
        ),
      },
      { scale: interpolate(progress.value, [0, 1], [1, titleScale]) },
    ],
  }));
  const backMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [4, 0]) }],
  }));

  return (
    <Animated.View style={[styles.header, container]}>
      <Animated.View style={[styles.row, row]}>
        {onBack && (
          <Animated.View style={backMotion}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={10}
              onPress={onBack}
              style={styles.backButton}
            >
              <ChevronLeft color="#ffffff" size={22} strokeWidth={2.5} />
            </Pressable>
          </Animated.View>
        )}
        <View style={[styles.text, !onBack && styles.textNoBack]}>
          <Animated.Text
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={[styles.title, titleStyle, titleMotion]}
          >
            {title}
          </Animated.Text>
          <Animated.View style={subtitleMotion}>
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          </Animated.View>
        </View>
        <Animated.View style={[styles.icon, iconMotion]}>{icon}</Animated.View>
      </Animated.View>
      {!!children && <View style={{ height: footerHeight }}>{children}</View>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sticky: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  header: {
    overflow: "hidden",
    paddingHorizontal: 16,
    backgroundColor: palette.header,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  row: { flexDirection: "row", alignItems: "flex-start" },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.7)",
  },
  text: { flex: 1, marginLeft: 12, marginRight: 8 },
  textNoBack: { marginLeft: 0 },
  title: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 30,
    lineHeight: 38,
  },
  subtitle: {
    marginTop: 2,
    color: "#ffffff",
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 14,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    transformOrigin: "right top",
  },
});
