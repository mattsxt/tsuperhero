import { createElement, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { googleMapsApiKey } from "@/constants/google-maps";
import { vehicleIconUris } from "@/constants/vehicle-icon-uris";

export type TransitMapState = {
  routeId: string | null;
  route: [number, number][] | null;
  vehicles: { id: string; lat: number; lng: number; type: string }[];
  terminals: { id: string; name: string; lat: number; lng: number }[];
  highlightedTerminalId: string | null;
  selectedId: string | null;
  focus: { key: number; lat: number; lng: number } | null;
  padTop: number;
  padBottom: number;
  pickups?: { id: string; lat: number; lng: number }[];
  pickupLine?: [number, number][] | null;
  area?: { id: string; lat: number; lng: number; radius: number } | null;
};

export type TransitMapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

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
  .terminal { display: flex; flex-direction: column; align-items: center; }
  .terminal-icon {
    width: 22px; height: 22px; box-sizing: border-box; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    background: #193caf; border: 2px solid #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
  }
  .terminal-label {
    margin-top: 3px; padding: 2px 6px; border-radius: 6px;
    background: rgba(255, 255, 255, 0.92); color: #193caf;
    font: bold 10px sans-serif; white-space: nowrap;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  }
  .terminal.highlighted .terminal-icon { width: 30px; height: 30px; background: #1e9e45; }
  .terminal.highlighted .terminal-label { background: #1e9e45; color: #ffffff; font-size: 11px; }
  .pickup {
    width: 22px; height: 22px; box-sizing: border-box; margin-bottom: 4px;
    border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
    background: #ffffff; border: 4px solid #c81e1e;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
  }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var ICONS = ${JSON.stringify(vehicleIconUris)};
  var API_KEY = ${JSON.stringify(googleMapsApiKey ?? "")};
  var TERMINAL_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v18"/><path d="M4 22h16"/><path d="M9 7h6M9 11h6M9 15h6"/></svg>';
  var map = null;
  var routeLine = null;
  var vehicleMarkers = {};
  var terminalMarkers = [];
  var lastRouteId = null;
  var lastFocusKey = null;
  var pickupMarkers = [];
  var pickupLine = null;
  var areaCircle = null;
  var lastAreaId = null;

  function send(message) {
    var text = JSON.stringify(message);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else if (window.parent !== window) window.parent.postMessage(text, "*");
  }

  function showError(text) {
    document.getElementById("map").innerHTML = '<div class="error">' + text + "</div>";
  }

  window.gm_authFailure = function () {
    showError("Google Maps could not load. Check that the API key is valid and the Maps JavaScript API is enabled.");
  };

  function applyState(state) {
    if (!map) return;
    var routeKey = state.route && state.route.length ? state.routeId + ":" + state.route.length : null;
    if (routeKey !== lastRouteId) {
      if (routeLine) { routeLine.setMap(null); routeLine = null; }
      if (routeKey) {
        var path = state.route.map(function (point) { return { lat: point[0], lng: point[1] }; });
        routeLine = new google.maps.Polyline({
          path: path, map: map, strokeColor: "#f6c945", strokeWeight: 7, strokeOpacity: 0.95
        });
        var bounds = new google.maps.LatLngBounds();
        path.forEach(function (point) { bounds.extend(point); });
        map.fitBounds(bounds, { top: state.padTop, bottom: state.padBottom, left: 30, right: 30 });
      }
    }
    lastRouteId = routeKey;

    applyArea(state);
    applyTerminals(state);
    applyVehicles(state);
    applyPickups(state);

    if (state.focus && state.focus.key !== lastFocusKey) {
      map.panTo({ lat: state.focus.lat, lng: state.focus.lng });
    }
    lastFocusKey = state.focus ? state.focus.key : null;
  }

  function applyArea(state) {
    var area = state.area || null;
    var areaId = area ? area.id : null;
    if (areaId === lastAreaId) return;
    lastAreaId = areaId;
    if (areaCircle) { areaCircle.setMap(null); areaCircle = null; }
    if (!area) return;
    areaCircle = new google.maps.Circle({
      map: map, center: { lat: area.lat, lng: area.lng }, radius: area.radius,
      strokeColor: "#193caf", strokeOpacity: 0.8, strokeWeight: 2,
      fillColor: "#193caf", fillOpacity: 0.08, clickable: false
    });
    map.fitBounds(areaCircle.getBounds(), { top: state.padTop, bottom: state.padBottom, left: 20, right: 20 });
  }

  function applyPickups(state) {
    pickupMarkers.forEach(function (marker) { marker.map = null; });
    pickupMarkers = [];
    (state.pickups || []).forEach(function (pickup) {
      var content = document.createElement("div");
      content.className = "pickup";
      pickupMarkers.push(new google.maps.marker.AdvancedMarkerElement({
        map: map, position: { lat: pickup.lat, lng: pickup.lng }, content: content, zIndex: 800
      }));
    });
    if (pickupLine) { pickupLine.setMap(null); pickupLine = null; }
    if (state.pickupLine && state.pickupLine.length > 1) {
      pickupLine = new google.maps.Polyline({
        map: map, strokeColor: "#1f2937", strokeWeight: 3, strokeOpacity: 0.9,
        path: state.pickupLine.map(function (point) { return { lat: point[0], lng: point[1] }; })
      });
    }
  }

  function applyTerminals(state) {
    terminalMarkers.forEach(function (marker) { marker.map = null; });
    terminalMarkers = [];
    state.terminals.forEach(function (terminal) {
      var highlighted = terminal.id === state.highlightedTerminalId;
      var content = document.createElement("div");
      content.className = "terminal" + (highlighted ? " highlighted" : "");
      content.innerHTML = '<div class="terminal-icon">' + TERMINAL_SVG + '</div><div class="terminal-label"></div>';
      content.lastChild.textContent = terminal.name;
      terminalMarkers.push(new google.maps.marker.AdvancedMarkerElement({
        map: map,
        position: { lat: terminal.lat, lng: terminal.lng },
        content: content,
        zIndex: highlighted ? 900 : 500
      }));
    });
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
      entry.marker.position = entry.position;
      entry.frame = t < 1 ? requestAnimationFrame(step) : null;
    }
    entry.frame = requestAnimationFrame(step);
  }

  function applyVehicles(state) {
    var seen = {};
    state.vehicles.forEach(function (vehicle) {
      seen[vehicle.id] = true;
      var selected = vehicle.id === state.selectedId;
      var entry = vehicleMarkers[vehicle.id];
      if (!entry) {
        var content = document.createElement("div");
        content.className = "pin-wrap";
        content.innerHTML = '<div class="pin"><img src="' + ICONS[vehicle.type] + '" /></div>';
        var position = { lat: vehicle.lat, lng: vehicle.lng };
        var marker = new google.maps.marker.AdvancedMarkerElement({
          map: map, position: position, content: content
        });
        marker.addListener("click", function () { send({ type: "select", id: vehicle.id }); });
        entry = { marker: marker, pin: content.firstChild, position: position, frame: null };
        vehicleMarkers[vehicle.id] = entry;
      } else if (entry.position.lat !== vehicle.lat || entry.position.lng !== vehicle.lng) {
        animateTo(entry, vehicle.lat, vehicle.lng);
      }
      entry.pin.className = "pin" + (selected ? " selected" : "");
      entry.marker.zIndex = selected ? 1000 : 0;
    });
    Object.keys(vehicleMarkers).forEach(function (id) {
      if (seen[id]) return;
      var entry = vehicleMarkers[id];
      if (entry.frame) cancelAnimationFrame(entry.frame);
      entry.marker.map = null;
      delete vehicleMarkers[id];
    });
  }

  function sendBounds() {
    var bounds = map.getBounds();
    if (!bounds) return;
    var northEast = bounds.getNorthEast();
    var southWest = bounds.getSouthWest();
    send({
      type: "bounds",
      bounds: { north: northEast.lat(), east: northEast.lng(), south: southWest.lat(), west: southWest.lng() }
    });
  }

  window.initMap = function () {
    map = new google.maps.Map(document.getElementById("map"), {
      center: { lat: 13.6218, lng: 123.1948 },
      zoom: 14,
      mapId: "DEMO_MAP_ID",
      disableDefaultUI: true,
      clickableIcons: false,
      gestureHandling: "greedy"
    });
    map.addListener("click", function () { send({ type: "select", id: null }); });
    map.addListener("idle", sendBounds);
    send({ type: "ready" });
  };

  window.applyState = applyState;
  window.addEventListener("message", function (event) {
    try {
      var message = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      if (message && message.type === "state") applyState(message.state);
    } catch (error) {}
  });

  if (API_KEY) {
    var script = document.createElement("script");
    script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(API_KEY) +
      "&libraries=marker&loading=async&callback=initMap&v=weekly";
    script.async = true;
    script.onerror = function () { showError("Google Maps could not load. Check your connection."); };
    document.head.appendChild(script);
  } else {
    showError("Missing Google Maps API key. Set VITE_GOOGLE_MAPS_API_KEY in .env and restart Expo.");
  }
</script>
</body>
</html>`;

export function TransitMap({
  state,
  onSelect,
  onBoundsChange,
}: {
  state: TransitMapState;
  onSelect: (id: string | null) => void;
  onBoundsChange?: (bounds: TransitMapBounds) => void;
}) {
  const [ready, setReady] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const frameRef = useRef<FrameRef | null>(null);
  const onSelectRef = useRef(onSelect);
  const onBoundsRef = useRef(onBoundsChange);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onBoundsRef.current = onBoundsChange;
  }, [onSelect, onBoundsChange]);

  useEffect(() => {
    if (!ready) return;
    if (Platform.OS === "web") {
      frameRef.current?.contentWindow?.postMessage(
        JSON.stringify({ type: "state", state }),
        "*",
      );
    } else {
      webViewRef.current?.injectJavaScript(
        `window.applyState(${JSON.stringify(state)}); true;`,
      );
    }
  }, [ready, state]);

  const handleMessage = (raw: unknown) => {
    if (typeof raw !== "string") return;
    try {
      const message = JSON.parse(raw) as {
        type: string;
        id?: string | null;
        bounds?: TransitMapBounds;
      };
      if (message.type === "ready") setReady(true);
      if (message.type === "select") onSelectRef.current(message.id ?? null);
      if (message.type === "bounds" && message.bounds) {
        onBoundsRef.current?.(message.bounds);
      }
    } catch {}
  };

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
  });

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
