import { BlurTargetView } from "expo-blur";
import { router, useFocusEffect } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BackHandler,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import {
  loadHomeRoute,
  peekSignedInHomeRoute,
} from "@/api/v1/profile/controllers";
import { BottomNav } from "@/components/bottom-nav";
import {
  HomeTabsContext,
  homeTabOrder,
  setVisibleHomePath,
  type HomeTab,
  type HomeTabHeader,
} from "@/components/home-tabs-context";
import {
  CollapsibleHeader,
  HeaderProgressProvider,
  headerHeights,
} from "@/components/scroll-chrome";
import { palette } from "@/constants/colors";
import { HomeSkeleton } from "@/components/skeleton";
import { Routes, type AppRoute } from "@/constants/routes";
import CommuterHomeScreen from "@/pages/commuter/home/page";
import NotificationsScreen from "@/pages/notifications/page";
import ProfileScreen from "@/pages/profile/page";
import TransitHomeScreen from "@/pages/transit/home/page";
import { isSimulation } from "@/simulation/flag";

import { setEdgeSwipeReserved } from "../../../modules/edge-swipe";

const homeIndex = homeTabOrder.indexOf("home");

export default function HomeTabs({
  initial,
  homeRoute: givenHomeRoute,
}: {
  initial: HomeTab;
  homeRoute?: AppRoute;
}) {
  const window = useWindowDimensions();
  const [size, setSize] = useState({
    width: window.width,
    height: window.height,
  });
  const pager = useAnimatedRef<Animated.ScrollView>();
  const startIndex = homeTabOrder.indexOf(initial);
  const progress = useSharedValue(startIndex);
  const [active, setActive] = useState(startIndex);
  const activeRef = useRef(startIndex);
  const [mounted, setMounted] = useState<number[]>([startIndex]);
  const [locked, setLocked] = useState(false);
  const [homeRoute, setHomeRoute] = useState<AppRoute | null>(
    () => givenHomeRoute ?? peekSignedInHomeRoute(),
  );
  const blurTarget = useRef<View | null>(null);
  const [headers, setHeaders] = useState<
    Partial<Record<HomeTab, HomeTabHeader>>
  >({});
  const setHeader = useCallback(
    (tab: HomeTab, header: HomeTabHeader | null) =>
      setHeaders((current) => {
        if ((current[tab] ?? null) === header) return current;
        const next = { ...current };
        if (header) next[tab] = header;
        else delete next[tab];
        return next;
      }),
    [],
  );

  const notificationsHidden = useSharedValue(0);
  const homeHidden = useSharedValue(0);
  const profileHidden = useSharedValue(0);
  const context = useMemo(
    () => ({
      navHidden: {
        notifications: notificationsHidden,
        home: homeHidden,
        profile: profileHidden,
      },
      setLocked,
      setHeader,
    }),
    [notificationsHidden, homeHidden, profileHidden, setHeader],
  );
  const hidden = useMemo(
    () => [notificationsHidden, homeHidden, profileHidden],
    [notificationsHidden, homeHidden, profileHidden],
  );

  useEffect(() => {
    if (homeRoute) return;
    let alive = true;
    loadHomeRoute().then((result) => {
      if (!alive) return;
      if ("redirect" in result) router.replace(result.redirect);
      else setHomeRoute(result.homeRoute);
    });
    return () => {
      alive = false;
    };
  }, [homeRoute]);

  useEffect(() => {
    const handle = requestIdleCallback(() =>
      setMounted(homeTabOrder.map((_, index) => index)),
    );
    return () => cancelIdleCallback(handle);
  }, []);

  const publish = useCallback(
    (index: number) => {
      const tab = homeTabOrder[index];
      setVisibleHomePath(
        tab === "notifications"
          ? Routes.notifications
          : tab === "profile"
            ? Routes.profile
            : homeRoute,
      );
    },
    [homeRoute],
  );

  useEffect(() => {
    publish(activeRef.current);
  }, [publish]);

  const settle = useCallback((index: number) => {
    publish(index);
    if (activeRef.current === index) return;
    activeRef.current = index;
    setActive(index);
    setMounted((current) =>
      current.includes(index) ? current : [...current, index],
    );
  }, [publish]);

  const pageWidth = size.width;
  const onScroll = useAnimatedScrollHandler((event) => {
    if (pageWidth <= 0) return;
    const next = event.contentOffset.x / pageWidth;
    progress.value = next;
    const nearest = Math.round(next);
    if (Math.abs(next - nearest) < 0.02) scheduleOnRN(settle, nearest);
  });

  const goTo = useCallback(
    (index: number) => {
      settle(index);
      pager.current?.scrollTo({ x: index * pageWidth, animated: true });
    },
    [pager, pageWidth, settle],
  );

  const pin = useCallback(() => {
    progress.set(activeRef.current);
    pager.current?.scrollTo({ x: activeRef.current * pageWidth, animated: false });
  }, [pager, pageWidth, progress]);

  useFocusEffect(
    useCallback(() => {
      pin();
      publish(activeRef.current);
      setEdgeSwipeReserved(true);
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (activeRef.current === homeIndex) return false;
          goTo(homeIndex);
          return true;
        },
      );
      return () => {
        subscription.remove();
        setEdgeSwipeReserved(false);
      };
    }, [goTo, pin, publish]),
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width === size.width && height === size.height) return;
    setSize({ width, height });
  };

  const renderPage = (tab: HomeTab) => {
    if (tab === "notifications") return <NotificationsScreen />;
    if (tab === "profile") return <ProfileScreen />;
    if (!homeRoute) return <HomeSkeleton />;
    return homeRoute === Routes.transitHome ? (
      <TransitHomeSlot />
    ) : (
      <CommuterHomeScreen />
    );
  };

  return (
    <HomeTabsContext.Provider value={context}>
      <View style={styles.screen} onLayout={onLayout}>
        <BlurTargetView ref={blurTarget} style={styles.screen}>
          <Animated.ScrollView
            ref={pager}
            horizontal
            pagingEnabled
            scrollEnabled={!locked}
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentOffset={{ x: startIndex * pageWidth, y: 0 }}
            showsHorizontalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            decelerationRate="fast"
            disableIntervalMomentum
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={pin}
          >
            {homeTabOrder.map((tab, index) => (
              <View
                key={tab}
                accessibilityElementsHidden={index !== active}
                importantForAccessibility={
                  index === active ? "auto" : "no-hide-descendants"
                }
                style={{ width: pageWidth, height: size.height }}
              >
                {mounted.includes(index) ? renderPage(tab) : null}
              </View>
            ))}
          </Animated.ScrollView>
        </BlurTargetView>

        {!locked && (
          <FixedHeader headers={headers} pager={progress} active={active} />
        )}

        {!locked && (
          <BottomNav
            progress={progress}
            hidden={hidden}
            active={active}
            onSelect={goTo}
            blurTarget={blurTarget}
          />
        )}
      </View>
    </HomeTabsContext.Provider>
  );
}

