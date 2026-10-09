import Mapbox, {
  Camera,
  LineLayer,
  MapView,
  MarkerView,
  ShapeSource,
} from "@rnmapbox/maps";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";

import type { TransitMapProps } from "@/components/transit-map-types";
import { mapStyleUrl, mapboxToken } from "@/constants/mapbox";
import { vehicleIconUris } from "@/constants/vehicle-icon-uris";

export type { MapCenter, TransitMapState } from "@/components/transit-map-types";

Mapbox.setAccessToken(mapboxToken ?? null);

type Position = [number, number];
type LatLngPair = [number, number];

const brandBlue = "#193caf";
const routeYellow = "#f6c945";
const pinRed = "#c81e1e";
const defaultCenter: Position = [123.1948, 13.6218];
const glideMs = 900;

// Fixed marker boxes keep the anchor on the icon while labels show below it.
const vehicleBox = { width: 110, height: 52, pin: 31 };
const waitingBox = { width: 200, height: 80, icon: 22 };

const TERMINAL_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>';
const WAITING_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M12 8v7M9 22l3-7 3 7M8 12h8"/></svg>';
const MAP_PIN_SVG =
  '<svg width="32" height="32" viewBox="0 0 24 24" fill="#c81e1e" stroke="#c81e1e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3" fill="#ffffff" stroke="none"/></svg>';
const COUNTED_PIN_SVG =
  '<svg width="38" height="38" viewBox="0 0 24 24" fill="#c81e1e" stroke="#c81e1e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="5.2" fill="#ffffff" stroke="none"/></svg>';

const vehicleIconXml: Record<string, string> = Object.fromEntries(
  Object.entries(vehicleIconUris).map(([type, uri]) => [
    type,
    atob(uri.slice(uri.indexOf(",") + 1)),
  ]),
);

// App points are [lat, lng]; Mapbox wants [lng, lat].
const toPosition = ([lat, lng]: LatLngPair): Position => [lng, lat];

function lineCollection(paths: Position[][]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: paths.map((coordinates) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates },
    })),
  };
}

function boundsOf(points: Position[]) {
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return {
    ne: [Math.max(...lngs), Math.max(...lats)] as Position,
    sw: [Math.min(...lngs), Math.min(...lats)] as Position,
  };
}

