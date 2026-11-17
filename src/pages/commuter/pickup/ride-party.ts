import { useEffect, useRef } from "react";

import { shareRideLocation, type Rider } from "@/api/v1/pickups/controllers";
import type { TransitMapState } from "@/components/transit-map-types";
import { palette } from "@/constants/colors";
import { getDistanceMeters, type Coordinates } from "@/utils/geo";

const shareEveryMs = 5_000;
const shareMovedMeters = 15;
const keepAliveMs = 30_000;
const notArrivedColor = "#d97706";

export function useShareRideLocation(
  requestId: string,
  me: Coordinates | null,
  enabled: boolean,
) {
  const latest = useRef<Coordinates | null>(null);
  const lastSent = useRef<(Coordinates & { at: number }) | null>(null);

  useEffect(() => {
    latest.current = me;
    if (!enabled || !me) return;
    const previous = lastSent.current;
    if (
      previous &&
      Date.now() - previous.at < shareEveryMs &&
      getDistanceMeters(previous, me) < shareMovedMeters
    )
      return;
    lastSent.current = { ...me, at: Date.now() };
    void shareRideLocation(requestId, me);
  }, [requestId, me, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      const here = latest.current;
      if (!here) return;
      lastSent.current = { ...here, at: Date.now() };
      void shareRideLocation(requestId, here);
    }, keepAliveMs);
    return () => clearInterval(timer);
  }, [requestId, enabled]);
}

export function partyPins(
  riders: Rider[],
): NonNullable<TransitMapState["pickups"]> {
  return riders.flatMap((rider) => {
    if (!rider.location || (rider.inviteStatus && rider.inviteStatus !== "accepted"))
      return [];
    const firstName = rider.name.split(" ")[0];
    return [
      {
        id: `rider-${rider.userId}`,
        lat: rider.location.lat,
        lng: rider.location.lng,
        badge: rider.initials,
        label: `${firstName} · ${rider.arrived ? "here" : "on the way"}`,
        color: rider.arrived ? palette.success : notArrivedColor,
      },
    ];
  });
}
