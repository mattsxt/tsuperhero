import { BlurTargetView } from "expo-blur";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Bell from "lucide-react-native/icons/bell";
import BellOff from "lucide-react-native/icons/bell-off";
import Bus from "lucide-react-native/icons/bus";
import BusFront from "lucide-react-native/icons/bus-front";
import Star from "lucide-react-native/icons/star";
import UsersRound from "lucide-react-native/icons/users-round";
import CheckCheck from "lucide-react-native/icons/check-check";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CircleX from "lucide-react-native/icons/circle-x";
import Flag from "lucide-react-native/icons/flag";
import MapPin from "lucide-react-native/icons/map-pin";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  markAllNotificationsRead,
  markNotificationsRead,
  notificationTarget,
  refreshNotifications,
  type AppNotification,
} from "@/api/v1/notifications/controllers";
import { dismissFromDevice } from "@/api/v1/notifications/device";
import { loadHomeRoute } from "@/api/v1/profile/controllers";
import { BottomNav, bottomNavHeight } from "@/components/bottom-nav";
import { LoadingLogo } from "@/components/LoadingLogo";
import {
  ExpandedOnly,
  headerLayoutTransition,
  headerLogoTransition,
  headerTitleTransition,
  StickyHeader,
  useScrollChrome,
} from "@/components/scroll-chrome";
import type { AppRoute } from "@/constants/routes";
import { useNotifications } from "@/hooks/use-notifications";

const brandBlue = "#193caf";
const headerBlue = "#1034A6";
const iconBackground = "#d4ecf9";
const mutedText = "#6b6b6b";
const unreadBackground = "#eef4fe";

const typeIcons: Record<string, typeof Bell> = {
  pickup_accepted: BusFront,
  pickup_boarded: CircleCheck,
  pickup_released: RotateCcw,
  pickup_shared: UsersRound,
  pickup_shared_cancelled: CircleX,
  shared_pickup_accepted: BusFront,
  shared_pickup_released: RotateCcw,
  shared_pickup_boarded: CircleCheck,
  pickup_rejected: CircleX,
  pickup_nearby: MapPin,
  trip_completed: Flag,
  rental_accepted: Bus,
  rental_declined: CircleX,
  rental_completed: Bus,
  rate_trip: Star,
  rating_received: Star,
  rental_request: Bus,
  rental_cancelled: CircleX,
};

function formatWhen(date: Date) {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "Yesterday" : `${days} days ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const { collapsed } = chrome;
  const blurTarget = useRef<View | null>(null);
  const [homeRoute, setHomeRoute] = useState<AppRoute | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { notifications, unreadCount } = useNotifications();

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

  const refresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  const open = (item: AppNotification) => {
    if (!item.read) {
      markNotificationsRead([item.id]);
      dismissFromDevice([item.id]);
    }
    const target = notificationTarget(item.type);
    if (target) router.push(target);
  };

  const markAll = async () => {
    const result = await markAllNotificationsRead();
    if (result.ok) dismissFromDevice(result.data);
  };

  if (!homeRoute) {
    return (
      <View style={styles.loadingScreen}>
        <LoadingLogo color={brandBlue} />
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
            flexGrow: 1,
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
            {notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <BellOff color={brandBlue} size={32} strokeWidth={1.8} />
                </View>
                <Text style={styles.emptyTitle}>Nothing to see here yet</Text>
                <Text style={styles.emptyText}>
                  New updates about your trips will show up here.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.toolbar}>
                  <Text style={styles.toolbarText}>
                    {unreadCount > 0
                      ? `${unreadCount} unread`
                      : "All caught up"}
                  </Text>
                  {unreadCount > 0 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Mark all notifications as read"
                      hitSlop={8}
                      onPress={markAll}
                      style={({ pressed }) => [
                        styles.markAll,
                        pressed && styles.pressed,
                      ]}
                    >
                      <CheckCheck
                        color={brandBlue}
                        size={14}
                        strokeWidth={2.4}
                      />
                      <Text style={styles.markAllText}>Mark all as read</Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.list}>
                  {notifications.map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      onPress={() => open(item)}
                    />
                  ))}
                </View>
              </>
            )}
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
            <View
              style={[
                styles.headerRow,
                collapsed && styles.headerRowCollapsedIcon,
              ]}
            >
              <View style={styles.headerTextBlock}>
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
              <Animated.View
                style={[
                  styles.headerIcon,
                  collapsed && styles.headerIconCollapsed,
                  headerLogoTransition,
                ]}
              >
                <Bell color="#ffffff" size={40} strokeWidth={1.8} />
              </Animated.View>
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

function NotificationRow({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: () => void;
}) {
  const Icon = typeIcons[item.type] ?? Bell;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.read ? "" : "Unread. "}${item.title}. ${item.body}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !item.read && styles.rowUnread,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.rowIcon}>
        <Icon color={brandBlue} size={18} strokeWidth={2} />
      </View>
      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text
            style={[styles.rowTitle, !item.read && styles.rowTitleUnread]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={styles.rowTime}>{formatWhen(item.createdAt)}</Text>
        </View>
        <Text style={styles.rowBody} numberOfLines={3}>
          {item.body}
        </Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </Pressable>
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
  pressed: { opacity: 0.7 },
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
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerRowCollapsedIcon: { alignItems: "center" },
  headerTextBlock: { flex: 1 },
  headerIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    opacity: 1,
    transform: [{ scale: 1 }],
  },
  headerIconCollapsed: {
    width: 0,
    height: 0,
    opacity: 0,
    transform: [{ scale: 0.4 }],
  },
  headerCollapsed: { paddingBottom: 14 },
  titleCollapsed: { fontSize: 17, lineHeight: 24 },
  body: { flex: 1, paddingHorizontal: 12 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
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
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 18,
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  toolbarText: { color: mutedText, fontFamily: "SoraBold", fontSize: 10 },
  markAll: { flexDirection: "row", alignItems: "center", gap: 5 },
  markAllText: { color: brandBlue, fontFamily: "SoraBold", fontSize: 10 },
  list: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6ebf5",
    backgroundColor: "#ffffff",
  },
  rowUnread: { backgroundColor: unreadBackground, borderColor: "#cfdcf7" },
  rowIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: iconBackground,
  },
  rowText: { flex: 1, gap: 3 },
  rowTop: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  rowTitle: {
    flex: 1,
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 12,
  },
  rowTitleUnread: { color: brandBlue, fontFamily: "SoraBold" },
  rowTime: { color: mutedText, fontFamily: "Sora", fontSize: 9 },
  rowBody: {
    color: "#333333",
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
  },
  unreadDot: {
    width: 8,
    height: 8,
    marginTop: 4,
    borderRadius: 4,
    backgroundColor: brandBlue,
  },
});
