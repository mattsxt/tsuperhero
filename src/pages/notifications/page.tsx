import { BlurTargetView } from "expo-blur";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import BellOff from "lucide-react-native/icons/bell-off";
import CheckCheck from "lucide-react-native/icons/check-check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  formatNotificationTime,
  isToday,
  notificationTypeLabels,
  notificationTypeRoutes,
  type AppNotification,
} from "@/api/v1/notifications/controllers";
import { loadHomeRoute } from "@/api/v1/profile/controllers";
import { BottomNav, bottomNavHeight } from "@/components/bottom-nav";
import { moduleIcons } from "@/components/module-icons";
import {
  ExpandedOnly,
  headerLayoutTransition,
  StickyHeader,
  useScrollChrome,
} from "@/components/scroll-chrome";
import type { AppRoute } from "@/constants/routes";
import {
  markAllNotificationsRead,
  markNotificationRead,
  useNotifications,
} from "@/hooks/use-notifications";

const brandBlue = "#193caf";
const headerBlue = "#1034A6";
const cardEdgeBlue = "#1a2f8f";
const iconBackground = "#d4ecf9";
const unreadBackground = "#eef4fd";
const mutedText = "#6b6b6b";

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const chrome = useScrollChrome();
  const { collapsed } = chrome;
  const blurTarget = useRef<View | null>(null);
  const [homeRoute, setHomeRoute] = useState<AppRoute | null>(null);
  const notifications = useNotifications();

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

  const unreadCount = notifications.filter((item) => !item.read).length;
  const today = notifications.filter((item) => isToday(item.createdAt));
  const earlier = notifications.filter((item) => !isToday(item.createdAt));

  const markAllRead = markAllNotificationsRead;

  const openNotification = (notification: AppNotification) => {
    markNotificationRead(notification.id);
    router.push(notificationTypeRoutes[notification.type]);
  };

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
            {notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <BellOff color={brandBlue} size={32} strokeWidth={1.8} />
                </View>
                <Text style={styles.emptyTitle}>You&apos;re all caught up</Text>
                <Text style={styles.emptyText}>
                  New updates about your trips will show up here.
                </Text>
              </View>
            ) : (
              <>
                <NotificationSection
                  title="Today"
                  items={today}
                  onPress={openNotification}
                />
                <NotificationSection
                  title="Earlier"
                  items={earlier}
                  onPress={openNotification}
                />
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
            <View style={collapsed && styles.headerRowCollapsed}>
              <Text style={[styles.title, collapsed && styles.titleCollapsed]}>
                Notifications
              </Text>
              <ExpandedOnly collapsed={collapsed}>
                <Text style={styles.subtitle}>
                  Updates on your trips, rentals and pickups
                </Text>
              </ExpandedOnly>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mark all notifications as read"
                accessibilityState={{ disabled: unreadCount === 0 }}
                disabled={unreadCount === 0}
                onPress={markAllRead}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.markAllButton,
                  collapsed && styles.markAllButtonCollapsed,
                  pressed && styles.pressed,
                  unreadCount === 0 && styles.markAllDisabled,
                ]}
              >
                <CheckCheck color="#ffffff" size={14} strokeWidth={2.2} />
                <Text style={styles.markAllText}>Mark all as read</Text>
              </Pressable>
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

function NotificationSection({
  title,
  items,
  onPress,
}: {
  title: string;
  items: AppNotification[];
  onPress: (notification: AppNotification) => void;
}) {
  if (items.length === 0) return null;

  return (
    <>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.list}>
        {items.map((item) => (
          <NotificationCard key={item.id} notification={item} onPress={onPress} />
        ))}
      </View>
    </>
  );
}

function NotificationCard({
  notification,
  onPress,
}: {
  notification: AppNotification;
  onPress: (notification: AppNotification) => void;
}) {
  const Icon = moduleIcons[notification.type];
  const unread = !notification.read;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? "Unread. " : ""}${notification.title}. ${notification.message}`}
      onPress={() => onPress(notification)}
      style={({ pressed }) => [
        styles.card,
        unread && styles.cardUnread,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.iconCircle}>
        <Icon color={brandBlue} size={22} strokeWidth={1.8} />
      </View>

      <View style={styles.cardText}>
        <View style={styles.cardTopRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>
              {notificationTypeLabels[notification.type]}
            </Text>
          </View>
          <Text style={styles.time}>
            {formatNotificationTime(notification.createdAt)}
          </Text>
          {unread && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={styles.cardMessage} numberOfLines={3}>
          {notification.message}
        </Text>
      </View>

      <ChevronRight color={brandBlue} size={18} strokeWidth={2.5} />
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
  markAllButton: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
  },
  markAllButtonCollapsed: { marginTop: 0 },
  markAllDisabled: { opacity: 0.4 },
  headerCollapsed: { paddingBottom: 14 },
  headerRowCollapsed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleCollapsed: { fontSize: 17, lineHeight: 24 },
  markAllText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 10 },
  body: { paddingHorizontal: 12 },
  sectionLabel: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 10,
    marginTop: 18,
    marginBottom: 10,
  },
  list: { gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: brandBlue,
    borderRightWidth: 5,
    borderRightColor: cardEdgeBlue,
    borderRadius: 10,
  },
  cardUnread: { backgroundColor: unreadBackground },
  iconCircle: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: iconBackground,
  },
  cardText: { flex: 1 },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#0f2a5c",
  },
  typeText: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 7 },
  time: { flex: 1, color: mutedText, fontFamily: "Sora", fontSize: 8 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: brandBlue,
  },
  cardTitle: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 13,
    marginTop: 6,
  },
  cardMessage: {
    color: "#111111",
    fontFamily: "Sora",
    fontSize: 9,
    lineHeight: 13,
    marginTop: 3,
  },
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
