import { BlurTargetView } from "expo-blur";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Bus from "lucide-react-native/icons/bus";
import MapPinSearch from "lucide-react-native/icons/map-pin-search";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedRef,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { loadActivePickup } from "@/api/v1/pickups/controllers";
import { loadHome } from "@/api/v1/profile/controllers";
import { loadWaitingAreas } from "@/api/v1/waiting-areas/controllers";
import { BottomNav, bottomNavHeight } from "@/components/bottom-nav";
import { LoadingSprite } from "@/components/brand-logo";
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
import {
  DestinationSearchPanel,
  DestinationSearchTrigger,
} from "@/pages/commuter/home/destination-search";
import { RecentBookings } from "@/pages/commuter/home/recent-bookings";

const { brandBlue } = homeColors;
const searchLayerGap = 14;

export default function CommuterHomeScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const blurTarget = useRef<View | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const minimizedHeaderHeight = chrome.collapsedHeaderHeight ?? insets.top + 56;

  const changeSearchOpen = (open: boolean) => {
    if (open) scrollRef.current?.scrollTo({ y: 0, animated: false });
    chrome.setLocked(open);
    setSearchOpen(open);
  };
  const closeSearch = () => changeSearchOpen(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const home = await loadHome("commuter");
      if ("redirect" in home) {
        router.replace(home.redirect as never);
        return;
      }
      if (active) setFirstName(home.firstName);
      loadActivePickup();
      loadWaitingAreas();
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  if (firstName === null) {
    return (
      <View style={styles.loadingScreen}>
        <LoadingSprite color={brandBlue} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <BlurTargetView ref={blurTarget} style={styles.blurTarget}>
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={chrome.scrollHandler}
          scrollEventThrottle={16}
          scrollEnabled={!searchOpen}
          contentContainerStyle={{
            paddingTop: chrome.headerHeight,
            paddingBottom: insets.bottom + bottomNavHeight,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.body}>
            <DestinationSearchTrigger onOpen={() => changeSearchOpen(true)} />

            {!searchOpen && (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(120)}
              >
                <ActionRow>
                  <ActionCard
                    title="Routes"
                    description="Find the best routes for you"
                    icon={
                      <MapPinSearch
                        color={brandBlue}
                        size={40}
                        strokeWidth={1.8}
                      />
                    }
                    onPress={() => router.push(Routes.commuterRoutes)}
                  />
                  <ActionCard
                    title="Rental"
                    description="Rent a vehicle for your trip"
                    icon={<Bus color={brandBlue} size={40} strokeWidth={1.8} />}
                    onPress={() => router.push(Routes.commuterRental)}
                  />
                  <ActionCard
                    title="Pickup"
                    description="Schedule a pickup easily"
                    icon={<PickupIcon color={brandBlue} size={40} />}
                    onPress={() => router.push(Routes.commuterPickup)}
                  />
                </ActionRow>

                <SectionDivider />
                <RecentBookings limit={2} />
              </Animated.View>
            )}
          </View>
        </Animated.ScrollView>

        {searchOpen && (
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(120)}
            style={[
              styles.searchLayer,
              { paddingTop: minimizedHeaderHeight + searchLayerGap },
            ]}
          >
            <DestinationSearchPanel
              onClose={closeSearch}
              topOffset={minimizedHeaderHeight}
            />
          </Animated.View>
        )}

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
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  screen: { flex: 1, backgroundColor: "#ffffff" },
  blurTarget: { flex: 1 },
  body: { paddingHorizontal: 12, paddingTop: searchLayerGap },
  searchLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
});
