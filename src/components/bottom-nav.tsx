import { BlurView } from "expo-blur";
import { router } from "expo-router";
import Bell from "lucide-react-native/icons/bell";
import House from "lucide-react-native/icons/house";
import UserRound from "lucide-react-native/icons/user-round";
import type { RefObject } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Routes, type AppRoute } from "@/constants/routes";
import { useUnreadNotificationCount } from "@/hooks/use-notifications";

const navBlue = "#1034A6";

export const bottomNavHeight = 110;

const navBarHeight = 70;
const navGap = 12;

type Tab = "home" | "notifications" | "profile";

const tabOrder: Record<Tab, number> = { notifications: 0, home: 1, profile: 2 };

export type TabTransition = "forward" | "back";

export function BottomNav({
  active,
  homeRoute,
  blurTarget,
  hidden,
}: {
  active: Tab;
  homeRoute: AppRoute;
  blurTarget: RefObject<View | null>;
  hidden?: SharedValue<number>;
}) {
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadNotificationCount();
  const offscreen = navBarHeight + insets.bottom + navGap + 16;
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (hidden?.value ?? 0) * offscreen }],
  }));

  const goTo = (tab: Tab, route: AppRoute) => {
    if (tab === active) return;
    const transition: TabTransition =
      tabOrder[tab] < tabOrder[active] ? "back" : "forward";
    router.replace({ pathname: route, params: { transition } } as Parameters<
      typeof router.replace
    >[0]);
  };

  const tabs: {
    tab: Tab;
    label: string;
    Icon: typeof House;
    route?: AppRoute;
  }[] = [
    {
      tab: "notifications",
      label: "Notifications",
      Icon: Bell,
      route: Routes.notifications,
    },
    { tab: "home", label: "Home", Icon: House, route: homeRoute },
    {
      tab: "profile",
      label: "Profile",
      Icon: UserRound,
      route: Routes.profile,
    },
  ];

  return (
    <Animated.View
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
      {tabs.map(({ tab, label, Icon, route }) => {
        const selected = tab === active;
        return (
          <Pressable
            key={tab}
            accessibilityRole="button"
            accessibilityLabel={
              tab === "notifications" && unreadCount > 0
                ? `${label}, ${unreadCount} unread`
                : label
            }
            accessibilityState={{ selected }}
            onPress={route ? () => goTo(tab, route) : undefined}
            style={({ pressed }) => [
              styles.tab,
              selected && styles.tabSelected,
              pressed && !selected && styles.tabPressed,
            ]}
          >
            <Icon
              color={selected ? navBlue : "#ffffff"}
              size={34}
              strokeWidth={2}
            />
            {tab === "notifications" && unreadCount > 0 && (
              <View style={styles.badge} pointerEvents="none">
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </Animated.View>
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
    paddingHorizontal: 44,
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
  tab: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  tabSelected: { backgroundColor: "#ffffff" },
  tabPressed: { backgroundColor: "rgba(255, 255, 255, 0.15)" },
  badge: {
    position: "absolute",
    top: 3,
    right: 3,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#ffffff",
    backgroundColor: "#d93025",
  },
  badgeText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 9,
    lineHeight: 12,
  },
});
