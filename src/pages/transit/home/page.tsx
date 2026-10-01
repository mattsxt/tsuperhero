import { BlurTargetView } from "expo-blur";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Clock from "lucide-react-native/icons/clock";
import Inbox from "lucide-react-native/icons/inbox";
import Route from "lucide-react-native/icons/route";
import Star from "lucide-react-native/icons/star";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { loadHome } from "@/api/v1/profile/controllers";
import { BottomNav, bottomNavHeight } from "@/components/bottom-nav";
import { EmptyState } from "@/components/empty-state";
import {
  ActionCard,
  ActionRow,
  HomeHeader,
  homeColors,
  SectionDivider,
  SectionHeader,
} from "@/components/home-ui";
import { StickyHeader, useScrollChrome } from "@/components/scroll-chrome";
import { Routes } from "@/constants/routes";
import { RatingsCard } from "@/pages/transit/home/ratings";
import type { CommuterRating } from "@/pages/transit/types";

const { brandBlue } = homeColors;

const ratings: CommuterRating[] = [];

export default function TransitHomeScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const blurTarget = useRef<View | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const home = await loadHome("transit_personnel");
      if ("redirect" in home) {
        router.replace(home.redirect);
        return;
      }
      if (active) setFirstName(home.firstName);
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  if (firstName === null) {
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
            <ActionRow>
              <ActionCard
                title="Start Trip"
                description="Begin your route and pick up passengers"
                icon={<Route color={brandBlue} size={40} strokeWidth={1.8} />}
                onPress={() => router.push(Routes.transitStartTrip)}
              />
              <ActionCard
                title="Rental Requests"
                description="Review charter requests from commuters"
                icon={<Inbox color={brandBlue} size={40} strokeWidth={1.8} />}
                onPress={() => router.push(Routes.transitRentalRequests)}
              />
              <ActionCard
                title="Trip History"
                description="See the trips you've completed"
                icon={<Clock color={brandBlue} size={40} strokeWidth={1.8} />}
                onPress={() => router.push(Routes.transitTripHistory)}
              />
            </ActionRow>

            <SectionDivider />
            <SectionHeader title="Ratings" showViewAll={ratings.length > 0} />
            {ratings.length === 0 ? (
              <EmptyState
                icon={<Star color={brandBlue} size={32} strokeWidth={1.8} />}
                message="Ratings from commuters will show up here after your trips."
              />
            ) : (
              <RatingsCard ratings={ratings} />
            )}
          </View>
        </Animated.ScrollView>

        <StickyHeader chrome={chrome}>
          <HomeHeader
            firstName={firstName}
            subtitle="Ready to hit the road? Start a trip anytime!"
            collapsed={chrome.collapsed}
            topInset={insets.top}
          />
        </StickyHeader>
      </BlurTargetView>

      <BottomNav
        active="home"
        homeRoute={Routes.transitHome}
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
  body: { paddingHorizontal: 12 },
});
