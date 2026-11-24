import { BlurView } from "expo-blur";
import Bell from "lucide-react-native/icons/bell";
import House from "lucide-react-native/icons/house";
import UserRound from "lucide-react-native/icons/user-round";
import type { RefObject } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { homeTabOrder, type HomeTab } from "@/components/home-tabs-context";
import { palette } from "@/constants/colors";
import { useNotifications } from "@/hooks/use-notifications";

const navBlue = palette.header;

export const bottomNavHeight = 110;

const navBarHeight = 70;
const navGap = 12;
const navPadding = 44;
const tabSize = 52;

const pressSpring = { damping: 16, stiffness: 320, mass: 0.6 };

const tabs: Record<HomeTab, { label: string; Icon: typeof House }> = {
  notifications: { label: "Notifications", Icon: Bell },
  home: { label: "Home", Icon: House },
  profile: { label: "Profile", Icon: UserRound },
};

export function BottomNav({
  progress,
  hidden,
  active,
  onSelect,
  blurTarget,
}: {
  progress: SharedValue<number>;
  hidden: SharedValue<number>[];
  active: number;
  onSelect: (index: number) => void;
  blurTarget: RefObject<View | null>;
}) {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();
  const width = useSharedValue(0);
  const offscreen = navBarHeight + insets.bottom + navGap + 16;

  const slideStyle = useAnimatedStyle(() => {
    let amount = 0;
    for (let index = 0; index < hidden.length; index++) {
      const weight = Math.max(0, 1 - Math.abs(progress.value - index));
      amount += weight * hidden[index].value;
    }
    return { transform: [{ translateY: amount * offscreen }] };
  });

  const indicatorStyle = useAnimatedStyle(() => {
    const first = navPadding;
    const last = Math.max(first, width.value - navPadding - tabSize);
    const middle = (first + last) / 2;
    const between = progress.value - Math.floor(progress.value);
    const stretch = 1 + 0.3 * Math.min(between, 1 - between);
    return {
      opacity: width.value > 0 ? 1 : 0,
      transform: [
        {
          translateX: interpolate(
            progress.value,
            [0, 1, 2],
            [first, middle, last],
            "clamp",
          ),
        },
        { scaleX: stretch },
      ],
    };
  });

  const measure = (event: LayoutChangeEvent) => {
    width.set(event.nativeEvent.layout.width);
  };

  return (
    <Animated.View
      onLayout={measure}
      style={[styles.nav, { bottom: insets.bottom + navGap }, slideStyle]}
    >
      <BlurView
        blurTarget={blurTarget}
        blurMethod="dimezisBlurViewSdk31Plus"
        intensity={40}
        tint="default"
        style={styles.blur}
      />
      <View style={styles.tint} />
      <Animated.View
        pointerEvents="none"
        style={[styles.indicator, indicatorStyle]}
      />
      {homeTabOrder.map((tab, index) => {
        const { label, Icon } = tabs[tab];
        const badge = tab === "notifications" ? unreadCount : 0;
        return (
          <NavButton
            key={tab}
            index={index}
            label={badge > 0 ? `${label}, ${badge} unread` : label}
            Icon={Icon}
            badge={badge}
            selected={index === active}
            progress={progress}
            onPress={() => onSelect(index)}
          />
        );
      })}
    </Animated.View>
  );
}

function NavButton({
  index,
  label,
  Icon,
  badge,
  selected,
  progress,
  onPress,
}: {
  index: number;
  label: string;
  Icon: typeof House;
  badge: number;
  selected: boolean;
  progress: SharedValue<number>;
  onPress: () => void;
}) {
  const held = useSharedValue(0);
  const focusedStyle = useAnimatedStyle(() => {
    const focus = Math.max(0, 1 - Math.abs(progress.value - index));
    return {
      opacity: focus,
      transform: [{ scale: (0.92 + 0.08 * focus) * (1 - 0.14 * held.value) }],
    };
  });
  const restingStyle = useAnimatedStyle(() => {
    const focus = Math.max(0, 1 - Math.abs(progress.value - index));
    return {
      opacity: 1 - focus,
      transform: [{ scale: (0.92 + 0.08 * focus) * (1 - 0.14 * held.value) }],
    };
  });
  const haloStyle = useAnimatedStyle(() => {
    const focus = Math.max(0, 1 - Math.abs(progress.value - index));
    return {
      opacity: held.value * (1 - focus) * 0.18,
      transform: [{ scale: 0.7 + 0.3 * held.value }],
    };
  });
  const press = (down: boolean) => {
    held.set(withSpring(down ? 1 : 0, pressSpring));
  };

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => press(true)}
      onPressOut={() => press(false)}
      style={styles.tab}
    >
      <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]} />
      <Animated.View style={[styles.icon, restingStyle]}>
        <Icon color="#ffffff" size={34} strokeWidth={2} />
      </Animated.View>
      <Animated.View style={[styles.icon, focusedStyle]}>
        <Icon color={navBlue} size={34} strokeWidth={2} />
      </Animated.View>
      {badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: "absolute",
    left: 16,
    right: 16,
    height: navBarHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: navPadding,
    borderRadius: 35,
    overflow: "hidden",
  },
  blur: {
    ...StyleSheet.absoluteFill,
    borderRadius: 35,
    overflow: "hidden",
  },
  tint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(16, 51, 166, 0.85)",
  },
  indicator: {
    position: "absolute",
    top: (navBarHeight - tabSize) / 2,
    left: 0,
    width: tabSize,
    height: tabSize,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
  tab: {
    width: tabSize,
    height: tabSize,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  icon: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: navBlue,
    backgroundColor: palette.danger,
  },
  badgeText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 9 },
  halo: {
    ...StyleSheet.absoluteFill,
    borderRadius: 10,
    backgroundColor: "#ffffff",
  },
});
