import { useEffect, useSyncExternalStore } from "react";

import {
  getTransitRoutes,
  loadTransitRoutes,
  subscribeToTransitRoutes,
} from "@/api/v1/transit-routes/controllers";

export function useTransitRoutes() {
  useEffect(() => {
    loadTransitRoutes();
  }, []);

  return useSyncExternalStore(
    subscribeToTransitRoutes,
    getTransitRoutes,
    getTransitRoutes,
  );
}
