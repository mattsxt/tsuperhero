import { isRunningInExpoGo } from "expo";
import * as Location from "expo-location";
import { Platform } from "react-native";

import {
  hideLocationSharingNotice,
  isLocationSharingNoticeShown,
  showLocationSharingNotice,
} from "@/api/v1/notifications/device";
import { shareLocation } from "@/api/v1/operator/controllers";

type TaskManagerModule = typeof import("expo-task-manager");

const taskName = "tsuperhero-trip-location";
const noticeCheckMs = 20_000;

async function loadTaskManager(): Promise<TaskManagerModule | null> {
  if (Platform.OS === "web" || isRunningInExpoGo()) return null;
  try {
    const TaskManager = await import("expo-task-manager");
    TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
      taskName,
      async ({ data, error }) => {
        const latest = data?.locations?.[data.locations.length - 1];
        if (error || !latest) return;
        await shareLocation(latest.coords);
      },
    );
    return TaskManager;
  } catch {
    return null;
  }
}

const taskManager = loadTaskManager();

export type SharingMode = "background" | "foreground";

export type SharingStart = {
  mode: SharingMode;
  backgroundDenied: boolean;
};

let generation = 0;
let noticeTimer: ReturnType<typeof setInterval> | null = null;

async function startBackgroundUpdates(): Promise<
  "started" | "denied" | "unavailable"
> {
  const TaskManager = await taskManager;
  if (!TaskManager) return "unavailable";
  if (!(await TaskManager.isAvailableAsync().catch(() => false)))
    return "unavailable";
  try {
    let permission = await Location.getBackgroundPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await Location.requestBackgroundPermissionsAsync();
    }
    if (!permission.granted) return "denied";
    await Location.startLocationUpdatesAsync(taskName, {
      accuracy: Location.Accuracy.High,
      timeInterval: 3_000,
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.AutomotiveNavigation,
      foregroundService: {
        notificationTitle: "Sharing your location",
        notificationBody:
          "Commuters and your cooperative can see your vehicle until you end the trip.",
        notificationColor: "#1034A6",
        killServiceOnDestroy: true,
      },
    });
    return "started";
  } catch {
    return "unavailable";
  }
}

async function stopBackgroundUpdates() {
  if (!(await taskManager)) return;
  const started = await Location.hasStartedLocationUpdatesAsync(taskName).catch(
    () => false,
  );
  if (started)
    await Location.stopLocationUpdatesAsync(taskName).catch(() => null);
}

function stopNoticeTimer() {
  if (noticeTimer) clearInterval(noticeTimer);
  noticeTimer = null;
}

export async function startLocationSharing(): Promise<SharingStart> {
  const current = ++generation;
  stopNoticeTimer();
  const background = await startBackgroundUpdates();
  if (current !== generation) {
    if (background === "started") await stopBackgroundUpdates();
    return { mode: "foreground", backgroundDenied: false };
  }
  if (background === "started") {
    await hideLocationSharingNotice();
    return { mode: "background", backgroundDenied: false };
  }
  await showLocationSharingNotice();
  noticeTimer = setInterval(async () => {
    if (current !== generation) return;
    if (!(await isLocationSharingNoticeShown()))
      await showLocationSharingNotice();
  }, noticeCheckMs);
  return { mode: "foreground", backgroundDenied: background === "denied" };
}

export async function stopLocationSharing() {
  generation += 1;
  stopNoticeTimer();
  await hideLocationSharingNotice();
  await stopBackgroundUpdates();
}
