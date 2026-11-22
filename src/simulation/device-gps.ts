import * as Location from "expo-location";
import { AppState } from "react-native";

import type { DeviceLocationSource } from "@/simulation/gps";

const RETRY_MS = 5_000;

export const expoDeviceSource: DeviceLocationSource = (onFix) => {
  let subscription: Location.LocationSubscription | null = null;
  let stopped = false;
  let starting = false;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const emit = (location: Location.LocationObject | null) => {
    if (!stopped && location)
      onFix({ lat: location.coords.latitude, lng: location.coords.longitude });
  };

  const scheduleRetry = () => {
    clearTimeout(retry);
    if (!stopped && !subscription) retry = setTimeout(begin, RETRY_MS);
  };

  async function begin() {
    if (stopped || subscription || starting) return;
    starting = true;
    try {
      let permission = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!permission?.granted && permission?.canAskAgain !== false)
        permission = await Location.requestForegroundPermissionsAsync().catch(() => null);
      if (stopped || !permission?.granted) return;
      Location.getLastKnownPositionAsync().then(emit, () => {});
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).then(emit, () => {});
      const next = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 1_000, distanceInterval: 0 },
        emit,
      ).catch(() => null);
      if (stopped) next?.remove();
      else subscription = next;
    } finally {
      starting = false;
      scheduleRetry();
    }
  }

  const appState = AppState.addEventListener("change", (state) => {
    if (state === "active") void begin();
  });
  void begin();

  return () => {
    stopped = true;
    clearTimeout(retry);
    appState.remove();
    subscription?.remove();
    subscription = null;
  };
};
