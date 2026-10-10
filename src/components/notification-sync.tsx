import { router, usePathname } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import { clearCache } from "@/api/v1/cache";
import { getSupabaseClient } from "@/api/v1/client";
import {
  clearNotifications,
  markNotificationsRead,
  notificationTarget,
  savePushToken,
  startNotificationSync,
} from "@/api/v1/notifications/controllers";
import {
  clearDevice,
  configureDeviceNotifications,
  dismissFromDevice,
  getPushToken,
  onNotificationOpened,
  presentOnDevice,
  requestDevicePermission,
  setAppBadge,
  setForegroundRoute,
  takeLaunchNotification,
} from "@/api/v1/notifications/device";
import { stopLocationSharing } from "@/api/v1/operator/location-sharing";
import { prepareOffline, resetOfflinePreparation } from "@/api/v1/prefetch";
import { clearOutbox } from "@/api/v1/operator/outbox";
import { Routes, type AppRoute } from "@/constants/routes";
import { isOnline, subscribeToOnline } from "@/hooks/use-online";
import { useNotifications } from "@/hooks/use-notifications";

let currentRoute: string | null = null;
let lastOpened: string | null = null;
let pendingTarget: AppRoute | null = null;

const signedInRoute = (route: string | null) =>
  !!route &&
  route !== "/" &&
  route !== Routes.landing &&
  !route.startsWith("/auth");

function navigateTo(target: AppRoute) {
  if (!signedInRoute(currentRoute)) {
    pendingTarget = target;
    return;
  }
  if (target !== currentRoute) router.push(target);
}

function openFromDevice(data: Record<string, unknown>) {
  const id =
    typeof data.notification_id === "string" ? data.notification_id : null;
  const key = id ?? String(data.type ?? "");
  if (key && key === lastOpened) return;
  lastOpened = key;
  if (id) markNotificationsRead([id]);
  const target = notificationTarget(data.type);
  if (target) navigateTo(target);
}

export function NotificationSync() {
  const pathname = usePathname();
  const { unreadCount } = useNotifications();

  useEffect(() => {
    currentRoute = pathname;
    setForegroundRoute(pathname);
    if (pendingTarget && signedInRoute(pathname)) {
      const target = pendingTarget;
      pendingTarget = null;
      if (target !== pathname) router.push(target);
    }
  }, [pathname]);

  useEffect(() => {
    setAppBadge(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    configureDeviceNotifications((data) => notificationTarget(data.type));
    stopLocationSharing();
    return onNotificationOpened(openFromDevice);
  }, []);

  useEffect(() => {
    let active = true;
    let userId: string | null = null;
    let stopSync: (() => void) | null = null;
    let usesPush = false;
    let stopPreparing: (() => void) | null = null;
    let startTimer: ReturnType<typeof setTimeout> | null = null;

    const start = async (nextUserId: string) => {
      if (!active || userId !== nextUserId) return;
      await requestDevicePermission();
      if (!active || userId !== nextUserId) return;
      const token = await getPushToken();
      if (!active || userId !== nextUserId) return;
      usesPush = !!token && (await savePushToken(token, Platform.OS));
      if (!active || userId !== nextUserId) return;
      stopSync = startNotificationSync({
        userId: nextUserId,
        onReceived: (item) => {
          if (notificationTarget(item.type) === currentRoute) {
            markNotificationsRead([item.id]);
            return;
          }
          if (!usesPush) presentOnDevice(item);
        },
        onRead: dismissFromDevice,
      });
      const launch = takeLaunchNotification();
      if (launch) openFromDevice(launch);
      stopPreparing = subscribeToOnline(() => {
        if (isOnline() && userId === nextUserId) prepareOffline();
      });
      if (isOnline()) prepareOffline();
    };

    const stop = () => {
      stopSync?.();
      stopSync = null;
      stopPreparing?.();
      stopPreparing = null;
      usesPush = false;
      clearNotifications();
      clearDevice();
      clearOutbox();
      clearCache();
      resetOfflinePreparation();
    };

    const { data } = getSupabaseClient().auth.onAuthStateChange(
      (_event, session) => {
        const nextUserId = session?.user.id ?? null;
        if (nextUserId === userId) return;
        if (startTimer) clearTimeout(startTimer);
        startTimer = null;
        if (userId) stop();
        userId = nextUserId;
        if (nextUserId) {
          startTimer = setTimeout(() => {
            startTimer = null;
            void start(nextUserId);
          }, 0);
        }
      },
    );

    return () => {
      active = false;
      if (startTimer) clearTimeout(startTimer);
      data.subscription.unsubscribe();
      stopSync?.();
      stopPreparing?.();
    };
  }, []);

  return null;
}
