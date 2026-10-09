import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import { Platform } from "react-native";

import type { AppNotification } from "@/api/v1/notifications/controllers";
import * as Notifications from "@/api/v1/notifications/expo-notifications";

type NotificationData = Record<string, unknown>;

const updatesChannel = "updates";
const locationChannel = "location-sharing";
const locationNoticeId = "location-sharing";
const brandColor = "#1034A6";

const supported = Platform.OS !== "web";

let foregroundRoute: string | null = null;
let resolveRoute: (data: NotificationData) => string | null = () => null;

export function setForegroundRoute(route: string | null) {
  foregroundRoute = route;
}

const channelTrigger = (channelId: string) =>
  Platform.OS === "android" ? { channelId } : null;

export function configureDeviceNotifications(
  routeFor: (data: NotificationData) => string | null,
) {
  if (!supported) return;
  resolveRoute = routeFor;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data ?? {};
      if (data.type === "location_sharing") {
        return {
          shouldShowBanner: false,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      }
      const target = resolveRoute(data);
      const onTargetScreen = !!target && target === foregroundRoute;
      return {
        shouldShowBanner: !onTargetScreen,
        shouldShowList: !onTargetScreen,
        shouldPlaySound: !onTargetScreen,
        shouldSetBadge: true,
      };
    },
  });
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync(updatesChannel, {
      name: "Trip and pickup updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: brandColor,
    }).catch(() => null);
    Notifications.setNotificationChannelAsync(locationChannel, {
      name: "Location sharing",
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
      vibrationPattern: null,
      enableVibrate: false,
      showBadge: false,
    }).catch(() => null);
  }
}

export async function requestDevicePermission() {
  if (!supported) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const next = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return next.granted;
  } catch {
    return false;
  }
}

const easProjectId = (): string | undefined =>
  Constants.expoConfig?.extra?.eas?.projectId ??
  Constants.easConfig?.projectId ??
  undefined;

export async function getPushToken() {
  const projectId = easProjectId();
  if (!supported || !projectId) return null;
  if (isRunningInExpoGo() && Platform.OS === "android") return null;
  try {
    const token = await Notifications.getExpoPushTokenAsync(projectId);
    return token.data;
  } catch {
    return null;
  }
}

export async function presentOnDevice(item: AppNotification) {
  if (!supported) return;
  await Notifications.scheduleNotificationAsync({
    identifier: item.id,
    content: {
      title: item.title,
      body: item.body,
      sound: "default",
      color: brandColor,
      data: { ...item.data, notification_id: item.id, type: item.type },
    },
    trigger: channelTrigger(updatesChannel),
  }).catch(() => null);
}

export async function dismissFromDevice(ids: string[]) {
  if (!supported || ids.length === 0) return;
  const presented = await Notifications.getPresentedNotificationsAsync().catch(
    () => [],
  );
  await Promise.all(
    presented
      .filter(({ request }) => {
        const linked = request.content.data?.notification_id;
        return (
          ids.includes(request.identifier) ||
          (typeof linked === "string" && ids.includes(linked))
        );
      })
      .map(({ request }) =>
        Notifications.dismissNotificationAsync(request.identifier).catch(
          () => null,
        ),
      ),
  );
}

export async function clearDevice() {
  if (!supported) return;
  await Notifications.dismissAllNotificationsAsync().catch(() => null);
  await Notifications.setBadgeCountAsync(0).catch(() => null);
}

export function setAppBadge(count: number) {
  if (!supported) return;
  Notifications.setBadgeCountAsync(count).catch(() => null);
}

export function onNotificationOpened(
  listener: (data: NotificationData) => void,
) {
  if (!supported) return () => undefined;
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER)
        return;
      listener(response.notification.request.content.data ?? {});
    },
  );
  return () => subscription.remove();
}

export function takeLaunchNotification(): NotificationData | null {
  if (!supported) return null;
  const response = Notifications.getLastNotificationResponse();
  if (!response) return null;
  Notifications.clearLastNotificationResponse();
  return response.notification.request.content.data ?? {};
}

export async function showLocationSharingNotice() {
  if (!supported) return;
  await Notifications.scheduleNotificationAsync({
    identifier: locationNoticeId,
    content: {
      title: "Sharing your location",
      body: "Commuters and your cooperative can see your vehicle until you end the trip.",
      sticky: true,
      autoDismiss: false,
      sound: false,
      color: brandColor,
      priority: Notifications.AndroidNotificationPriority.LOW,
      interruptionLevel: "passive",
      data: { type: "location_sharing" },
    },
    trigger: channelTrigger(locationChannel),
  }).catch(() => null);
}

export async function hideLocationSharingNotice() {
  if (!supported) return;
  await Notifications.dismissNotificationAsync(locationNoticeId).catch(
    () => null,
  );
}

export async function isLocationSharingNoticeShown() {
  if (!supported) return true;
  const presented = await Notifications.getPresentedNotificationsAsync().catch(
    () => null,
  );
  if (!presented) return true;
  return presented.some(
    ({ request }) => request.identifier === locationNoticeId,
  );
}
