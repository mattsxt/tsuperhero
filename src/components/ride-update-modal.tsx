import { router } from "expo-router";
import CarFront from "lucide-react-native/icons/car-front";
import UserRoundX from "lucide-react-native/icons/user-round-x";
import XCircle from "lucide-react-native/icons/circle-x";
import { useState, type ReactNode } from "react";

import {
  markNotificationsRead,
  type AppNotification,
} from "@/api/v1/notifications/controllers";
import { ConfirmModal } from "@/components/confirm-modal";
import { Routes, type AppRoute } from "@/constants/routes";
import { useNotifications } from "@/hooks/use-notifications";
import { useNow } from "@/hooks/use-now";

type RideUpdate = {
  icon: ReactNode;
  note?: string;
  openLabel: string;
  openRoute: AppRoute;
};

const iconProps = { color: "#ffffff", size: 22, strokeWidth: 2.2 } as const;

const rideUpdates: Record<string, RideUpdate> = {
  pickup_shared_cancelled: {
    icon: <XCircle {...iconProps} />,
    openLabel: "Go to pickup",
    openRoute: Routes.commuterPickup,
  },
  share_ride_left: {
    icon: <UserRoundX {...iconProps} />,
    note: "Your pickup continues with everyone else.",
    openLabel: "Go to pickup",
    openRoute: Routes.commuterPickup,
  },
  rental_driver_removed: {
    icon: <UserRoundX {...iconProps} />,
    openLabel: "Open job board",
    openRoute: Routes.transitRentalRequests,
  },
  rental_driver_left: {
    icon: <CarFront {...iconProps} />,
    openLabel: "View rental",
    openRoute: Routes.commuterRental,
  },
};
const recentMs = 30 * 60_000;

export function RideUpdateModal() {
  const { notifications } = useNotifications();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const now = useNow(60_000);

  const update: AppNotification | undefined = notifications.find(
    (item) =>
      item.type in rideUpdates &&
      !item.read &&
      !dismissed.includes(item.id) &&
      now - item.createdAt.getTime() < recentMs,
  );
  if (!update) return null;
  const config = rideUpdates[update.type];

  const close = (open: boolean) => {
    setDismissed((current) => [...current, update.id]);
    void markNotificationsRead([update.id]);
    if (open) router.push(config.openRoute);
  };

  return (
    <ConfirmModal
      visible
      title={update.title}
      message={config.note ? `${update.body} ${config.note}` : update.body}
      confirmLabel="Got it"
      cancelLabel={config.openLabel}
      icon={config.icon}
      onConfirm={() => close(false)}
      onCancel={() => close(true)}
    />
  );
}
