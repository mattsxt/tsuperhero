import { createElement, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { occupancyPinColors } from "@/components/transit-map-types";
import { mapboxToken } from "@/constants/mapbox";
import { waitingAreaPinColors } from "@/constants/waiting-area";
import { vehicleIconUris } from "@/constants/vehicle-icon-uris";
import type {
  TransitMapProps,
  TransitMapState,
} from "@/components/transit-map-types";

export type { MapCenter, TransitMapState } from "@/components/transit-map-types";

type FrameRef = {
  contentWindow?: {
    postMessage: (message: string, origin: string) => void;
  } | null;
};

type WindowLike = {
  addEventListener: (
    type: string,
    listener: (event: MessageEventLike) => void,
  ) => void;
  removeEventListener: (
    type: string,
    listener: (event: MessageEventLike) => void,
  ) => void;
};

type MessageEventLike = { data: unknown; source: unknown };

const mapHtml = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link href="https://api.mapbox.com/mapbox-gl-js/v3.31.0/mapbox-gl.css" rel="stylesheet" />
<style>
  html, body, #map { margin: 0; height: 100%; width: 100%; background: #e8eaed; }
  .error {
    height: 100%; display: flex; align-items: center; justify-content: center;
    padding: 24px; box-sizing: border-box; text-align: center;
    font: 13px sans-serif; color: #6b6b6b;
  }
  .pin-wrap { padding-bottom: 5px; cursor: pointer; }
  .pin {
    width: 26px; height: 26px; box-sizing: border-box;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
    background: #ffffff; border: 2px solid #0f2a6b;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
    transition: transform 250ms ease-in-out, border-color 250ms ease-in-out;
  }
  .pin img { width: 14px; height: 14px; transform: rotate(45deg); filter: brightness(0); }
  .pin.selected { border-color: #1e9e45; border-width: 3px; transform: rotate(-45deg) scale(1.2); }
  .pin-wrap, .waiting { transition: opacity 220ms ease-in-out; }
  body.pin-focused .pin-wrap:not(.focused),
  body.pin-focused .waiting:not(.open) { opacity: 0.3; }
  .waiting { cursor: pointer; }
  .waiting-icon {
    width: 22px; height: 22px; box-sizing: border-box; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: var(--waiting-color, #1e9e45); border: 2px solid #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
    transition: transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .waiting-label {
    position: absolute; top: 100%; left: 50%; margin-top: 6px;
    padding: 3px 8px; border-radius: 6px;
    background: #ffffff; color: var(--waiting-label-color, #15803d);
    font: bold 11px sans-serif; white-space: nowrap;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    opacity: 0; pointer-events: none; transform-origin: top center;
    transform: translateX(-50%) scale(0.4);
    transition: transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 150ms ease-out;
  }
  .waiting.open .waiting-icon { transform: scale(1.3); }
  .waiting.open .waiting-label { opacity: 1; transform: translateX(-50%) scale(1); }
  .waiting-label { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .waiting-tag {
    padding: 2px 7px; border-radius: 999px;
    background: #e3ecfb; color: #193caf; font: bold 9px sans-serif;
  }
  .waiting.hub .waiting-icon { border-radius: 6px; }
  .pickup { position: relative; line-height: 0; filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.35)); }
  .me {
    width: 14px; height: 14px; border-radius: 50%;
    background: #1a73e8; border: 3px solid #ffffff;
    box-shadow: 0 0 0 6px rgba(26, 115, 232, 0.2), 0 1px 3px rgba(0, 0, 0, 0.4);
  }
  .pickup-count {
    position: absolute; top: 9px; left: 0; width: 100%;
    font: bold 13px/14px sans-serif; color: #c81e1e; text-align: center;
  }
  .pickup-label {
    position: absolute; top: 100%; left: 50%; margin-top: 3px;
    max-width: 170px; overflow: hidden; padding: 3px 7px;
    border-radius: 6px; background: #ffffff; color: #193caf;
    font: bold 10px/13px sans-serif; text-align: center;
    white-space: nowrap; text-overflow: ellipsis; transform: translateX(-50%);
  }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var ICONS = ${JSON.stringify(vehicleIconUris)};
  var OCCUPANCY_COLORS = ${JSON.stringify(occupancyPinColors)};
  var WAITING_AREA_COLORS = ${JSON.stringify(waitingAreaPinColors)};
  var TOKEN = ${JSON.stringify(mapboxToken ?? "")};
  var TERMINAL_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>';
  var map = null;
  var vehicleMarkers = {};
  var waitingMarkers = [];
  var lastWaitingKey = "";
  var WAITING_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M12 8v7M9 22l3-7 3 7M8 12h8"/></svg>';
  var MAP_PIN_SVG = '<svg width="32" height="32" viewBox="0 0 24 24" fill="#c81e1e" stroke="#c81e1e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3" fill="#ffffff" stroke="none"/></svg>';
  var lastRouteId = null;
  var lastFocusKey = null;
  var pickupMarkers = [];
  var lastPickupKey = "";
  var lastPickupLineKey = "null";
  var lastPickupLineColor = "";
  var reportCenter = false;
  var meMarker = null;
  var lastFitKey = null;
  var COUNTED_PIN_SVG = '<svg width="38" height="38" viewBox="0 0 24 24" fill="#c81e1e" stroke="#c81e1e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="5.2" fill="#ffffff" stroke="none"/></svg>';
  var EMPTY = { type: "FeatureCollection", features: [] };

  function send(message) {
    var text = JSON.stringify(message);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else if (window.parent !== window) window.parent.postMessage(text, "*");
  }

  function showError(text) {
    document.getElementById("map").innerHTML = '<div class="error">' + text + "</div>";
  }

  function lngLat(point) { return [point[1], point[0]]; }

  function line(coordinates) {
    return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coordinates } };
  }

  function setLines(id, lines) {
    var source = map.getSource(id);
    if (source) source.setData({ type: "FeatureCollection", features: lines.map(line) });
  }

  function markerAt(content, lat, lng, zIndex) {
    content.style.zIndex = String(zIndex || 0);
    return new mapboxgl.Marker({ element: content, anchor: "bottom" }).setLngLat([lng, lat]).addTo(map);
  }

  function applyState(state) {
    if (!map) return;
    reportCenter = !!state.reportCenter;
    var routeKey = state.keepRoute
      ? lastRouteId
      : state.route && state.route.length ? state.routeId + ":" + state.route.length : null;
    if (routeKey !== lastRouteId) {
      setLines("alt", []);
      setLines("route", []);
      if (routeKey) {
        var path = state.route.map(lngLat);
        var bounds = new mapboxgl.LngLatBounds();
        var alternatives = (state.alternativeRoutes || []).map(function (points) {
          var alternativePath = points.map(lngLat);
          alternativePath.forEach(function (point) { bounds.extend(point); });
          return alternativePath;
        });
        setLines("alt", alternatives);
        setLines("route", [path]);
        path.forEach(function (point) { bounds.extend(point); });
        map.fitBounds(bounds, {
          padding: { top: state.padTop, bottom: state.padBottom, left: 30, right: 30 },
          animate: false
        });
      }
    }
    lastRouteId = routeKey;

    applyWaitingAreas(state);
    applyVehicles(state);
    applyPickups(state);
    applyUserLocation(state);

    if (state.fit && state.fit.key !== lastFitKey && state.fit.points.length) {
      if (state.fit.points.length === 1) {
        map.jumpTo({ center: lngLat(state.fit.points[0]), zoom: 17 });
      } else {
        var fitBounds = new mapboxgl.LngLatBounds();
        state.fit.points.forEach(function (point) { fitBounds.extend(lngLat(point)); });
        map.fitBounds(fitBounds, {
          padding: { top: state.padTop, bottom: state.padBottom, left: 40, right: 40 },
          animate: false
        });
      }
    }
    lastFitKey = state.fit ? state.fit.key : null;

    if (state.focus && state.focus.key !== lastFocusKey) {
      map.easeTo({
        center: [state.focus.lng, state.focus.lat],
        zoom: state.focus.zoom || map.getZoom()
      });
    }
    lastFocusKey = state.focus ? state.focus.key : null;
  }

  function applyPickups(state) {
    var pickupKey = JSON.stringify(state.pickups || []);
    if (pickupKey !== lastPickupKey) {
      lastPickupKey = pickupKey;
      pickupMarkers.forEach(function (marker) { marker.remove(); });
      pickupMarkers = [];
      (state.pickups || []).forEach(function (pickup) {
        var content = document.createElement("div");
        var counted = typeof pickup.passengers === "number";
        content.className = "pickup" + (counted ? " counted" : "");
        content.innerHTML = counted ? COUNTED_PIN_SVG : MAP_PIN_SVG;
        if (counted) {
          var count = document.createElement("span");
          count.className = "pickup-count";
          count.textContent = String(pickup.passengers);
          content.appendChild(count);
        }
        if (pickup.label) {
          var label = document.createElement("span");
          label.className = "pickup-label";
          label.textContent = pickup.label;
          content.appendChild(label);
        }
        pickupMarkers.push(markerAt(content, pickup.lat, pickup.lng, 800));
      });
    }
    var lineKey = JSON.stringify(state.pickupLine || null);
    if (lineKey !== lastPickupLineKey) {
      lastPickupLineKey = lineKey;
      setLines("pickup-line", state.pickupLine && state.pickupLine.length > 1 ? [state.pickupLine.map(lngLat)] : []);
    }
    var lineColor = state.pickupLineColor || "#1f2937";
    if (lineColor !== lastPickupLineColor) {
      lastPickupLineColor = lineColor;
      map.setPaintProperty("pickup-line", "line-color", lineColor);
    }
  }

  function applyUserLocation(state) {
    var here = state.userLocation;
    if (!here) {
      if (meMarker) { meMarker.remove(); meMarker = null; }
      return;
    }
    if (!meMarker) {
      var content = document.createElement("div");
      content.className = "me";
      content.style.zIndex = "900";
      meMarker = new mapboxgl.Marker({ element: content, anchor: "center" }).setLngLat([here.lng, here.lat]).addTo(map);
    } else {
      meMarker.setLngLat([here.lng, here.lat]);
    }
  }

  function applyWaitingAreas(state) {
    if (state.keepWaitingAreas) return;
    var areas = (state.waitingAreas || []).filter(function (area) {
      return area.kind === "terminal" || area.kind === "tricycle_station" || state.showStops;
    });
    var key = areas.map(function (area) { return area.id + ":" + (area.tag || "") + ":" + (area.kind || ""); }).join(",");
    if (key === lastWaitingKey) return;
    lastWaitingKey = key;
    waitingMarkers.forEach(function (entry) { entry.marker.remove(); });
    waitingMarkers = areas.map(function (area) {
      var content = document.createElement("div");
      var terminal = area.kind === "terminal";
      var tricycleStation = area.kind === "tricycle_station";
      var waitingColor = WAITING_AREA_COLORS[area.kind || "stop"] || WAITING_AREA_COLORS.stop;
      var zIndex = terminal || tricycleStation ? 650 : 600;
      content.className = "waiting" + (terminal ? " hub" : "");
      content.style.setProperty("--waiting-color", waitingColor);
      content.style.setProperty(
        "--waiting-label-color",
        terminal || tricycleStation ? "#193caf" : waitingColor,
      );
      content.innerHTML = '<div class="waiting-icon">' + (terminal ? TERMINAL_SVG : WAITING_SVG) + '</div><div class="waiting-label"><span></span></div>';
      content.lastChild.firstChild.textContent = area.name;
      if (area.tag) {
        var tag = document.createElement("span");
        tag.className = "waiting-tag";
        tag.textContent = area.tag;
        content.lastChild.appendChild(tag);
      }
      var marker = markerAt(content, area.lat, area.lng, zIndex);
      var entry = { marker: marker, content: content, zIndex: zIndex };
      content.addEventListener("click", function (event) {
        event.stopPropagation();
        var open = !content.classList.contains("open");
        closeWaitingAreas();
        if (open) {
          content.classList.add("open");
          content.style.zIndex = "950";
        }
        updatePinFocus();
      });
      return entry;
    });
    updatePinFocus();
  }

  function closeWaitingAreas() {
    waitingMarkers.forEach(function (entry) {
      entry.content.classList.remove("open");
      entry.content.style.zIndex = String(entry.zIndex);
    });
    updatePinFocus();
  }

  function updatePinFocus() {
    var focused = !!document.querySelector(".waiting.open, .pin-wrap.focused");
    document.body.classList.toggle("pin-focused", focused);
  }

  function animateTo(entry, lat, lng) {
    var from = entry.position;
    var start = null;
    if (entry.frame) cancelAnimationFrame(entry.frame);
    function step(time) {
      if (start === null) start = time;
      var t = Math.min((time - start) / 900, 1);
      var eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      entry.position = { lat: from.lat + (lat - from.lat) * eased, lng: from.lng + (lng - from.lng) * eased };
      entry.marker.setLngLat([entry.position.lng, entry.position.lat]);
      entry.frame = t < 1 ? requestAnimationFrame(step) : null;
    }
    entry.frame = requestAnimationFrame(step);
  }

  function applyVehicles(state) {
    var seen = {};
    state.vehicles.forEach(function (vehicle) {
      seen[vehicle.id] = true;
      var entry = vehicleMarkers[vehicle.id];
      if (!entry) {
        var content = document.createElement("div");
        content.className = "pin-wrap";
        content.innerHTML = '<div class="pin"><img src="' + ICONS[vehicle.type] + '" /></div>';
        var pin = content.querySelector(".pin");
        var position = { lat: vehicle.lat, lng: vehicle.lng };
        var marker = markerAt(content, vehicle.lat, vehicle.lng, 700);
        var vehicleId = vehicle.id;
        content.addEventListener("click", function (event) {
          event.stopPropagation();
          send({ type: "vehicle", id: vehicleId });
        });
        entry = { marker: marker, position: position, frame: null, pin: pin };
        vehicleMarkers[vehicle.id] = entry;
      } else if (entry.position.lat !== vehicle.lat || entry.position.lng !== vehicle.lng) {
        animateTo(entry, vehicle.lat, vehicle.lng);
      }
      entry.pin.style.backgroundColor = vehicle.isFull
        ? OCCUPANCY_COLORS.Full
        : OCCUPANCY_COLORS[vehicle.occupancy] || "#ffffff";
    });
    updatePinFocus();
    Object.keys(vehicleMarkers).forEach(function (id) {
      if (seen[id]) return;
      var entry = vehicleMarkers[id];
      if (entry.frame) cancelAnimationFrame(entry.frame);
      entry.marker.remove();
      delete vehicleMarkers[id];
    });
  }

  function initMap() {
    mapboxgl.accessToken = TOKEN;
    map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/streets-v12",
      center: [123.1948, 13.6218],
      zoom: 14,
      dragRotate: false,
      pitchWithRotate: false
    });
    map.touchZoomRotate.disableRotation();
    map.touchPitch.disable();
    map.on("error", function (event) {
      var status = event && event.error && event.error.status;
      if (status === 401 || status === 403) {
        showError("Mapbox could not load. Check that MAPBOX_TOKEN is valid.");
      }
    });
    map.on("load", function () {
      map.addSource("alt", { type: "geojson", data: EMPTY });
      map.addSource("route", { type: "geojson", data: EMPTY });
      map.addSource("pickup-line", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "alt", type: "line", source: "alt",
        paint: { "line-color": "#1034A6", "line-width": 4, "line-opacity": 0.95, "line-dasharray": [2, 2] }
      });
      map.addLayer({
        id: "route", type: "line", source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#1034A6", "line-width": 4, "line-opacity": 0.95 }
      });
      map.addLayer({
        id: "pickup-line", type: "line", source: "pickup-line",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#1f2937", "line-width": 3, "line-opacity": 0.9 }
      });
      send({ type: "ready" });
    });
    map.on("click", closeWaitingAreas);
    map.on("dragstart", function () { send({ type: "drag" }); });
    map.on("moveend", function () {
      if (!reportCenter) return;
      var center = map.getCenter();
      send({ type: "center", lat: center.lat, lng: center.lng });
    });
  }

  window.applyState = applyState;
  window.addEventListener("message", function (event) {
    try {
      var message = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      if (message && message.type === "state") applyState(message.state);
    } catch (error) {}
  });

  if (TOKEN) {
    var script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.31.0/mapbox-gl.js";
    script.async = true;
    script.onload = initMap;
    script.onerror = function () { showError("Mapbox could not load. Check your connection."); };
    document.head.appendChild(script);
  } else {
    showError(
      "Missing Mapbox public token. Set EXPO_PUBLIC_MAPBOX_TOKEN to a public pk. token in .env and restart Expo.",
    );
  }
