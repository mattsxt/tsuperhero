import { AppState } from "react-native";

import {
  notificationRoutes,
  type NotificationRow,
} from "@/api/v1/notifications/routes";
import { unwrapCached } from "@/api/v1/cache";
import { attempt, success, unwrap, type Result } from "@/api/v1/result";
import { Routes, type AppRoute } from "@/constants/routes";
import { isOnline, subscribeToOnline } from "@/hooks/use-online";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  createdAt: Date;
  read: boolean;
};

const targets: Record<string, AppRoute> = {
  pickup_accepted: Routes.commuterPickup,
  pickup_boarded: Routes.commuterPickup,
  pickup_released: Routes.commuterPickup,
  pickup_rejected: Routes.commuterPickup,
  pickup_shared: Routes.commuterHome,
  pickup_shared_cancelled: Routes.commuterHome,
  share_ride_accepted: Routes.commuterPickup,
  share_ride_declined: Routes.commuterPickup,
  shared_pickup_accepted: Routes.commuterHome,
  shared_pickup_released: Routes.commuterHome,
  shared_pickup_boarded: Routes.commuterBookings,
  pickup_nearby: Routes.transitStartTrip,
  location_sharing: Routes.transitStartTrip,
  trip_completed: Routes.commuterBookings,
  rate_trip: Routes.commuterBookings,
  rating_received: Routes.transitHome,
  rental_accepted: Routes.commuterRental,
  rental_declined: Routes.commuterRental,
  rental_request: Routes.transitRentalRequests,
  rental_cancelled: Routes.transitRentalRequests,
  rental_completed: Routes.commuterBookings,
};

export function notificationTarget(type: unknown): AppRoute | null {
  return typeof type === "string" ? (targets[type] ?? null) : null;
}

const toNotification = (row: NotificationRow): AppNotification => ({
  id: row.notification_id,
  type: row.notification_type,
  title: row.title,
  body: row.body,
  data: row.data ?? {},
  createdAt: new Date(row.created_at),
  read: row.read_at !== null,
});

const byNewest = (a: AppNotification, b: AppNotification) =>
  b.createdAt.getTime() - a.createdAt.getTime();

let notifications: AppNotification[] = [];
const listeners = new Set<() => void>();

function setNotifications(next: AppNotification[]) {
  notifications = next;
  listeners.forEach((listener) => listener());
}

export const getNotifications = () => notifications;

export function subscribeToNotifications(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function upsertNotification(item: AppNotification) {
  const index = notifications.findIndex((current) => current.id === item.id);
  if (index === -1) {
    setNotifications([item, ...notifications].sort(byNewest));
    return;
  }
  const next = notifications.slice();
  next[index] = item;
  setNotifications(next);
}

export async function refreshNotifications(): Promise<
  Result<AppNotification[]>
> {
  const result = await attempt(async () => {
    const rows: NotificationRow[] =
      (await unwrapCached("notifications", notificationRoutes.list())) ?? [];
    return rows.map(toNotification);
  });
  if (result.ok) setNotifications(result.data);
  return result;
}

export function clearNotifications() {
  setNotifications([]);
}

export function startNotificationSync({
  userId,
  onReceived,
  onRead,
}: {
  userId: string;
  onReceived: (item: AppNotification) => void;
  onRead: (ids: string[]) => void;
}) {
  const stopRealtime = notificationRoutes.subscribe(userId, (payload) => {
    if (payload.eventType === "INSERT") {
      const item = toNotification(payload.new);
      const isNew = !notifications.some((current) => current.id === item.id);
      upsertNotification(item);
      if (isNew && !item.read) onReceived(item);
    } else if (payload.eventType === "UPDATE") {
      const item = toNotification(payload.new);
      const before = notifications.find((current) => current.id === item.id);
      upsertNotification(item);
      if (item.read && before && !before.read) onRead([item.id]);
    }
  });
  refreshNotifications();
  const appState = AppState.addEventListener("change", (state) => {
    if (state === "active") refreshNotifications();
  });
  const stopOnline = subscribeToOnline(() => {
    if (isOnline()) refreshNotifications();
  });
  return () => {
    stopRealtime();
    appState.remove();
    stopOnline();
  };
}

export async function markNotificationsRead(
  ids: string[],
): Promise<Result<unknown>> {
  const unread = ids.filter((id) =>
    notifications.some((item) => item.id === id && !item.read),
  );
  if (unread.length === 0) return success(null);
  setNotifications(
    notifications.map((item) =>
      unread.includes(item.id) ? { ...item, read: true } : item,
    ),
  );
  return attempt(() =>
    unwrap(notificationRoutes.markRead(unread, new Date().toISOString())),
  );
}

export async function markAllNotificationsRead(): Promise<Result<string[]>> {
  const unread = notifications
    .filter((item) => !item.read)
    .map((item) => item.id);
  if (unread.length === 0) return success([]);
  setNotifications(notifications.map((item) => ({ ...item, read: true })));
  const result = await attempt(() =>
    unwrap(notificationRoutes.markAllRead(new Date().toISOString())),
  );
  return result.ok ? success(unread) : result;
}

let registeredPushToken: string | null = null;

export async function savePushToken(token: string, platform: string) {
  const result = await attempt(() =>
    unwrap(notificationRoutes.registerPushToken(token, platform)),
  );
  if (result.ok) registeredPushToken = token;
  return result.ok;
}

export async function forgetPushToken() {
  const token = registeredPushToken;
  registeredPushToken = null;
  if (!token) return;
  await attempt(() => unwrap(notificationRoutes.unregisterPushToken(token)));
}
