import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PickupRouteMatch } from "@/api/v1/transit-routes/controllers";
import { moduleColors } from "@/components/module-ui";
import { TransitMap, type TransitMapState } from "@/components/transit-map";
import { pickupOnRouteMeters } from "@/api/v1/pickups/controllers";
import type { Coordinates } from "@/utils/geo";

const { brandBlue, mutedText, text } = moduleColors;

export const routeMovedNote =
  "Your pickup point was moved to the route so drivers can reach you.";
export const dropoffOutsideRouteNote =
  "Your drop-off point is outside the route where jeepneys usually load/unload passengers.";

function formatWalk(meters: number) {
  return meters < 1000
    ? `${Math.max(5, Math.round(meters / 5) * 5)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Small map of the matched route: the commuter's original pickup and drop-off
 * pins, and pickup point A / drop-off point B moved onto the route (with lines
 * from each pin to its point).
 * Lists the routes to choose from when more than one fits.
 */
export function RouteMatchPreview({
  original,
  originalDropoff,
  matches,
  selected,
  onSelect,
}: {
  original: Coordinates;
  originalDropoff: Coordinates;
  matches: PickupRouteMatch[];
  selected: PickupRouteMatch | null;
  onSelect: (routeId: string) => void;
}) {
  // The map appears only once a route is selected (picked, or the only one).
  const shown = selected;
  const moved = !!shown && shown.walkMeters > pickupOnRouteMeters;
  const dropoffMoved =
    !!shown && shown.dropoff.distanceMeters > pickupOnRouteMeters;
  // Before a route is picked, warn when no route passes the drop-off pin.
  const dropoffOutside = shown
    ? dropoffMoved
    : matches.every((match) => match.dropoff.distanceMeters > pickupOnRouteMeters);

  const state = useMemo<TransitMapState | null>(() => {
    if (!shown) return null;
    const a = shown.pickup.point;
    const b = shown.dropoff.point;
    return {
      routeId: shown.routeId,
      route: shown.path,
      vehicles: [],
      focus: null,
      padTop: 24,
      padBottom: 24,
      pickups: [
        { id: "pickup-a", lat: a.lat, lng: a.lng, badge: "A", label: "Pickup" },
        { id: "dropoff-b", lat: b.lat, lng: b.lng, badge: "B", label: "Drop-off" },
        ...(dropoffMoved
          ? [
              {
                id: "dropoff-pin",
                lat: originalDropoff.lat,
                lng: originalDropoff.lng,
                label: "Your drop-off pin",
              },
            ]
          : []),
      ],
      extraLines: dropoffMoved
        ? [
            [
              [originalDropoff.lat, originalDropoff.lng],
              [b.lat, b.lng],
            ],
          ]
        : [],
      pickupLine: moved
        ? [
            [original.lat, original.lng],
            [a.lat, a.lng],
          ]
        : null,
      userLocation: moved ? original : null,
      fit: {
        key: `${shown.routeId}:${a.lat}:${a.lng}:${b.lat}:${b.lng}`,
        points: [
          [original.lat, original.lng],
          [a.lat, a.lng],
          [b.lat, b.lng],
          [originalDropoff.lat, originalDropoff.lng],
        ],
      },
    };
  }, [shown, moved, dropoffMoved, original, originalDropoff]);

  if (!matches.length) return null;

  return (
    <View style={styles.wrap}>
      {shown && state && (
        <View style={styles.map}>
          <TransitMap state={state} controls />
        </View>
      )}
      {shown && moved && (
        <Text style={styles.note}>
          {routeMovedNote} Walk about {formatWalk(shown.walkMeters)} to point A.
        </Text>
      )}
      {dropoffOutside && (
        <Text style={[styles.note, styles.warning]}>
          {dropoffOutsideRouteNote}{" "}
          {shown
            ? `You’ll be dropped off at point B on the route, about ${formatWalk(shown.dropoff.distanceMeters)} from your pin.`
            : "You’ll be dropped off at the nearest point on the route you choose."}
        </Text>
      )}
      {matches.length > 1 && (
        <View style={styles.list}>
          <Text style={styles.listTitle}>CHOOSE THE ROUTE YOU’LL RIDE</Text>
          {matches.map((match) => {
            const checked = selected?.routeId === match.routeId;
            return (
              <Pressable
                key={match.routeId}
                accessibilityRole="radio"
                accessibilityState={{ checked }}
                onPress={() => onSelect(match.routeId)}
                style={({ pressed }) => [
                  styles.option,
                  checked && styles.optionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.radio}>
                  {checked && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.optionLabel}>
                  {match.route.name} · walk {formatWalk(match.walkMeters)} to
                  pickup
                  {match.dropoff.distanceMeters > pickupOnRouteMeters
                    ? ` · drop-off ${formatWalk(match.dropoff.distanceMeters)} from your pin`
                    : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 8 },
  map: {
    height: 200,
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  warning: { color: "#92400e", fontFamily: "SoraBold" },
  note: {
    color: text,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
    marginHorizontal: 4,
  },
  list: {
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
  },
  listTitle: { color: mutedText, fontFamily: "SoraBold", fontSize: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 9,
  },
  optionSelected: { borderColor: brandBlue, backgroundColor: "#eff6ff" },
  optionLabel: { flex: 1, color: text, fontFamily: "SoraBold", fontSize: 10 },
  radio: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    borderWidth: 2,
    borderColor: brandBlue,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: brandBlue,
  },
  pressed: { opacity: 0.8 },
});
