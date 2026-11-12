import { router } from "expo-router";

import { Routes } from "@/constants/routes";
import { resetPasswords, signOutAll } from "@/simulation/auth";
import { db } from "@/simulation/db";
import * as engine from "@/simulation/engine";

export function switchRole(): void {
  signOutAll();
  if (router.canDismiss()) router.dismissAll();
  router.replace(Routes.login);
}

export function resetDemo(): void {
  signOutAll();
  db.reset();
  resetPasswords();
  signOutAll();
  engine.reset();
  engine.start();
  if (router.canDismiss()) router.dismissAll();
  router.replace(Routes.login);
}
