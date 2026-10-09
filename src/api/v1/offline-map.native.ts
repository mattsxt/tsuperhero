import Mapbox from "@rnmapbox/maps";

import type { TransitRoute } from "@/api/v1/transit-routes/controllers";
import { mapStyleUrl } from "@/constants/mapbox";

const packName = "service-area-v1";
// About 2 km of map around the outermost route points.
const marginDegrees = 0.02;
// Skip the download if the routes span more than about 55 km, so a stray
// waypoint can't trigger a huge pack.
const maxSpanDegrees = 0.5;
// Vector tiles stay sharp when zoomed past the stored level, so stopping at
// 15 keeps the pack small.
const minZoom = 10;
const maxZoom = 15;

let saving: Promise<void> | null = null;

// Downloads the map tiles around the transit routes once, so the base map
// still shows in mobile data dead zones. An unfinished download resumes.
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