</script>
</body>
</html>`;

type MapMessage = { type?: string; lat?: number; lng?: number; id?: string };

function parseMessage(raw: unknown): MapMessage | null {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as MapMessage;
  } catch {
    return null;
  }
}

export function TransitMap({
  state,
  onDrag,
  onCenterChange,
  onVehiclePress,
}: TransitMapProps) {
  const [ready, setReady] = useState(false);
  const onDragRef = useRef(onDrag);
  const onCenterRef = useRef(onCenterChange);
  const onVehicleRef = useRef(onVehiclePress);

  useEffect(() => {
    onDragRef.current = onDrag;
    onCenterRef.current = onCenterChange;
    onVehicleRef.current = onVehiclePress;
  }, [onDrag, onCenterChange, onVehiclePress]);

  const handleMessage = (raw: unknown) => {
    const message = parseMessage(raw);
    if (message?.type === "ready") setReady(true);
    else if (message?.type === "drag") onDragRef.current?.();
    else if (message?.type === "vehicle" && typeof message.id === "string")
      onVehicleRef.current?.(message.id);
    else if (
      message?.type === "center" &&
      typeof message.lat === "number" &&
      typeof message.lng === "number"
    ) {
      onCenterRef.current?.({ lat: message.lat, lng: message.lng });
    }
  };
  const lastSent = useRef<Pick<
    TransitMapState,
    "routeId" | "route" | "alternativeRoutes" | "waitingAreas" | "showStops"
  > | null>(null);
  const webViewRef = useRef<WebView>(null);
  const frameRef = useRef<FrameRef | null>(null);

  useEffect(() => {
    if (!ready) return;
    const last = lastSent.current;
    const keepRoute =
      !!last &&
      last.routeId === state.routeId &&
      last.route === state.route &&
      last.alternativeRoutes === state.alternativeRoutes;
    const keepWaitingAreas =
      !!last &&
      last.waitingAreas === state.waitingAreas &&
      last.showStops === state.showStops;
    lastSent.current = {
      routeId: state.routeId,
      route: state.route,
      alternativeRoutes: state.alternativeRoutes,
      waitingAreas: state.waitingAreas,
      showStops: state.showStops,
    };
    const payload = JSON.stringify({
      ...state,
      route: keepRoute ? null : state.route,
      alternativeRoutes: keepRoute ? undefined : state.alternativeRoutes,
      waitingAreas: keepWaitingAreas ? undefined : state.waitingAreas,
      keepRoute,
      keepWaitingAreas,
      reportCenter: !!onCenterRef.current,
    });
    if (Platform.OS === "web") {
      frameRef.current?.contentWindow?.postMessage(
        `{"type":"state","state":${payload}}`,
        "*",
      );
    } else {
      webViewRef.current?.injectJavaScript(
        `window.applyState(${payload}); true;`,
      );
    }
  }, [ready, state]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const target = globalThis as unknown as WindowLike;
    const listener = (event: MessageEventLike) => {
      if (event.source === frameRef.current?.contentWindow) {
        handleMessage(event.data);
      }
    };
    target.addEventListener("message", listener);
    return () => target.removeEventListener("message", listener);
  }, []);

  if (Platform.OS === "web") {
    return (
      <View style={StyleSheet.absoluteFill}>
        {createElement("iframe", {
          ref: frameRef,
          srcDoc: mapHtml,
          title: "Routes map",
          style: { border: 0, width: "100%", height: "100%" },
        })}
      </View>
    );
  }

  return (
    <WebView
      ref={webViewRef}
      style={StyleSheet.absoluteFill}
      originWhitelist={["*"]}
      source={{ html: mapHtml, baseUrl: "https://localhost" }}
      onMessage={(event) => handleMessage(event.nativeEvent.data)}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
    />
  );
}
