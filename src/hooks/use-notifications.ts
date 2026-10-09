import { useMemo, useSyncExternalStore } from "react";

import {
  getNotifications,
  subscribeToNotifications,
} from "@/api/v1/notifications/controllers";

export function useNotifications() {
  const notifications = useSyncExternalStore(
    subscribeToNotifications,
    getNotifications,
    getNotifications,
  );
  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );
  return { notifications, unreadCount };
}
