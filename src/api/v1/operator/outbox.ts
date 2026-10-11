import type { LocationObjectCoords } from "expo-location";
import { useSyncExternalStore } from "react";

import { isConnectionError, readCache, writeCache } from "@/api/v1/cache";
import { toUserMessage } from "@/api/v1/errors";
import {
  operatorRoutes,
  type LocationParams,
  type TrailPoint,
  type TripStateParams,
} from "@/api/v1/operator/routes";
import { isOnline, subscribeToOnline } from "@/hooks/use-online";

type Outbox = {
  tripState: TripStateParams | null;
  location: LocationParams | null;
  trail: TrailPoint[];
  tripEnd: { p_distance_done_km: number } | null;
};

export type SendOutcome =
  | { status: "sent" }
  | { status: "queued" }
  | { status: "failed"; error: string };

const storageKey = "driver-outbox";
const retryMs = 15_000;
const requestTimeoutMs = 15_000;
const trailEveryMs = 30_000;
const maxTrailPoints = 200;
const emptyOutbox: Outbox = {
  tripState: null,
  location: null,
  trail: [],
  tripEnd: null,
};

let outbox: Outbox = { ...emptyOutbox, ...readCache<Outbox>(storageKey) };
let flushing: Promise<void> | null = null;
let stopWatching: (() => void) | null = null;
let retryTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

const pendingCount = () =>
  (outbox.tripState ? 1 : 0) +
  (outbox.location ? 1 : 0) +
  (outbox.trail.length ? 1 : 0) +
  (outbox.tripEnd ? 1 : 0);

function save(next: Outbox) {
  outbox = next;
  writeCache(storageKey, outbox);
  listeners.forEach((listener) => listener());
  if (pendingCount() > 0) startRetrying();
  else stopRetrying();
}

function startRetrying() {
  stopWatching ??= subscribeToOnline(() => {
    if (isOnline()) flushOutbox();
  });
  retryTimer ??= setInterval(() => flushOutbox(), retryMs);
}

function stopRetrying() {
  stopWatching?.();
  stopWatching = null;
  if (retryTimer) clearInterval(retryTimer);
  retryTimer = null;
}

function addTrailPoint(params: LocationParams) {
  const last = outbox.trail[outbox.trail.length - 1];
  const now = Date.now();
  if (last && now - Date.parse(last.recorded_at) < trailEveryMs) return;
  const point: TrailPoint = {
    latitude: params.p_latitude,
    longitude: params.p_longitude,
    speed_kmh: params.p_speed_kmh,
    heading: params.p_heading,
    recorded_at: new Date(now).toISOString(),
  };
  save({
    ...outbox,
    trail: [...outbox.trail, point].slice(-maxTrailPoints),
  });
}

function call(slot: "tripState" | "location" | "trail" | "tripEnd") {
  if (slot === "tripState" && outbox.tripState)
    return operatorRoutes.setMyTripState(outbox.tripState);
  if (slot === "location" && outbox.location)
    return operatorRoutes.shareMyLocation(outbox.location);
  if (slot === "trail") return operatorRoutes.recordTrail(outbox.trail);
  if (outbox.tripEnd)
    return operatorRoutes.endMyTrip(outbox.tripEnd.p_distance_done_km);
  return Promise.resolve({ error: null });
}

async function request(
  slot: "tripState" | "location" | "trail" | "tripEnd",
): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<{ error: unknown }>((resolve) => {
    timer = setTimeout(
      () => resolve({ error: { message: "Request timed out" } }),
      requestTimeoutMs,
    );
  });
  try {
    const result = await Promise.race([call(slot), timeout]);
    return result.error;
  } catch (caught) {
    return caught;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function send(
  slot: "tripState" | "location" | "trail" | "tripEnd",
): Promise<SendOutcome> {
  const sending = outbox[slot];
  const error = await request(slot);
  const unchanged = outbox[slot] === sending;
  if (!error) {
    if (unchanged) save({ ...outbox, [slot]: slot === "trail" ? [] : null });
    return { status: "sent" };
  }
  if (isConnectionError(error)) {
    if (slot === "location" && outbox.location) addTrailPoint(outbox.location);
    return { status: "queued" };
  }
  if (unchanged) save({ ...outbox, [slot]: slot === "trail" ? [] : null });
  return { status: "failed", error: toUserMessage(error) };
}

export function flushOutbox(): Promise<void> {
  if (flushing) return flushing;
  if (!isOnline() || pendingCount() === 0) return Promise.resolve();
  flushing = (async () => {
    if (outbox.tripState && !outbox.tripEnd) {
      if ((await send("tripState")).status === "queued") return;
    }
    if (outbox.trail.length) {
      if ((await send("trail")).status === "queued") return;
    }
    if (outbox.location && !outbox.tripEnd) {
      if ((await send("location")).status === "queued") return;
    }
    if (outbox.tripEnd) await send("tripEnd");
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function deliver(
  slot: "tripState" | "location",
  params: TripStateParams | LocationParams,
): Promise<SendOutcome> {
  if (outbox.tripEnd) return { status: "queued" };
  save({ ...outbox, [slot]: params });
  if (!isOnline()) {
    if (slot === "location") addTrailPoint(params as LocationParams);
    return { status: "queued" };
  }
  if (slot === "location" && (outbox.tripState || outbox.trail.length)) {
    await flushOutbox();
    return outbox.location ? { status: "queued" } : { status: "sent" };
  }
  return send(slot);
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

export async function sendTripEnd(
  distanceDoneKm: number,
): Promise<SendOutcome> {
  save({
    ...outbox,
    tripState: null,
    location: null,
    tripEnd: { p_distance_done_km: distanceDoneKm },
  });
  if (!isOnline()) return { status: "queued" };
  await flushOutbox();
  if (!outbox.tripEnd) return { status: "sent" };
  const outcome = await send("tripEnd");
  return outcome;
}

export const hasPendingTripEnd = () => !!outbox.tripEnd;

export function clearOutbox() {
  save(emptyOutbox);
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
