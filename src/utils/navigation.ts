import { router } from "expo-router";

import type { AppRoute } from "@/constants/routes";

export function goBackOr(fallback: AppRoute) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
