import { BlurTargetView } from "expo-blur";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import BellOff from "lucide-react-native/icons/bell-off";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { loadHomeRoute } from "@/api/v1/profile/controllers";
import { BottomNav, bottomNavHeight } from "@/components/bottom-nav";
import {
  ExpandedOnly,
  headerLayoutTransition,
  headerTitleTransition,
  StickyHeader,
  useScrollChrome,
} from "@/components/scroll-chrome";
import type { AppRoute } from "@/constants/routes";

const brandBlue = "#193caf";
const headerBlue = "#1034A6";
const iconBackground = "#d4ecf9";
const mutedText = "#6b6b6b";

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const { collapsed } = chrome;
  const blurTarget = useRef<View | null>(null);
  const [homeRoute, setHomeRoute] = useState<AppRoute | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const result = await loadHomeRoute();
      if ("redirect" in result) {
        router.replace(result.redirect);
        return;
      }
      if (active) setHomeRoute(result.homeRoute);
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  if (!homeRoute) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={brandBlue} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <BlurTargetView ref={blurTarget} style={styles.blurTarget}>
        <Animated.ScrollView
          onScroll={chrome.scrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{
            paddingTop: chrome.headerHeight,
            paddingBottom: insets.bottom + bottomNavHeight,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.body}>
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <BellOff color={brandBlue} size={32} strokeWidth={1.8} />
              </View>
              <Text style={styles.emptyTitle}>Nothing to see here yet</Text>
              <Text style={styles.emptyText}>
                New updates about your trips will show up here.
              </Text>
            </View>
          </View>
        </Animated.ScrollView>

        <StickyHeader chrome={chrome}>
          <Animated.View
            layout={headerLayoutTransition}
            style={[
              styles.header,
              collapsed && styles.headerCollapsed,
              { paddingTop: insets.top + (collapsed ? 10 : 16) },
            ]}
          >
            <View style={collapsed && styles.headerRowCollapsed}>
              <Animated.Text
                style={[
                  styles.title,
                  collapsed && styles.titleCollapsed,
                  headerTitleTransition,
                ]}
              >
                Notifications
              </Animated.Text>
              <ExpandedOnly collapsed={collapsed}>
                <Text style={styles.subtitle}>
                  Updates on your trips, rentals and pickups
                </Text>
              </ExpandedOnly>
            </View>
          </Animated.View>
        </StickyHeader>
      </BlurTargetView>

      <BottomNav
        active="notifications"
        homeRoute={homeRoute}
        blurTarget={blurTarget}
        hidden={chrome.navHidden}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  screen: { flex: 1, backgroundColor: "#ffffff" },
  blurTarget: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: headerBlue,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 21,
    lineHeight: 28,
  },
  subtitle: {
    color: "#ffffff",
    fontFamily: "Sora",
    fontSize: 10,
    marginTop: 4,
  },
  headerCollapsed: { paddingBottom: 14 },
  headerRowCollapsed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleCollapsed: { fontSize: 17, lineHeight: 24 },
  body: { paddingHorizontal: 12 },
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 36,
    backgroundColor: iconBackground,
  },
  emptyTitle: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 16,
    marginTop: 16,
  },
  emptyText: {
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
    textAlign: "center",
    marginTop: 6,
  },
});
