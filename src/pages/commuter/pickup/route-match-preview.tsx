import Footprints from "lucide-react-native/icons/footprints";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { pickupOnRouteMeters } from "@/api/v1/pickups/controllers";
import {
  loadWalkingRoute,
  type LatLng,
  type PickupRouteMatch,
} from "@/api/v1/transit-routes/controllers";
import { moduleColors } from "@/components/module-ui";
import { TransitMap, type TransitMapState } from "@/components/transit-map";
import { dropoffOnRouteMeters, type Coordinates } from "@/utils/geo";

const { brandBlue, mutedText, text } = moduleColors;

export const dropoffOutsideRouteNote =
  "Your drop-off point is outside the route where jeepneys usually load/unload passengers.";

function formatWalk(meters: number) {
  return meters < 1000
    ? `${Math.max(5, Math.round(meters / 5) * 5)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

const pair = (point: Coordinates): LatLng => [point.lat, point.lng];

/**
 * Walking path between a commuter's pin and its point on the route, following
 * streets when directions load, otherwise a straight line.
 */
function useWalkingLine(from: Coordinates | null, to: Coordinates | null) {
  const key = from && to ? `${from.lat},${from.lng}>${to.lat},${to.lng}` : null;
  const [routed, setRouted] = useState<{ key: string; path: LatLng[] } | null>(
    null,
  );
  useEffect(() => {
    if (!key || !from || !to) return;
    let active = true;
    void loadWalkingRoute(pair(from), pair(to)).then((result) => {
      if (active && result.ok) setRouted({ key, path: result.data.path });
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const routedPath = routed?.key === key ? routed.path : null;
  return useMemo(() => {
    if (!from || !to) return null;
    // Close the small gap between the street path's ends and the exact points.
    return routedPath
      ? [pair(from), ...routedPath, pair(to)]
      : [pair(from), pair(to)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, routedPath]);
}

/**
 * Preview of the chosen route: pickup point A and drop-off point B on the
 * route, the commuter's own pins as small grey markers, and dashed walking
 * lines between each pin and its point. Lists routes to choose from when more
 * than one fits.
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
  const pickupMoved = !!shown && shown.walkMeters > pickupOnRouteMeters;
  const dropoffMoved =
    !!shown && shown.dropoff.distanceMeters > dropoffOnRouteMeters;
  // Before a route is picked, warn when no route passes the drop-off pin.
  const dropoffOffEveryRoute =
    !shown &&
    matches.every((match) => match.dropoff.distanceMeters > dropoffOnRouteMeters);

  const pickupWalk = useWalkingLine(
    pickupMoved ? original : null,
    pickupMoved && shown ? shown.pickup.point : null,
  );
  const dropoffWalk = useWalkingLine(
    dropoffMoved && shown ? shown.dropoff.point : null,
    dropoffMoved ? originalDropoff : null,
  );

  const state = useMemo<TransitMapState | null>(() => {
    if (!shown) return null;
    const a = shown.pickup.point;
    const b = shown.dropoff.point;
    return {
      routeId: shown.routeId,
      route: shown.path,
      vehicles: [],
      focus: null,
      padTop: 36,
      padBottom: 36,
      pickups: [
        ...(pickupMoved
          ? [
              {
                id: "pickup-pin",
                lat: original.lat,
                lng: original.lng,
                label: "Your pin",
                muted: true,
              },
            ]
          : []),
        ...(dropoffMoved
          ? [
              {
                id: "dropoff-pin",
                lat: originalDropoff.lat,
                lng: originalDropoff.lng,
                label: "Your drop-off pin",
                muted: true,
              },
            ]
          : []),
        { id: "pickup-a", lat: a.lat, lng: a.lng, badge: "A", label: "Pickup" },
        { id: "dropoff-b", lat: b.lat, lng: b.lng, badge: "B", label: "Drop-off" },
      ],
      extraLines: [pickupWalk, dropoffWalk].filter(
        (line): line is LatLng[] => !!line,
      ),
      fit: {
        key: `${shown.routeId}:${a.lat}:${a.lng}:${b.lat}:${b.lng}`,
        points: [
          [a.lat, a.lng],
          [b.lat, b.lng],
          ...(pickupMoved ? [pair(original)] : []),
          ...(dropoffMoved ? [pair(originalDropoff)] : []),
        ],
      },
    };
  }, [
    shown,
    pickupMoved,
    dropoffMoved,
    original,
    originalDropoff,
    pickupWalk,
    dropoffWalk,
  ]);

  if (!matches.length) return null;

  return (
    <View style={styles.wrap}>
      {matches.length > 1 && (
        <View style={styles.list}>
          <Text style={styles.listTitle}>CHOOSE THE ROUTE YOU’LL RIDE</Text>
          {matches.map((match) => {
            const checked = selected?.routeId === match.routeId;
            const dropoffAway =
              match.dropoff.distanceMeters > dropoffOnRouteMeters;
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
                <View style={styles.flex}>
                  <Text style={styles.optionLabel}>{match.route.name}</Text>
                  <Text style={styles.optionMeta}>
                    Walk {formatWalk(match.walkMeters)} to pickup
                    {dropoffAway
                      ? ` · Drop-off ${formatWalk(match.dropoff.distanceMeters)} from your pin`
                      : " · Drop-off on your pin"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {shown && state && (
        <View style={styles.map}>
          <TransitMap state={state} controls />
        </View>
      )}

      {pickupMoved && shown && (
        <Notice
          tone="info"
          icon={<Footprints color={brandBlue} size={16} strokeWidth={2.2} />}
          title="Pickup point moved to the route"
          body={`Walk about ${formatWalk(shown.walkMeters)} from your pin to point A, where jeepneys can pick you up.`}
        />
      )}
      {(dropoffMoved || dropoffOffEveryRoute) && (
        <Notice
          tone="warning"
          icon={<TriangleAlert color="#b45309" size={16} strokeWidth={2.2} />}
          title="Drop-off point moved to the route"
          body={`${dropoffOutsideRouteNote} ${
            shown
              ? `You’ll get off at point B, about ${formatWalk(shown.dropoff.distanceMeters)} from your pin.`
              : "You’ll get off at the nearest point on the route you choose."
          }`}
        />
      )}
    </View>
  );
}

function Notice({
  tone,
  icon,
  title,
  body,
}: {
  tone: "info" | "warning";
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={[styles.notice, tone === "warning" ? styles.warning : styles.info]}
    >
      <View style={styles.noticeIcon}>{icon}</View>
      <View style={styles.flex}>
        <Text
          style={[
            styles.noticeTitle,
            { color: tone === "warning" ? "#92400e" : brandBlue },
          ]}
        >
          {title}
        </Text>
        <Text style={styles.noticeBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 10 },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  map: {
    height: 220,
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  notice: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  info: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  warning: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  noticeIcon: { paddingTop: 1 },
  noticeTitle: { fontFamily: "SoraBold", fontSize: 11 },
  noticeBody: {
    marginTop: 3,
    color: text,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
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
    minHeight: 48,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 9,
  },
  optionSelected: { borderColor: brandBlue, backgroundColor: "#eff6ff" },
  optionLabel: { color: text, fontFamily: "SoraBold", fontSize: 11 },
  optionMeta: {
    marginTop: 2,
    color: mutedText,
    fontFamily: "Sora",
    fontSize: 10,
  },
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
});