function useGlide(lat: number, lng: number) {
  const [position, setPosition] = useState({ lat, lng });
  const current = useRef(position);

  useEffect(() => {
    const from = current.current;
    if (from.lat === lat && from.lng === lng) return;
    let start: number | null = null;
    let frame = 0;
    const step = (time: number) => {
      if (start === null) start = time;
      const t = Math.min((time - start) / glideMs, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const next = {
        lat: from.lat + (lat - from.lat) * eased,
        lng: from.lng + (lng - from.lng) * eased,
      };
      current.current = next;
      setPosition(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [lat, lng]);

  return position;
}

function VehicleMarker({
  vehicle,
  dimmed,
  onPress,
}: {
  vehicle: TransitMapProps["state"]["vehicles"][number];
  dimmed: boolean;
  onPress?: (id: string) => void;
}) {
  const { lat, lng } = useGlide(vehicle.lat, vehicle.lng);
  const icon = vehicleIconXml[vehicle.type];
  return (
    <MarkerView
      coordinate={[lng, lat]}
      anchor={{ x: 0.5, y: vehicleBox.pin / vehicleBox.height }}
      allowOverlap
    >
      <View
        style={[styles.vehicleBox, dimmed && styles.dimmed]}
        pointerEvents="box-none"
      >
        <Pressable
          accessibilityLabel={vehicle.label ?? "Vehicle"}
          onPress={() => onPress?.(vehicle.id)}
          hitSlop={8}
          style={styles.pinArea}
        >
          <View style={styles.pin}>
            {icon ? (
              <View style={styles.pinIcon}>
                <SvgXml xml={icon} width={14} height={14} />
              </View>
            ) : null}
          </View>
        </Pressable>
        {vehicle.label ? (
          <View style={[styles.badge, vehicle.muted && styles.badgeMuted]}>
            <Text
              style={[styles.badgeText, vehicle.muted && styles.badgeTextMuted]}
              numberOfLines={1}
            >
              {vehicle.label}
            </Text>
          </View>
        ) : null}
      </View>
    </MarkerView>
  );
}

function WaitingAreaMarker({
  area,
  open,
  dimmed,
  onToggle,
}: {
  area: NonNullable<TransitMapProps["state"]["waitingAreas"]>[number];
  open: boolean;
  dimmed: boolean;
  onToggle: () => void;
}) {
  const terminal = area.kind === "terminal";
  return (
    <MarkerView
      coordinate={[area.lng, area.lat]}
      anchor={{ x: 0.5, y: waitingBox.icon / waitingBox.height }}
      allowOverlap
    >
      <View
        style={[styles.waitingBox, dimmed && styles.dimmed]}
        pointerEvents="box-none"
      >
        <Pressable
          accessibilityLabel={area.name}
          onPress={onToggle}
          hitSlop={10}
          style={[
            styles.waitingIcon,
            terminal && styles.terminalIcon,
            open && styles.waitingIconOpen,
          ]}
        >
          <SvgXml
            xml={terminal ? TERMINAL_SVG : WAITING_SVG}
            width={12}
            height={12}
          />
        </Pressable>
        {open ? (
          <View style={styles.waitingLabel}>
            <Text
              style={[styles.waitingName, terminal && styles.terminalName]}
              numberOfLines={1}
            >
              {area.name}
            </Text>
            {area.tag ? <Text style={styles.waitingTag}>{area.tag}</Text> : null}
          </View>
        ) : null}
      </View>
    </MarkerView>
  );
}

function PickupMarker({
  pickup,
}: {
  pickup: NonNullable<TransitMapProps["state"]["pickups"]>[number];
}) {
  const counted = typeof pickup.passengers === "number";
  const size = counted ? 38 : 32;
  return (
    <MarkerView
      coordinate={[pickup.lng, pickup.lat]}
      anchor={{ x: 0.5, y: 1 }}
      allowOverlap
    >
      <View style={{ width: size, height: size }} pointerEvents="none">
        <SvgXml
          xml={counted ? COUNTED_PIN_SVG : MAP_PIN_SVG}
          width={size}
          height={size}
        />
        {counted ? (
          <Text style={styles.pickupCount}>{pickup.passengers}</Text>
        ) : null}
      </View>
    </MarkerView>
  );
}

export function TransitMap({
  state,
  onDrag,
  onCenterChange,
  onVehiclePress,
}: TransitMapProps) {
  const camera = useRef<Camera>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [openWaitingId, setOpenWaitingId] = useState<string | null>(null);
  const gesturing = useRef(false);
  const applied = useRef<{
    route: string | null;
    fit: number | string | null;
    focus: number | string | null;
  }>({ route: null, fit: null, focus: null });

  const route = useMemo(
    () => (state.route ?? []).map(toPosition),
    [state.route],
  );
  const alternatives = useMemo(
    () => (state.alternativeRoutes ?? []).map((path) => path.map(toPosition)),
    [state.alternativeRoutes],
  );
  const routeShape = useMemo(
    () => lineCollection(route.length ? [route] : []),
    [route],
  );
  const alternativeShape = useMemo(
    () => lineCollection(route.length ? alternatives : []),
    [route, alternatives],
  );
  const pickupLineShape = useMemo(
    () =>
      lineCollection(
        state.pickupLine && state.pickupLine.length > 1
          ? [state.pickupLine.map(toPosition)]
          : [],
      ),
    [state.pickupLine],
  );

  // Same camera rules as the web map: refit when the route, fit or focus
  // key changes, in that order.
  useEffect(() => {
    const view = camera.current;
    if (!loaded || !view) return;

    const routeKey = route.length ? `${state.routeId}:${route.length}` : null;
    if (routeKey !== applied.current.route) {
      applied.current.route = routeKey;
      if (routeKey) {
        const { ne, sw } = boundsOf([...route, ...alternatives.flat()]);
        view.fitBounds(ne, sw, [state.padTop, 30, state.padBottom, 30], 0);
      }
    }

    const fit = state.fit;
    if (fit && fit.key !== applied.current.fit && fit.points.length) {
      if (fit.points.length === 1) {
        view.setCamera({
          centerCoordinate: toPosition(fit.points[0]),
          zoomLevel: 17,
          animationDuration: 0,
        });
      } else {
        const { ne, sw } = boundsOf(fit.points.map(toPosition));
        view.fitBounds(ne, sw, [state.padTop, 40, state.padBottom, 40], 0);
      }
    }
    applied.current.fit = fit?.key ?? null;

    const focus = state.focus;
    if (focus && focus.key !== applied.current.focus) {
      view.setCamera({
        centerCoordinate: [focus.lng, focus.lat],
        zoomLevel: focus.zoom,
        animationDuration: 500,
        animationMode: "easeTo",
      });
    }
    applied.current.focus = focus?.key ?? null;
  }, [
    loaded,
    route,
    alternatives,
    state.routeId,
    state.fit,
    state.focus,
    state.padTop,
    state.padBottom,
  ]);

  if (!mapboxToken) {
    return (
      <View style={styles.message}>
        <Text style={styles.messageText}>
          Missing Mapbox token. Set MAPBOX_TOKEN in .env and rebuild the app.
        </Text>
      </View>
    );
  }

  const waitingAreas = state.waitingAreas ?? [];
  const openArea = waitingAreas.find((area) => area.id === openWaitingId);
  const dimmed = !!openArea;

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL={mapStyleUrl}
        rotateEnabled={false}
        pitchEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        onDidFinishLoadingMap={() => {
          setLoaded(true);
          setFailed(false);
        }}
        onMapLoadingError={() => setFailed(true)}
        onPress={() => setOpenWaitingId(null)}
        onCameraChanged={(map) => {
          if (map.gestures.isGestureActive && !gesturing.current) {
            gesturing.current = true;
            onDrag?.();
          }
        }}
        onMapIdle={(map) => {
          gesturing.current = false;
          const [lng, lat] = map.properties.center;
          onCenterChange?.({ lat, lng });
        }}
      >
        <Camera
          ref={camera}
          defaultSettings={{ centerCoordinate: defaultCenter, zoomLevel: 14 }}
        />

        <ShapeSource id="alternative-routes" shape={alternativeShape}>
          <LineLayer
            id="alternative-routes"
            style={{
              lineColor: routeYellow,
              lineWidth: 4,
              lineOpacity: 0.95,
              lineDasharray: [2, 2],
            }}
          />
        </ShapeSource>
        <ShapeSource id="route" shape={routeShape}>
          <LineLayer
            id="route"
            style={{
              lineColor: routeYellow,
              lineWidth: 4,
              lineOpacity: 0.95,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </ShapeSource>
        <ShapeSource id="pickup-line" shape={pickupLineShape}>
          <LineLayer
            id="pickup-line"
            style={{
              lineColor: "#1f2937",
              lineWidth: 3,
              lineOpacity: 0.9,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </ShapeSource>

        {/* Later markers draw on top: vehicles, closed waiting areas,
            pickups, the user's dot, then the open waiting area. */}
        {state.vehicles.map((vehicle) => (
          <VehicleMarker
            key={vehicle.id}
            vehicle={vehicle}
            dimmed={dimmed}
            onPress={onVehiclePress}
          />
        ))}
        {waitingAreas
          .filter((area) => area.id !== openWaitingId)
          .sort((a, b) =>
            a.kind === b.kind ? 0 : a.kind === "terminal" ? 1 : -1,
          )
          .map((area) => (
            <WaitingAreaMarker
              key={area.id}
              area={area}
              open={false}
              dimmed={dimmed}
              onToggle={() => setOpenWaitingId(area.id)}
            />
          ))}
        {(state.pickups ?? []).map((pickup) => (
          <PickupMarker key={pickup.id} pickup={pickup} />
        ))}
        {state.userLocation ? (
          <MarkerView
            coordinate={[state.userLocation.lng, state.userLocation.lat]}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
          >
            <View style={styles.meHalo} pointerEvents="none">
              <View style={styles.meDot} />
            </View>
          </MarkerView>
        ) : null}
        {openArea ? (
          <WaitingAreaMarker
            key={openArea.id}
            area={openArea}
            open
            dimmed={false}
            onToggle={() => setOpenWaitingId(null)}
          />
        ) : null}
      </MapView>

      {failed && !loaded ? (
        <View style={styles.message}>
          <Text style={styles.messageText}>
            The map could not load. Check your connection.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#e8eaed",
  },
  messageText: { fontSize: 13, color: "#6b6b6b", textAlign: "center" },
  dimmed: { opacity: 0.3 },
  vehicleBox: {
    width: vehicleBox.width,
    height: vehicleBox.height,
    alignItems: "center",
  },
  pinArea: {
    height: vehicleBox.pin,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  pin: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#0f2a6b",
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    borderBottomRightRadius: 13,
    borderBottomLeftRadius: 0,
    transform: [{ rotate: "-45deg" }],
    elevation: 3,
  },
  pinIcon: { transform: [{ rotate: "45deg" }] },
  badge: {
    marginTop: -2,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: brandBlue,
    elevation: 2,
  },
  badgeMuted: { backgroundColor: "#ffffff" },
  badgeText: { fontSize: 9, fontWeight: "bold", color: "#ffffff" },
  badgeTextMuted: { color: brandBlue },
  waitingBox: {
    width: waitingBox.width,
    height: waitingBox.height,
    alignItems: "center",
  },
  waitingIcon: {
    width: waitingBox.icon,
    height: waitingBox.icon,
    borderRadius: waitingBox.icon / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e9e45",
    borderWidth: 2,
    borderColor: "#ffffff",
    elevation: 3,
  },
  terminalIcon: { borderRadius: 6, backgroundColor: brandBlue },
  waitingIconOpen: { transform: [{ scale: 1.3 }] },
  waitingLabel: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    alignItems: "center",
    gap: 4,
    elevation: 3,
  },
  waitingName: { fontSize: 11, fontWeight: "bold", color: "#15803d" },
  terminalName: { color: brandBlue },
  waitingTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#e3ecfb",
    color: brandBlue,
    fontSize: 9,
    fontWeight: "bold",
  },
  pickupCount: {
    position: "absolute",
    top: 9,
    left: 0,
    width: "100%",
    fontSize: 13,
    lineHeight: 14,
    fontWeight: "bold",
    color: pinRed,
    textAlign: "center",
  },
  meHalo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(26, 115, 232, 0.2)",
  },
  meDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#1a73e8",
    borderWidth: 3,
    borderColor: "#ffffff",
    elevation: 2,
  },
});
