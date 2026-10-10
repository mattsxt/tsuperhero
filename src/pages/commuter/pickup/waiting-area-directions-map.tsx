import { useEffect, useMemo, useRef, useState } from "react";

import { watchLocation } from "@/api/v1/places/controllers";
import {
  loadWalkingRoute,
  type LatLng,
} from "@/api/v1/transit-routes/controllers";
import type { WaitingArea } from "@/api/v1/waiting-areas/controllers";
import { TransitMap, type TransitMapState } from "@/components/transit-map";
import { waitingAreaPinColors } from "@/constants/waiting-area";
import { getDistanceMeters } from "@/utils/geo";

type Coordinates = { lat: number; lng: number };

const rerouteMeters = 35;
const rerouteMs = 20_000;

export const waitingAreaArrivalMeters = 60;

export function WaitingAreaDirectionsMap({
  area,
  onLocationChange,
  onLocationError,
  padTop = 0,
  padBottom = 0,
  showRouting = true,
}: {
  area: WaitingArea;
  onLocationChange?: (location: Coordinates | null) => void;
  onLocationError?: (message: string | null) => void;
  padTop?: number;
  padBottom?: number;
  showRouting?: boolean;
}) {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [fitOrigin, setFitOrigin] = useState<Coordinates | null>(null);
  const [walkingPath, setWalkingPath] = useState<LatLng[]>([]);
  const lastRouted = useRef<{ at: number; from: Coordinates } | null>(null);

  useEffect(() => {
    let active = true;
    let subscription: { remove: () => void } | null = null;
    watchLocation(({ coords }) => {
      const next = { lat: coords.latitude, lng: coords.longitude };
      setLocation(next);
      setFitOrigin((current) => current ?? next);
    }).then((result) => {
      if (result.ok) {
        onLocationError?.(null);
        if (active) subscription = result.data;
        else result.data.remove();
      } else if (active) {
        onLocationError?.(result.error);
      }
    });
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [onLocationChange, onLocationError]);

  useEffect(() => {
    if (!showRouting || !location) {
      setWalkingPath([]);
      return;
    }
    const last = lastRouted.current;
    const due =
      !last ||
      Date.now() - last.at >= rerouteMs ||
      getDistanceMeters(last.from, location) >= rerouteMeters;
    if (!due) return;

    lastRouted.current = { at: Date.now(), from: location };
    const from: LatLng = [location.lat, location.lng];
    const to: LatLng = [area.lat, area.lng];
    setWalkingPath([from, to]);
    let active = true;
    loadWalkingRoute(from, to).then((result) => {
      if (active && result.ok) setWalkingPath(result.data.path);
    });
    return () => {
      active = false;
    };
  }, [location, area.lat, area.lng, showRouting]);

  useEffect(() => {
    onLocationChange?.(location);
  }, [location, onLocationChange]);

  const mapState = useMemo<TransitMapState>(() => {
    const points: LatLng[] = fitOrigin
      ? [
          [fitOrigin.lat, fitOrigin.lng],
          [area.lat, area.lng],
        ]
      : [[area.lat, area.lng]];
    return {
      routeId: null,
      route: null,
      waitingAreas: [
        {
          id: area.id,
          name: area.name,
          lat: area.lat,
          lng: area.lng,
          tag: area.vicinity,
          kind: area.type,
        },
      ],
      showStops: true,
      vehicles: [],
      userLocation: location,
      pickupLine: showRouting ? walkingPath : [],
      pickupLineColor: waitingAreaPinColors[area.type],
      focus: null,
      fit: {
        key: `waiting-area-${area.id}-${fitOrigin ? "user" : "area"}`,
        points,
      },
      padTop,
      padBottom,
    };
  }, [area, fitOrigin, location, walkingPath, padTop, padBottom, showRouting]);

  return <TransitMap state={mapState} />;
}
