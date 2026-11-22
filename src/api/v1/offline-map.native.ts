import Mapbox from "@rnmapbox/maps";

import type { TransitRoute } from "@/api/v1/transit-routes/controllers";
import { mapStyleUrl } from "@/constants/mapbox";

const packName = "service-area-v1";
const marginDegrees = 0.02;
const maxSpanDegrees = 0.5;
const minZoom = 10;
const maxZoom = 15;

let saving: Promise<void> | null = null;

export function saveOfflineMap(routes: TransitRoute[]): Promise<void> {
  saving ??= save(routes).finally(() => {
    saving = null;
  });
  return saving;
}

async function save(routes: TransitRoute[]) {
  const points = routes.flatMap((route) =>
    [route.waypoints, ...route.alternativePaths].flat(),
  );
  if (points.length === 0) return;

  const lats = points.map(([lat]) => lat);
  const lngs = points.map(([, lng]) => lng);
  const north = Math.max(...lats) + marginDegrees;
  const south = Math.min(...lats) - marginDegrees;
  const east = Math.max(...lngs) + marginDegrees;
  const west = Math.min(...lngs) - marginDegrees;
  if (north - south > maxSpanDegrees || east - west > maxSpanDegrees) return;

  const existing = await Mapbox.offlineManager.getPack(packName);
  if (existing) {
    const status = await existing.status();
    if (status.percentage < 100) await existing.resume();
    return;
  }

  await Mapbox.offlineManager.createPack(
    {
      name: packName,
      styleURL: mapStyleUrl,
      bounds: [
        [east, north],
        [west, south],
      ],
      minZoom,
      maxZoom,
    },
    () => {},
  );
}
