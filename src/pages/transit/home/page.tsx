import { BlurTargetView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Clock from "lucide-react-native/icons/clock";
import BriefcaseBusiness from "lucide-react-native/icons/briefcase-business";
import Route from "lucide-react-native/icons/route";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { loadHome, peekHomeName } from "@/api/v1/profile/controllers";
import { loadJobBoard } from "@/api/v1/rentals/controllers";
import { BottomNav, bottomNavHeight } from "@/components/bottom-nav";
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
import { RatingsSummary } from "@/pages/transit/home/ratings-summary";
import { HomeSkeleton } from "@/components/skeleton";

const { brandBlue } = homeColors;

export default function TransitHomeScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const blurTarget = useRef<View | null>(null);
  const [firstName, setFirstName] = useState(() =>
    peekHomeName("transit_personnel"),
  );
  const [openJobs, setOpenJobs] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadJobBoard().then((result) => {
        if (active && result.ok) setOpenJobs(result.data.length);
      });
      return () => {
        active = false;
      };
    }, []),
  );

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
                title="Rental Jobs"
                description="Take charter trips posted by commuters"
                icon={
                  <BriefcaseBusiness
                    color={brandBlue}
                    size={40}
                    strokeWidth={1.8}
                  />
                }
                onPress={() => router.push(Routes.transitRentalRequests)}
                badge={
                  openJobs > 0
                    ? `${openJobs > 9 ? "9+" : openJobs} NEW`
                    : undefined
                }
              />
              <ActionCard
                title="Trip History"
                description="See the trips you've completed"
                icon={<Clock color={brandBlue} size={40} strokeWidth={1.8} />}
                onPress={() => router.push(Routes.transitTripHistory)}
              />
            </ActionRow>

            <SectionDivider />
            <SectionHeader title="Ratings" />
            <RatingsSummary />
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
