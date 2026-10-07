import { isConnectionError } from "@/api/v1/cache";
import { Routes, type AppRoute } from "@/constants/routes";
import { isOnline } from "@/hooks/use-online";

export function signedOutOrOffline(error: unknown): AppRoute {
  return !isOnline() || isConnectionError(error)
    ? Routes.offline
    : Routes.login;
}