function FixedHeader({
  headers,
  pager,
  active,
}: {
  headers: Partial<Record<HomeTab, HomeTabHeader>>;
  pager: SharedValue<number>;
  active: number;
}) {
  const insets = useSafeAreaInsets();
  const heights = headerHeights(insets.top);
  const still = useSharedValue(0);
  const progressOf = homeTabOrder.map(
    (tab) => headers[tab]?.progress ?? still,
  );
  const backdrop = useAnimatedStyle(() => {
    let collapse = 0;
    for (let index = 0; index < progressOf.length; index++) {
      const weight = Math.max(0, 1 - Math.abs(pager.value - index));
      collapse += weight * progressOf[index].value;
    }
    return {
      height: interpolate(collapse, [0, 1], [heights.expanded, heights.collapsed]),
    };
  });

  return (
    <View pointerEvents="box-none" style={styles.headerLayer}>
      <Animated.View style={[styles.headerBackdrop, backdrop]} />
      {homeTabOrder.map((tab, index) => {
        const header = headers[tab];
        if (!header) return null;
        return (
          <HeaderSlot key={tab} index={index} pager={pager} active={active === index}>
            <HeaderProgressProvider progress={header.progress}>
              <CollapsibleHeader
                bare
                title={header.title}
                subtitle={header.subtitle}
                icon={header.icon}
              />
            </HeaderProgressProvider>
          </HeaderSlot>
        );
      })}
    </View>
  );
}

function HeaderSlot({
  index,
  pager,
  active,
  children,
}: {
  index: number;
  pager: SharedValue<number>;
  active: boolean;
  children: ReactNode;
}) {
  const fade = useAnimatedStyle(() => {
    const distance = Math.abs(pager.value - index);
    return {
      opacity: Math.max(0, 1 - distance * 2),
      transform: [{ translateY: Math.min(distance, 1) * 6 }],
    };
  });
  return (
    <Animated.View
      pointerEvents={active ? "box-none" : "none"}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      style={[styles.headerSlot, fade]}
    >
      {children}
    </Animated.View>
  );
}

function TransitHomeSlot() {
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (!isSimulation()) return;
    const { subscribeDemoRefresh } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/simulation/refresh") as typeof import("@/simulation/refresh");
    return subscribeDemoRefresh(() => setGeneration((value) => value + 1));
  }, []);
  return <TransitHomeScreen key={generation} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  headerLayer: { position: "absolute", top: 0, left: 0, right: 0 },
  headerBackdrop: {
    backgroundColor: palette.header,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerSlot: { position: "absolute", top: 0, left: 0, right: 0 },
});
