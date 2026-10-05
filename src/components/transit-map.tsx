import { createElement, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { googleMapsApiKey } from "@/constants/google-maps";
import { vehicleIconUris } from "@/constants/vehicle-icon-uris";

export type TransitMapState = {
  routeId: string | null;
  route: [number, number][] | null;
  alternativeRoutes?: [number, number][][];
  waitingAreas?: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    tag?: string | null;
    kind?: "stop" | "terminal";
  }[];
  vehicles: { id: string; lat: number; lng: number; type: string }[];
  focus: { key: number; lat: number; lng: number; zoom?: number } | null;
  padTop: number;
  padBottom: number;
  pickups?: { id: string; lat: number; lng: number }[];
  pickupLine?: [number, number][] | null;
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
  .pin-wrap, .waiting { transition: opacity 220ms ease-in-out; }
  body.pin-focused .pin-wrap:not(.focused),
  body.pin-focused .waiting:not(.open) { opacity: 0.3; }
  .waiting { position: relative; cursor: pointer; }
  .waiting-icon {
    width: 22px; height: 22px; box-sizing: border-box; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: #1e9e45; border: 2px solid #ffffff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.35);
    transition: transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .waiting-label {
    position: absolute; top: 100%; left: 50%; margin-top: 6px;
    padding: 3px 8px; border-radius: 6px;
    background: #ffffff; color: #15803d;
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
  .waiting.hub .waiting-icon { border-radius: 6px; background: #193caf; }
  .waiting.hub .waiting-label { color: #193caf; }
  .pickup { line-height: 0; filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.35)); }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var ICONS = ${JSON.stringify(vehicleIconUris)};
  var API_KEY = ${JSON.stringify(googleMapsApiKey ?? "")};
  var TERMINAL_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>';
  var map = null;
  var routeLine = null;
  var alternativeLines = [];
  var vehicleMarkers = {};
  var waitingMarkers = [];
  var lastWaitingKey = "";
  var WAITING_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M12 8v7M9 22l3-7 3 7M8 12h8"/></svg>';
  var MAP_PIN_SVG = '<svg width="32" height="32" viewBox="0 0 24 24" fill="#c81e1e" stroke="#c81e1e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3" fill="#ffffff" stroke="none"/></svg>';
  var lastRouteId = null;
  var lastFocusKey = null;
  var pickupMarkers = [];
  var pickupLine = null;

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
      alternativeLines.forEach(function (line) { line.setMap(null); });
      alternativeLines = [];
      if (routeKey) {
        var path = state.route.map(function (point) { return { lat: point[0], lng: point[1] }; });
        var bounds = new google.maps.LatLngBounds();
        (state.alternativeRoutes || []).forEach(function (points) {
          var alternativePath = points.map(function (point) { return { lat: point[0], lng: point[1] }; });
          alternativePath.forEach(function (point) { bounds.extend(point); });
          alternativeLines.push(new google.maps.Polyline({
            path: alternativePath, map: map, strokeOpacity: 0,
            icons: [{
              icon: { path: "M 0,-1 0,1", strokeColor: "#f6c945", strokeOpacity: 0.95, strokeWeight: 4, scale: 4 },
              offset: "0", repeat: "18px"
            }]
          }));
        });
        routeLine = new google.maps.Polyline({
          path: path, map: map, strokeColor: "#f6c945", strokeWeight: 4, strokeOpacity: 0.95
        });
        path.forEach(function (point) { bounds.extend(point); });
        map.fitBounds(bounds, { top: state.padTop, bottom: state.padBottom, left: 30, right: 30 });
      }
    }
    lastRouteId = routeKey;

    applyWaitingAreas(state);
    applyVehicles(state);
    applyPickups(state);

    if (state.focus && state.focus.key !== lastFocusKey) {
      map.panTo({ lat: state.focus.lat, lng: state.focus.lng });
      if (state.focus.zoom) map.setZoom(state.focus.zoom);
    }
    lastFocusKey = state.focus ? state.focus.key : null;
  }

  function applyPickups(state) {
    pickupMarkers.forEach(function (marker) { marker.map = null; });
    pickupMarkers = [];
    (state.pickups || []).forEach(function (pickup) {
      var content = document.createElement("div");
      content.className = "pickup";
      content.innerHTML = MAP_PIN_SVG;
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

  function applyWaitingAreas(state) {
    var areas = state.waitingAreas || [];
    var key = areas.map(function (area) { return area.id + ":" + (area.tag || "") + ":" + (area.kind || ""); }).join(",");
    if (key === lastWaitingKey) return;
    lastWaitingKey = key;
    waitingMarkers.forEach(function (entry) { entry.marker.map = null; });
    waitingMarkers = areas.map(function (area) {
      var content = document.createElement("div");
      var terminal = area.kind === "terminal";
      content.className = "waiting" + (terminal ? " hub" : "");
      content.innerHTML = '<div class="waiting-icon">' + (terminal ? TERMINAL_SVG : WAITING_SVG) + '</div><div class="waiting-label"><span></span></div>';
      content.lastChild.firstChild.textContent = area.name;
      if (area.tag) {
        var tag = document.createElement("span");
        tag.className = "waiting-tag";
        tag.textContent = area.tag;
        content.lastChild.appendChild(tag);
      }
      var marker = new google.maps.marker.AdvancedMarkerElement({
        map: map, position: { lat: area.lat, lng: area.lng }, content: content, zIndex: terminal ? 650 : 600
      });
      var entry = { marker: marker, content: content, zIndex: terminal ? 650 : 600 };
      marker.addListener("click", function () {
        var open = !content.classList.contains("open");
        closeWaitingAreas();
        if (open) {
          content.classList.add("open");
          marker.zIndex = 950;
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
      entry.marker.zIndex = entry.zIndex;
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
      entry.marker.position = entry.position;
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
        var position = { lat: vehicle.lat, lng: vehicle.lng };
        var marker = new google.maps.marker.AdvancedMarkerElement({
          map: map, position: position, content: content
        });
        entry = { marker: marker, position: position, frame: null };
        vehicleMarkers[vehicle.id] = entry;
      } else if (entry.position.lat !== vehicle.lat || entry.position.lng !== vehicle.lng) {
        animateTo(entry, vehicle.lat, vehicle.lng);
      }
    });
    updatePinFocus();
    Object.keys(vehicleMarkers).forEach(function (id) {
      if (seen[id]) return;
      var entry = vehicleMarkers[id];
      if (entry.frame) cancelAnimationFrame(entry.frame);
      entry.marker.map = null;
      delete vehicleMarkers[id];
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
    map.addListener("click", closeWaitingAreas);
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

function isReadyMessage(raw: unknown) {
  if (typeof raw !== "string") return false;
  try {
    return (JSON.parse(raw) as { type?: string }).type === "ready";
  } catch {
    return false;
  }
}

export function TransitMap({ state }: { state: TransitMapState }) {
  const [ready, setReady] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const frameRef = useRef<FrameRef | null>(null);

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

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const target = globalThis as unknown as WindowLike;
    const listener = (event: MessageEventLike) => {
      if (
        event.source === frameRef.current?.contentWindow &&
        isReadyMessage(event.data)
      ) {
        setReady(true);
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
      onMessage={(event) => {
        if (isReadyMessage(event.nativeEvent.data)) setReady(true);
      }}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
    />
  );
}
