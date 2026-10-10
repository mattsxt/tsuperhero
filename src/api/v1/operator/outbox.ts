import type { LocationObjectCoords } from "expo-location";
import { useSyncExternalStore } from "react";

import { isConnectionError, readCache, writeCache } from "@/api/v1/cache";
import { toUserMessage } from "@/api/v1/errors";
import {
  operatorRoutes,
  type LocationParams,
  type TripStateParams,
} from "@/api/v1/operator/routes";
import { isOnline, subscribeToOnline } from "@/hooks/use-online";

type Outbox = {
  tripState: TripStateParams | null;
  location: LocationParams | null;
};

export type SendOutcome =
  | { status: "sent" }
  | { status: "queued" }
  | { status: "failed"; error: string };

const storageKey = "driver-outbox";
const retryMs = 15_000;

let outbox: Outbox = readCache<Outbox>(storageKey) ?? {
  tripState: null,
  location: null,
};
let flushing: Promise<void> | null = null;
let watching = false;
let retryTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

const pendingCount = () =>
  (outbox.tripState ? 1 : 0) + (outbox.location ? 1 : 0);

function save(next: Outbox) {
  outbox = next;
  writeCache(storageKey, outbox);
  listeners.forEach((listener) => listener());
  if (pendingCount() > 0) startRetrying();
  else stopRetrying();
}

function startRetrying() {
  if (!watching) {
    watching = true;
    subscribeToOnline(() => {
      if (isOnline()) flushOutbox();
    });
  }
  if (!retryTimer) retryTimer = setInterval(() => flushOutbox(), retryMs);
}

function stopRetrying() {
  if (retryTimer) clearInterval(retryTimer);
  retryTimer = null;
}

async function send(
  slot: keyof Outbox,
  params: TripStateParams | LocationParams,
): Promise<SendOutcome> {
  const request =
    slot === "tripState"
      ? operatorRoutes.setMyTripState({
          ...(params as TripStateParams),
          p_is_full: (params as TripStateParams).p_is_full ?? false,
        })
      : operatorRoutes.shareMyLocation(params as LocationParams);
  let error: unknown = null;
  try {
    error = (await request).error;
  } catch (caught) {
    error = caught;
  }
  if (!error) {
    if (outbox[slot] === params) save({ ...outbox, [slot]: null });
    return { status: "sent" };
  }
  if (isConnectionError(error)) {
    if (!outbox[slot] || outbox[slot] === params)
      save({ ...outbox, [slot]: params });
    return { status: "queued" };
  }
  if (outbox[slot] === params) save({ ...outbox, [slot]: null });
  return { status: "failed", error: toUserMessage(error) };
}

async function deliver(
  slot: keyof Outbox,
  params: TripStateParams | LocationParams,
): Promise<SendOutcome> {
  save({ ...outbox, [slot]: params });
  if (!isOnline()) return { status: "queued" };
  if (slot === "location" && outbox.tripState) {
    await flushOutbox();
    return outbox.location ? { status: "queued" } : { status: "sent" };
  }
  return send(slot, params);
}

export function flushOutbox(): Promise<void> {
  if (flushing) return flushing;
  if (!isOnline() || pendingCount() === 0) return Promise.resolve();
  flushing = (async () => {
    if (outbox.tripState) {
      const result = await send("tripState", outbox.tripState);
      if (result.status === "queued") return;
    }
    if (outbox.location) await send("location", outbox.location);
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export function sendTripState(
  status: TripStateParams["p_status"],
  passengers: number,
  isFull = false,
) {
  return deliver("tripState", {
    p_status: status,
    p_current_capacity: passengers,
    p_is_full: isFull,
  });
}

export function sendLocation({
  latitude,
  longitude,
  speed,
  heading,
}: LocationObjectCoords) {
  return deliver("location", {
    p_latitude: latitude,
    p_longitude: longitude,
    p_speed_kmh: Math.max(speed ?? 0, 0) * 3.6,
    p_heading: heading != null && heading >= 0 ? heading : 0,
  });
}

export function clearOutbox() {
  save({ tripState: null, location: null });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePendingSync() {
  return useSyncExternalStore(subscribe, pendingCount, pendingCount);
}

if (pendingCount() > 0) startRetrying();
