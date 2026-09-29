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

const ago = (milliseconds: number) => new Date(Date.now() - milliseconds);

export function getSampleNotifications(): AppNotification[] {
  return [
    {
      id: "pickup-1",
      type: "pickup",
      title: "Driver on the way",
      message:
        "Jeepney JPA-1023 accepted your pickup request at Naga City Bus Station. Estimated arrival in 5 minutes.",
      createdAt: ago(3 * minute),
      read: false,
    },
    {
      id: "rental-1",
      type: "rental",
      title: "Rental confirmed",
      message:
        "Your van rental on Jul 5, 2026 from Naga City to Legazpi City was approved by the operator.",
      createdAt: ago(2 * hour),
      read: false,
    },
    {
      id: "routes-1",
      type: "routes",
      title: "Route update",
      message:
        "Heavy traffic reported along Naga Centro – Pili. Expect delays of 10 to 15 minutes.",
      createdAt: ago(day + 4 * hour),
      read: true,
    },
    {
      id: "security-1",
      type: "security",
      title: "Password changed",
      message:
        "Your password was changed successfully. If this wasn't you, change it again right away.",
      createdAt: ago(3 * day),
      read: true,
    },
  ];
}

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
