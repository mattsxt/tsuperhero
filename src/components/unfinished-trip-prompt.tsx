import { router, usePathname } from "expo-router";
import RouteIcon from "lucide-react-native/icons/route";
import { useEffect, useState } from "react";

import { stopLocationSharing } from "@/api/v1/operator/location-sharing";
import {
  endUnfinishedTrip,
  loadMyTrips,
  type TripRecord,
} from "@/api/v1/operator/controllers";
import { ConfirmModal } from "@/components/confirm-modal";
import { Routes } from "@/constants/routes";

let checkedThisLaunch = false;

const clock = (date: Date) =>
  date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function UnfinishedTripPrompt() {
  const pathname = usePathname();
  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [ending, setEnding] = useState(false);
  const [problem, setProblem] = useState("");
  const onDriverScreen =
    pathname.startsWith("/transit") && pathname !== Routes.transitStartTrip;

  useEffect(() => {
    if (!onDriverScreen || checkedThisLaunch) return;
    checkedThisLaunch = true;
    let active = true;
    loadMyTrips().then((result) => {
      if (active && result.ok)
        setTrip(result.data.find((item) => item.inProgress) ?? null);
    });
    return () => {
      active = false;
    };
  }, [onDriverScreen]);

  if (!trip || !onDriverScreen) return null;

  const resume = () => {
    setTrip(null);
    router.push({
      pathname: Routes.transitStartTrip,
      params: { resume: "1" },
    });
  };

  const end = async () => {
    if (ending) return;
    setEnding(true);
    const outcome = await endUnfinishedTrip();
    setEnding(false);
    if (outcome.status === "failed") {
      setProblem(outcome.error);
      return;
    }
    stopLocationSharing();
    setTrip(null);
  };

  const started = trip.departedAt ? ` from ${clock(trip.departedAt)}` : "";
  return (
    <ConfirmModal
      visible
      title="Unfinished trip"
      message={
        problem ||
        `Your trip on ${trip.routeName}${started} is still running because the app closed. Resume it to keep going with your passengers, or end it to save it to your trip history.`
      }
      confirmLabel="Resume trip"
      cancelLabel={ending ? "Ending..." : "End trip"}
      icon={<RouteIcon color="#ffffff" size={22} strokeWidth={2.2} />}
      onConfirm={resume}
      onCancel={end}
    />
  );
}
