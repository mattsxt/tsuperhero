export { AndroidImportance } from "expo-notifications/build/NotificationChannelManager.types";
export { AndroidNotificationPriority } from "expo-notifications/build/Notifications.types";
export {
  addNotificationResponseReceivedListener,
  clearLastNotificationResponse,
  DEFAULT_ACTION_IDENTIFIER,
  getLastNotificationResponse,
} from "expo-notifications/build/NotificationsEmitter";
export { dismissAllNotificationsAsync } from "expo-notifications/build/dismissAllNotificationsAsync";
export { dismissNotificationAsync } from "expo-notifications/build/dismissNotificationAsync";
export { getPresentedNotificationsAsync } from "expo-notifications/build/getPresentedNotificationsAsync";
export {
  getPermissionsAsync,
  requestPermissionsAsync,
} from "expo-notifications/build/NotificationPermissions";
export { scheduleNotificationAsync } from "expo-notifications/build/scheduleNotificationAsync";
export { setBadgeCountAsync } from "expo-notifications/build/setBadgeCountAsync";
export { setNotificationChannelAsync } from "expo-notifications/build/setNotificationChannelAsync";
export { setNotificationHandler } from "expo-notifications/build/NotificationsHandler";

export async function getExpoPushTokenAsync(projectId: string) {
  const { getExpoPushTokenAsync: getToken } =
    await import("expo-notifications/build/getExpoPushTokenAsync");
  return getToken({ projectId });
}
