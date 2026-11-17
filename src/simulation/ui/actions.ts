import { router } from "expo-router";

import { login } from "@/api/v1/auth/controllers";
import { Routes } from "@/constants/routes";
import { currentUserId, DEMO_PASSWORD, resetPasswords, signOutAll } from "@/simulation/auth";
import { db } from "@/simulation/db";
import * as engine from "@/simulation/engine";
import { requestDemoRefresh } from "@/simulation/refresh";
import { swapDemoVehicle } from "@/simulation/vehicle-swap";

export { myVehicleType, type DemoVehicleType } from "@/simulation/vehicle-swap";

const commuterEmail = "juan@demo.tsuperhero";
let driverEmail = "mario@demo.tsuperhero";

const signedInEmail = () =>
  db.tables.user.find((u) => u.user_id === currentUserId())?.user_email as string | undefined;

export async function switchRole(): Promise<string | null> {
  engine.setSpeed(1);
  engine.resume();
  const isDriver = db.tables.transit_personnel.some((p) => p.user_id === currentUserId());
  if (isDriver) driverEmail = signedInEmail() ?? driverEmail;
  const result = await login(isDriver ? commuterEmail : driverEmail, DEMO_PASSWORD);
  if (router.canDismiss()) router.dismissAll();
  if (!result.ok) {
    signOutAll();
    router.replace(Routes.login);
    return result.error;
  }
  router.replace(result.data as Parameters<typeof router.replace>[0]);
  return null;
}

export function switchVehicleType(pathname?: string): { ok: boolean; message: string } {
  const result = swapDemoVehicle();
  if (!result.ok) return result;
  engine.setSpeed(1);
  engine.resume();
  if (pathname !== Routes.profileVehicles) {
    if (router.canDismiss()) router.dismissAll();
    router.replace(Routes.transitHome);
  }
  requestDemoRefresh();
  return result;
}

export function resetDemo(): void {
  driverEmail = "mario@demo.tsuperhero";
  signOutAll();
  db.reset();
  resetPasswords();
  signOutAll();
  engine.reset();
  engine.start();
  if (router.canDismiss()) router.dismissAll();
  router.replace(Routes.login);
}
