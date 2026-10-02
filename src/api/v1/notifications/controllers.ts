import { Routes, type AppRoute } from "@/constants/routes";

export type NotificationType = "pickup" | "rental" | "routes" | "security";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
};

export const notificationTypeLabels: Record<NotificationType, string> = {
  pickup: "PICKUP",
  rental: "RENTAL",
  routes: "ROUTES",
  security: "SECURITY",
};

export const notificationTypeRoutes: Record<NotificationType, AppRoute> = {
  pickup: Routes.commuterPickup,
  rental: Routes.commuterRental,
  routes: Routes.commuterRoutes,
  security: Routes.profileSecurity,
};

const minute = 60 * 1000;
const hour = 60 * minute;
const day = 24 * hour;

export function formatNotificationTime(date: Date, now = new Date()) {
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < minute) return "Just now";
  if (elapsed < hour) return `${Math.floor(elapsed / minute)}m ago`;
  if (elapsed < day) return `${Math.floor(elapsed / hour)}h ago`;
  if (elapsed < 2 * day) return "Yesterday";
  if (elapsed < 7 * day) return `${Math.floor(elapsed / day)}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function isToday(date: Date, now = new Date()) {
  return date.toDateString() === now.toDateString();
}
