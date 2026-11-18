import { BlurTargetView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Bus from "lucide-react-native/icons/bus";
import MapPinSearch from "lucide-react-native/icons/map-pin-search";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { loadHome, peekHomeName } from "@/api/v1/profile/controllers";
import { loadWaitingAreas } from "@/api/v1/waiting-areas/controllers";
import { BottomNav, bottomNavHeight } from "@/components/bottom-nav";
import {
  ActionCard,
  ActionRow,
  homeColors,
  HomeHeader,
  SectionDivider,
} from "@/components/home-ui";
import { PickupIcon } from "@/components/module-icons";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { usePickupStatus } from "@/hooks/use-pickup-status";
import { ActivePickupBanner } from "@/pages/commuter/home/active-pickup-banner";
import { RecentBookings } from "@/pages/commuter/home/recent-bookings";
import { HomeSkeleton } from "@/components/skeleton";

const { brandBlue } = homeColors;

export default function CommuterHomeScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const blurTarget = useRef<View | null>(null);
  const [firstName, setFirstName] = useState(() => peekHomeName("commuter"));
  const { status: pickupStatus, refresh: refreshPickupStatus } =
    usePickupStatus();
  const [refreshKey, setRefreshKey] = useState(0);
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      setRefreshKey((key) => key + 1);
    }, []),
  );
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    setRefreshKey((key) => key + 1);
    const [home] = await Promise.all([
      loadHome("commuter"),
      refreshPickupStatus(),
      loadWaitingAreas(),
    ]);
    if (!("redirect" in home)) setFirstName(home.firstName);
    setRefreshing(false);
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      const home = await loadHome("commuter");
      if ("redirect" in home) {
        router.replace(home.redirect as never);
        return;
      }
      if (active) setFirstName(home.firstName);
      loadWaitingAreas();
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  if (firstName === null) {
    return <HomeSkeleton />;
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={brandBlue}
              colors={[brandBlue]}
              progressViewOffset={chrome.headerHeight}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.body}>
            <ActivePickupBanner status={pickupStatus} />

            <ActionRow>
              <ActionCard
                title="Routes"
                description="Find the best routes for you"
                icon={
                  <MapPinSearch color={brandBlue} size={40} strokeWidth={1.8} />
                }
                onPress={() => router.push(Routes.commuterRoutes)}
              />
              <ActionCard
                title="Rental"
                description="Rent a vehicle for your trip"
                icon={<Bus color={brandBlue} size={40} strokeWidth={1.8} />}
                onPress={() => router.push(Routes.commuterRental)}
                badge={pickupStatus?.kind === "rental" ? "ACTIVE" : undefined}
              />
              <ActionCard
                title="Pickup"
                description="Schedule a pickup easily"
                icon={<PickupIcon color={brandBlue} size={40} />}
                onPress={() => router.push(Routes.commuterPickup)}
                badge={
                  pickupStatus && pickupStatus.kind !== "rental"
                    ? "ACTIVE"
                    : undefined
                }
              />
            </ActionRow>

            <SectionDivider />
            <RecentBookings limit={2} refreshKey={refreshKey} />
          </View>
        </Animated.ScrollView>

        <StickyHeader chrome={chrome}>
          <HomeHeader
            firstName={firstName}
            subtitle="Connect with Available Drivers Nearby!"
            collapsed={chrome.collapsed}
            topInset={insets.top}
          />
        </StickyHeader>
      </BlurTargetView>

      <BottomNav
        active="home"
        homeRoute={Routes.commuterHome}
        blurTarget={blurTarget}
        hidden={chrome.navHidden}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  blurTarget: { flex: 1 },
  body: { paddingHorizontal: 12 },
});
