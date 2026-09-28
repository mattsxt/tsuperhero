import { useSyncExternalStore } from "react";

import {
  getSampleNotifications,
  type AppNotification,
} from "@/api/v1/notifications/controllers";

// Shared across screens so the bottom nav badge and the notifications page
// stay in sync. Replace the sample data once notifications live in Supabase.
let notifications: AppNotification[] = getSampleNotifications();
const listeners = new Set<() => void>();

function setNotifications(
  update: (current: AppNotification[]) => AppNotification[],
) {
  notifications = update(notifications);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => notifications;

export function markNotificationRead(id: string) {
  setNotifications((current) =>
    current.map((item) => (item.id === id ? { ...item, read: true } : item)),
  );
}

export function markAllNotificationsRead() {
  setNotifications((current) =>
    current.map((item) => ({ ...item, read: true })),
  );
}

export function useNotifications() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useUnreadNotificationCount() {
  return useNotifications().filter((item) => !item.read).length;
}
