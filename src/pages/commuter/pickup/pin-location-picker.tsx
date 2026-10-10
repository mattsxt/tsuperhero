import ArrowLeft from "lucide-react-native/icons/arrow-left";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import {
  describePoint,
  getLastKnownPoint,
  type Place,
} from "@/api/v1/places/controllers";
import type { WaitingArea } from "@/api/v1/waiting-areas/controllers";
import {
  findFirstWaitingAreaAlongPath,
  findNearestWaitingArea,
  findWaitingAreasOnRoute,
  type WaitingAreaRecommendation,
} from "@/api/v1/waiting-areas/controllers";
import {
  findNearestRoute,
  loadWalkingRoute,
  type TransitRoute,
} from "@/api/v1/transit-routes/controllers";
import { LoadingLogo } from "@/components/LoadingLogo";
import { moduleColors } from "@/components/module-ui";
import {
  TransitMap,
  type MapCenter,
  type TransitMapState,
} from "@/components/transit-map";
import { waitingAreaPinColors } from "@/constants/waiting-area";
import { getDistanceMeters } from "@/utils/geo";

const { brandBlue, headerBlue, softBlue } = moduleColors;
const pinRed = "#c81e1e";
const pinSize = 32;
const pickZoom = 17;
const defaultCenter: MapCenter = { lat: 13.6218, lng: 123.1948 };

