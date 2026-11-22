import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import {
  getKnownActivePickup,
  getKnownSharedRide,
  loadActivePickup,
  loadMySharedRide,
  type PickupRequest,
  type SharedRide,
} from "@/api/v1/pickups/controllers";
import {
  activeRentalOf,
  loadMyRentals,
  type Rental,
} from "@/api/v1/rentals/controllers";
import { usePolling } from "@/hooks/use-polling";

export type PickupStatus =
  | { kind: "own"; request: PickupRequest }
  | { kind: "shared"; ride: SharedRide }
  | { kind: "rental"; rental: Rental }
  | null;

const refreshMs = 10_000;

function current(
  request: PickupRequest | null,
  ride: SharedRide | null,
  rental: Rental | null = null,
): PickupStatus {
  if (request) return { kind: "own", request };
  if (ride) return { kind: "shared", ride };
  if (rental) return { kind: "rental", rental };
  return null;
}

export function usePickupStatus(): {
  status: PickupStatus;
  refresh: () => Promise<void>;
} {
  const [status, setStatus] = useState<PickupStatus>(() =>
    current(getKnownActivePickup(), getKnownSharedRide()),
  );

  const refresh = useCallback(async () => {
    const [request, ride, rentals] = await Promise.all([
      loadActivePickup(),
      loadMySharedRide(),
      loadMyRentals(),
    ]);
    setStatus((previous) => {
      const ownRequest = request.ok
        ? request.data
        : previous?.kind === "own"
          ? previous.request
          : null;
      const sharedRide = ride.ok
        ? ride.data
        : previous?.kind === "shared"
          ? previous.ride
          : null;
      const rental = rentals.ok
        ? activeRentalOf(rentals.data)
        : previous?.kind === "rental"
          ? previous.rental
          : null;
      return current(ownRequest, sharedRide, rental);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  usePolling(refresh, refreshMs);

  return { status, refresh };
}
