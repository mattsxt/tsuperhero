import ArrowLeft from "lucide-react-native/icons/arrow-left";
import PersonStanding from "lucide-react-native/icons/person-standing";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import {
  describePoint,
  getLastKnownPoint,
  type Place,
} from "@/api/v1/places/controllers";
import {
  formatDistance,
  recommendWaitingArea,
  type WaitingArea,
} from "@/api/v1/waiting-areas/controllers";
import { LoadingSprite } from "@/components/brand-logo";
import { moduleColors } from "@/components/module-ui";
import {
  TransitMap,
  type MapCenter,
  type TransitMapState,
} from "@/components/transit-map";

const { brandBlue, headerBlue, mutedText, softBlue, text } = moduleColors;
const pinRed = "#c81e1e";
const pinSize = 32;
const pickZoom = 17;
const defaultCenter: MapCenter = { lat: 13.6218, lng: 123.1948 };

export function PinLocationPicker({
  initial,
  stops,
  onPick,
  onClose,
}: {
  initial: MapCenter | null;
  stops: WaitingArea[];
  onPick: (place: Place) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [start, setStart] = useState<MapCenter | null>(initial);
  const [center, setCenter] = useState<MapCenter | null>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) return;
    let active = true;
    getLastKnownPoint().then((point) => {
      if (!active) return;
      setStart(point ?? defaultCenter);
    });
    return () => {
      active = false;
    };
  }, [initial]);

  const nearest = useMemo(
    () => (center ? recommendWaitingArea(center, stops) : null),
    [center, stops],
  );

  const mapState = useMemo<TransitMapState>(
    () => ({
      routeId: null,
      route: null,
      vehicles: [],
      waitingAreas: stops.map(({ id, name, lat, lng }) => ({
        id,
        name,
        lat,
        lng,
        kind: "stop" as const,
      })),
      pickupLine:
        center && nearest
          ? [
              [center.lat, center.lng],
              [nearest.lat, nearest.lng],
            ]
          : null,
      focus: start
        ? { key: "pin-start", lat: start.lat, lng: start.lng, zoom: pickZoom }
        : null,
      padTop: 0,
      padBottom: 0,
    }),
    [stops, center, nearest, start],
  );

  const confirm = async () => {
    if (!center || saving) return;
    setSaving(true);
    const place = await describePoint(center.lat, center.lng);
    setSaving(false);
    onPick(place);
  };

  return (
    <Modal
      visible
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.screen}>
        <TransitMap state={mapState} onCenterChange={setCenter} />

        <View pointerEvents="none" style={styles.pinLayer}>
          <View style={styles.pin}>
            <CenterPin />
          </View>
          <View style={styles.pinShadow} />
        </View>

        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close map"
            hitSlop={10}
            onPress={onClose}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <ArrowLeft color="#ffffff" size={22} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.title}>Pin your pickup location</Text>
            <Text style={styles.subtitle}>
              Drag the map to place the pin where you want to be picked up.
            </Text>
          </View>
        </View>

        <View style={[styles.card, { paddingBottom: insets.bottom + 16 }]}>
          {nearest ? (
            <View style={styles.preview}>
              <View style={styles.previewIcon}>
                <PersonStanding color="#ffffff" size={18} strokeWidth={2} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.previewLabel}>NEAREST PICKUP POINT</Text>
                <Text style={styles.previewName} numberOfLines={1}>
                  {nearest.name}
                </Text>
                <Text style={styles.previewMeta}>
                  {formatDistance(nearest.distanceMeters)} from your pin · about{" "}
                  {nearest.walkMinutes} min walk
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.previewWarning}>
              No waiting area within walking distance of this spot. Move the pin
              closer to a route.
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use this pickup location"
            disabled={!center || saving}
            onPress={confirm}
            style={({ pressed }) => [
              styles.confirm,
              (pressed || !center || saving) && styles.pressed,
            ]}
          >
            {saving ? (
              <LoadingSprite color="#ffffff" size={22} />
            ) : (
              <Text style={styles.confirmText}>USE THIS LOCATION</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function CenterPin() {
  return (
    <Svg width={pinSize * (16 / 20)} height={pinSize} viewBox="4 2 16 20">
      <Path
        d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0ZM12 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z"
        fill={pinRed}
        fillRule="evenodd"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#e8eaed" },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  pinLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  pin: { marginBottom: pinSize },
  pinShadow: {
    position: "absolute",
    width: 10,
    height: 4,
    borderRadius: 5,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    backgroundColor: headerBlue,
  },
  back: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  title: { color: "#ffffff", fontFamily: "SoraBold", fontSize: 16 },
  subtitle: {
    color: "#ffffff",
    fontFamily: "Sora",
    fontSize: 10,
    marginTop: 2,
  },
  card: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 14,
    paddingTop: 18,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#ffffff",
    elevation: 8,
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: softBlue,
  },
  previewIcon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "#1e9e45",
  },
  previewLabel: { color: mutedText, fontFamily: "SoraBold", fontSize: 8 },
  previewName: {
    color: brandBlue,
    fontFamily: "SoraBold",
    fontSize: 14,
    marginTop: 2,
  },
  previewMeta: {
    color: text,
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },
  previewWarning: {
    color: "#b91c1c",
    fontFamily: "Sora",
    fontSize: 10,
    lineHeight: 15,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#fee2e2",
  },
  confirm: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: brandBlue,
  },
  confirmText: {
    color: "#ffffff",
    fontFamily: "SoraBold",
    fontSize: 14,
    letterSpacing: 1,
  },
});
