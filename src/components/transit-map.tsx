import { createElement, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { googleMapsApiKey } from "@/constants/google-maps";
import { vehicleIconUris } from "@/constants/vehicle-icon-uris";

export type TransitMapState = {
  routeId: string | null;
  route: [number, number][] | null;
  vehicles: { id: string; lat: number; lng: number; type: string }[];
  selectedId: string | null;
  padTop: number;
  padBottom: number;
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
</style>
</head>
<body>
<div id="map"></div>
<script>
  var ICONS = ${JSON.stringify(vehicleIconUris)};
  var API_KEY = ${JSON.stringify(googleMapsApiKey ?? "")};
  var map = null;
  var routeLine = null;
  var markers = [];
  var lastRouteId = null;

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
    if (routeLine) { routeLine.setMap(null); routeLine = null; }
    if (state.route && state.route.length) {
      var path = state.route.map(function (point) { return { lat: point[0], lng: point[1] }; });
      routeLine = new google.maps.Polyline({
        path: path, map: map, strokeColor: "#f6c945", strokeWeight: 7, strokeOpacity: 0.95
      });
      if (state.routeId !== lastRouteId) {
        var bounds = new google.maps.LatLngBounds();
        path.forEach(function (point) { bounds.extend(point); });
        map.fitBounds(bounds, { top: state.padTop, bottom: state.padBottom, left: 30, right: 30 });
      }
    }
    lastRouteId = state.routeId;

    markers.forEach(function (marker) { marker.map = null; });
    markers = [];
    state.vehicles.forEach(function (vehicle) {
      var selected = vehicle.id === state.selectedId;
      var content = document.createElement("div");
      content.className = "pin-wrap";
      content.innerHTML = '<div class="pin' + (selected ? " selected" : "") + '"><img src="' + ICONS[vehicle.type] + '" /></div>';
      var marker = new google.maps.marker.AdvancedMarkerElement({
        map: map,
        position: { lat: vehicle.lat, lng: vehicle.lng },
        content: content,
        zIndex: selected ? 1000 : 0
      });
      marker.addListener("click", function () { send({ type: "select", id: vehicle.id }); });
      markers.push(marker);
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
    showError("Missing Google Maps API key. Set GOOGLE_MAPS_API_KEY in .env and restart Expo.");
  }
</script>
</body>
</html>`;

export function TransitMap({
  state,
  onSelect,
}: {
  state: TransitMapState;
  onSelect: (id: string | null) => void;
}) {
  const [ready, setReady] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const frameRef = useRef<FrameRef | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

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
      const message = JSON.parse(raw) as { type: string; id?: string | null };
      if (message.type === "ready") setReady(true);
      if (message.type === "select") onSelectRef.current(message.id ?? null);
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
