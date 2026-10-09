import * as Network from "expo-network";
import { useSyncExternalStore } from "react";

type NetworkState = Awaited<ReturnType<typeof Network.getNetworkStateAsync>>;

let online = true;
let started = false;
const listeners = new Set<() => void>();

const isOnlineState = (state: NetworkState) =>
  state.isConnected !== false && state.isInternetReachable !== false;

function update(next: boolean) {
  if (next === online) return;
  online = next;
  listeners.forEach((listener) => listener());
}

function start() {
  if (started) return;
  started = true;
  Network.getNetworkStateAsync()
    .then((state) => update(isOnlineState(state)))
    .catch(() => {});
  Network.addNetworkStateListener((state) => update(isOnlineState(state)));
}

export const isOnline = () => online;

export function subscribeToOnline(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOnline() {
  return useSyncExternalStore(subscribeToOnline, isOnline, isOnline);
}

export async function checkOnline() {
  start();
  const state = await Network.getNetworkStateAsync().catch(() => null);
  if (state) update(isOnlineState(state));
  return online;
}
