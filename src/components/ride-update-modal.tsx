import { router } from "expo-router";
import UserRoundX from "lucide-react-native/icons/user-round-x";
import XCircle from "lucide-react-native/icons/circle-x";
import { useState } from "react";

import { markNotificationsRead } from "@/api/v1/notifications/controllers";
import { ConfirmModal } from "@/components/confirm-modal";
import { Routes } from "@/constants/routes";
import { useNotifications } from "@/hooks/use-notifications";
import { useNow } from "@/hooks/use-now";

/** Ride changes the other person should see right away, wherever they are in the app. */
const rideUpdateTypes = new Set(["pickup_shared_cancelled", "share_ride_left"]);
/** Older ones are left in Notifications rather than popping up late. */
const recentMs = 30 * 60_000;

/**
 * Tells a commuter, with a pop-up, when their shared pickup was cancelled by the commuter
 * who requested it, or when a companion left their ride.
 */
export function RideUpdateModal() {
  const { notifications } = useNotifications();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const now = useNow(60_000);

  const update = notifications.find(
    (item) =>
      rideUpdateTypes.has(item.type) &&
      !item.read &&
      !dismissed.includes(item.id) &&
      now - item.createdAt.getTime() < recentMs,
  );
  if (!update) return null;

  const close = (openPickup: boolean) => {
    setDismissed((current) => [...current, update.id]);
    void markNotificationsRead([update.id]);
    if (openPickup) router.push(Routes.commuterPickup);
  };

  const left = update.type === "share_ride_left";
  return (
    <ConfirmModal
      visible
      title={update.title}
      message={
        left
          ? `${update.body} Your pickup continues with everyone else.`
          : update.body
      }
      confirmLabel="Got it"
      cancelLabel="Go to pickup"
      icon={
        left ? (
          <UserRoundX color="#ffffff" size={22} strokeWidth={2.2} />
        ) : (
          <XCircle color="#ffffff" size={22} strokeWidth={2.2} />
        )
      }
      onConfirm={() => close(false)}
      onCancel={() => close(true)}
    />
  );
}
