import { router, usePathname } from "expo-router";
import CircleCheckBig from "lucide-react-native/icons/circle-check-big";
import { useState } from "react";

import { markNotificationsRead } from "@/api/v1/notifications/controllers";
import { ConfirmModal } from "@/components/confirm-modal";
import { Routes } from "@/constants/routes";
import { useNotifications } from "@/hooks/use-notifications";
import { useNow } from "@/hooks/use-now";

const boardedTypes = new Set(["pickup_boarded", "shared_pickup_boarded"]);
const recentMs = 30 * 60_000;

export function BoardedModal() {
  const pathname = usePathname();
  const { notifications } = useNotifications();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const now = useNow(60_000);

  const boarded = notifications.find(
    (item) =>
      boardedTypes.has(item.type) &&
      !item.read &&
      !dismissed.includes(item.id) &&
      now - item.createdAt.getTime() < recentMs &&
      pathname !== Routes.commuterPickup,
  );
  if (!boarded) return null;

  const close = (followRide: boolean) => {
    setDismissed((current) => [...current, boarded.id]);
    void markNotificationsRead([boarded.id]);
    if (followRide) router.push(Routes.commuterPickup);
  };

  return (
    <ConfirmModal
      visible
      title="You're on board!"
      message={boarded.body}
      confirmLabel="Follow ride"
      cancelLabel="Got it"
      icon={<CircleCheckBig color="#ffffff" size={22} strokeWidth={2.2} />}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );
}