export function PinLocationPicker({
  initial,
  waitingAreas,
  routes,
  onPick,
  onClose,
}: {
  initial: MapCenter | null;
  waitingAreas: WaitingArea[];
  routes: TransitRoute[];
  onPick: (place: Place, preferredWaitingAreaId?: string | null) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [start, setStart] = useState<MapCenter | null>(initial);
  const [center, setCenter] = useState<MapCenter | null>(initial);
  const [saving, setSaving] = useState(false);
  const [checkingRoute, setCheckingRoute] = useState(false);
  const [walkingPath, setWalkingPath] = useState<[number, number][]>([]);
  const [routedRecommendation, setRoutedRecommendation] = useState<{
    key: string;
    area: WaitingAreaRecommendation;
  } | null>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    if (initial) return;
    let active = true;
    getLastKnownPoint().then((point) => {
      if (!active) return;
      const location = point ?? defaultCenter;
      setStart(location);
      setCenter(location);
    });
    return () => {
      active = false;
    };
  }, [initial]);

  const pickupCenter = useMemo(() => center ?? start, [center, start]);
  const nearestRoute = useMemo(() => {
    if (!pickupCenter) return null;
    return findNearestRoute(pickupCenter, routes);
  }, [pickupCenter, routes]);
  const routePaths = useMemo(
    () =>
      nearestRoute
        ? [
            nearestRoute.route.waypoints,
            ...nearestRoute.route.alternativePaths,
          ].filter((path) => path.length > 0)
        : [],
    [nearestRoute],
  );
  const routeAreas = useMemo(
    () =>
      nearestRoute
        ? findWaitingAreasOnRoute(
            waitingAreas,
            nearestRoute.route.id,
            routePaths,
            nearestRoute.route.vicinity,
          )
        : [],
    [nearestRoute, routePaths, waitingAreas],
  );
  const baseRecommendation = useMemo<WaitingAreaRecommendation | null>(() => {
    if (!nearestRoute || !pickupCenter) return null;
    return findNearestWaitingArea(
      pickupCenter,
      routeAreas,
      nearestRoute.route.id,
      routePaths,
      nearestRoute.route.vicinity,
    );
  }, [nearestRoute, pickupCenter, routeAreas, routePaths]);
  const recommendationKey = baseRecommendation && pickupCenter
    ? `${baseRecommendation.id}:${pickupCenter.lat}:${pickupCenter.lng}`
    : "";
  const recommendedArea =
    routedRecommendation?.key === recommendationKey
      ? routedRecommendation.area
      : baseRecommendation;
  const redirectedToRouteArea =
    !!recommendedArea && recommendedArea.id !== baseRecommendation?.id;

  useEffect(() => {
    if (
      !pickupCenter ||
      !baseRecommendation ||
      getDistanceMeters(pickupCenter, baseRecommendation) >= 200
    ) {
      setCheckingRoute(false);
      setRoutedRecommendation(null);
      setWalkingPath([]);
      return;
    }
    let active = true;
    setCheckingRoute(true);
    const origin: [number, number] = [pickupCenter.lat, pickupCenter.lng];
    const directDestination: [number, number] = [
      baseRecommendation.lat,
      baseRecommendation.lng,
    ];
    const key = `${baseRecommendation.id}:${pickupCenter.lat}:${pickupCenter.lng}`;
    setWalkingPath([origin, directDestination]);
    const timer = setTimeout(() => {
      void loadWalkingRoute(origin, directDestination).then((result) => {
        if (!active) return;
        if (!result.ok) {
          setRoutedRecommendation(null);
          setCheckingRoute(false);
          return;
        }

        const firstArea = findFirstWaitingAreaAlongPath(
          result.data.path,
          routeAreas,
          baseRecommendation.id,
        );
        const destinationArea = firstArea ?? baseRecommendation;
        const recommendation = {
          ...destinationArea,
          distanceMeters: getDistanceMeters(pickupCenter, destinationArea),
        };
        setRoutedRecommendation({ key, area: recommendation });

        if (destinationArea.id === baseRecommendation.id) {
          setWalkingPath(result.data.path);
          setCheckingRoute(false);
          return;
        }

        const priorityDestination: [number, number] = [
          destinationArea.lat,
          destinationArea.lng,
        ];
        void loadWalkingRoute(origin, priorityDestination).then(
          (priorityResult) => {
            if (!active) return;
            setWalkingPath(
              priorityResult.ok ? priorityResult.data.path : result.data.path,
            );
            setCheckingRoute(false);
          },
        );
      });
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [baseRecommendation, pickupCenter, routeAreas]);

  const mapFocus = useMemo(() => {
    if (!pickupCenter) return null;
    if (!recommendedArea) {
      return {
        key: `pin-start-${pickupCenter.lat}-${pickupCenter.lng}`,
        lat: pickupCenter.lat,
        lng: pickupCenter.lng,
        zoom: pickZoom,
      };
    }
    const zoom =
      recommendedArea.distanceMeters < 300
        ? 16.5
        : recommendedArea.distanceMeters < 800
          ? 15.5
          : recommendedArea.distanceMeters < 1_500
            ? 14.5
            : recommendedArea.distanceMeters < 3_000
              ? 13.5
              : 12;
    return {
      key: `waiting-${recommendedArea.id}-${pickupCenter.lat}-${pickupCenter.lng}`,
      lat: pickupCenter.lat,
      lng: pickupCenter.lng,
      zoom,
    };
  }, [pickupCenter, recommendedArea]);

  const mapState = useMemo<TransitMapState>(
    () => ({
      routeId: null,
      route: null,
      waitingAreas: waitingAreas.map(
        ({ id, name, lat, lng, vicinity, type }) => ({
          id,
          name,
          lat,
          lng,
          tag: vicinity,
          kind: type,
        }),
      ),
      showStops: true,
      vehicles: [],
      pickupLine: walkingPath,
      pickupLineColor: recommendedArea
        ? waitingAreaPinColors[recommendedArea.type]
        : waitingAreaPinColors.stop,
      focus: mapFocus,
      padTop: 0,
      padBottom: 0,
    }),
    [waitingAreas, walkingPath, mapFocus],
  );

  const confirm = async () => {
    if (!center || saving) return;
    setSaving(true);
    const place = await describePoint(center.lat, center.lng);
    setSaving(false);
    onPick(place, recommendedArea?.id ?? null);
  };

  return (
    <Modal
      visible
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.screen}>
        <TransitMap
          state={mapState}
          onDrag={() => {
            isDragging.current = true;
          }}
          onCenterChange={(next) => {
            if (!isDragging.current) return;
            isDragging.current = false;
            setCenter(next);
          }}
        />

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
          {recommendedArea && (
            <Text style={styles.routeNote}>
              {checkingRoute
                ? "Checking your route for a waiting area along the way…"
                : redirectedToRouteArea
                  ? `Your walking route reaches ${recommendedArea.name} first. You’ll be directed there.`
                  : `You’re being routed to the nearest recommended waiting area: ${recommendedArea.name}.`}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use this pickup location"
            disabled={!center || saving || checkingRoute}
            onPress={confirm}
            style={({ pressed }) => [
              styles.confirm,
              (pressed || !center || saving || checkingRoute) && styles.pressed,
            ]}
          >
            {saving || checkingRoute ? (
              <LoadingLogo color="#ffffff" size={22} />
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
  routeNote: {
    color: brandBlue,
    fontFamily: "Sora",
    fontSize: 11,
    lineHeight: 16,
    padding: 10,
    borderRadius: 10,
    backgroundColor: softBlue,
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
