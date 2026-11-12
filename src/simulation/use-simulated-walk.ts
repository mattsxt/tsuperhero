import { useEffect } from "react";

import { isSimulation } from "@/simulation/flag";

export function useSimulatedWalk(
  target: { lat: number; lng: number } | null,
): void {
  const lat = target?.lat ?? null;
  const lng = target?.lng ?? null;
  useEffect(() => {
    if (!isSimulation()) return;
    const { currentSimulatedPoint, simulateWalkTo } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/simulation/gps") as typeof import("@/simulation/gps");
    if (lat === null || lng === null) {
      simulateWalkTo(null);
      return;
    }
    const { loadWalkingRoute } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/api/v1/transit-routes/controllers") as typeof import("@/api/v1/transit-routes/controllers");
    let active = true;
    const here = currentSimulatedPoint();
    loadWalkingRoute([here.lat, here.lng], [lat, lng]).then((result) => {
      if (active) simulateWalkTo({ lat, lng }, result.ok ? result.data.path : null);
    });
    return () => {
      active = false;
      simulateWalkTo(null);
    };
  }, [lat, lng]);
}
