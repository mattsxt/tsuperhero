import { router } from "expo-router";
import BriefcaseBusiness from "lucide-react-native/icons/briefcase-business";
import Route from "lucide-react-native/icons/route";

import type { TripRecord } from "@/api/v1/operator/controllers";
import { formatRentalTime, type Rental } from "@/api/v1/rentals/controllers";
import { palette } from "@/constants/colors";
import { Routes } from "@/constants/routes";
import { ActiveStatusCard } from "@/pages/commuter/home/active-pickup-banner";

export function nextRentalJob(jobs: Rental[], now: number): Rental | null {
  return (
    jobs
      .filter(
        (job) =>
          !job.expired &&
          (job.status === "pending" || job.status === "accepted") &&
          (job.returnTime ?? job.pickupTime).getTime() > now - 60 * 60_000,
      )
      .sort((a, b) => a.pickupTime.getTime() - b.pickupTime.getTime())[0] ??
    null
  );
}

export function ActiveWork({
  trip,
  job,
  rentalActive,
}: {
  trip: TripRecord | null;
  job: Rental | null;
  rentalActive: boolean;
}) {
  return (
    <>
      {trip && (
        <ActiveStatusCard
          eyebrow="TRIP IN PROGRESS"
          place={trip.routeName}
          label="On the road"
          tone="matched"
          hint={`${trip.plateNumber ?? "Your vehicle"}${trip.pickups ? ` · ${trip.pickups} ${trip.pickups === 1 ? "pickup" : "pickups"}` : ""} · Tap to go back to your trip.`}
          icon={<Route color={palette.navy} size={22} strokeWidth={2.2} />}
          openLabel="Open trip"
          onPress={() => router.push(Routes.transitStartTrip)}
        />
      )}
      {job && (
        <ActiveStatusCard
          eyebrow={rentalActive ? "RENTAL JOB · ACTIVE NOW" : "NEXT RENTAL JOB"}
          place={job.destination}
          label={rentalActive ? "Active now" : "Booked"}
          tone="matched"
          hint={`Pickup ${formatRentalTime(job.pickupTime)}${job.pickupLocation ? ` · ${job.pickupLocation}` : ""}`}
          passengers={job.passengers}
          icon={
            <BriefcaseBusiness
              color={palette.navy}
              size={22}
              strokeWidth={2.2}
            />
          }
          openLabel="Open rental jobs"
          onPress={() => router.push(Routes.transitRentalRequests)}
        />
      )}
    </>
  );
}
