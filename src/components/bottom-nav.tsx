import { BlurView } from "expo-blur";
import { router } from "expo-router";
import Bell from "lucide-react-native/icons/bell";
import House from "lucide-react-native/icons/house";
import UserRound from "lucide-react-native/icons/user-round";
import type { RefObject } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Routes, type AppRoute } from "@/constants/routes";

const navBlue = "#1034A6";

export const bottomNavHeight = 110;

type Tab = "home" | "notifications" | "profile";

const tabOrder: Record<Tab, number> = { notifications: 0, home: 1, profile: 2 };

export type TabTransition = "forward" | "back";

export function BottomNav({
  active,
  homeRoute,
  blurTarget,
}: {
  active: Tab;
  homeRoute: AppRoute;
  blurTarget: RefObject<View | null>;
}) {
  const insets = useSafeAreaInsets();

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
    { tab: "notifications", label: "Notifications", Icon: Bell },
    { tab: "home", label: "Home", Icon: House, route: homeRoute },
    {
      tab: "profile",
      label: "Profile",
      Icon: UserRound,
      route: Routes.profile,
    },
  ];

  return (
    <View style={[styles.nav, { bottom: insets.bottom + 12 }]}>
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
            accessibilityLabel={label}
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
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 70,
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
});
