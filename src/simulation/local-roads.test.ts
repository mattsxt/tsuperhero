import assert from "node:assert/strict";
import { test } from "node:test";

import { localRoadPath } from "@/simulation/local-roads";
import { roadGeometry } from "@/simulation/seed/road-geometry.generated";
import { distanceToPath, getDistanceMeters, type LatLngPair } from "@/utils/geo";

const road = Object.values(roadGeometry)[0].path;
const at = (i: number): LatLngPair => road[i];
const nudge = ([lat, lng]: LatLngPair): LatLngPair => [lat + 0.0002, lng];

test("offline router follows baked roads between two points", () => {
  const from = nudge(at(10));
  const to = nudge(at(120));
  const path = localRoadPath(from, to);
  assert.ok(path && path.length > 4);
  assert.deepEqual(path[0], from);
  assert.deepEqual(path[path.length - 1], to);
  for (const point of path.slice(1, -1)) {
    const off = distanceToPath({ lat: point[0], lng: point[1] }, road);
    assert.ok(off < 400, `point ${off} m off the road network`);
  }
});

test("offline router gives up far from any known road", () => {
  const from: LatLngPair = [14.5995, 120.9842];
  const to = at(50);
  assert.equal(localRoadPath(from, to), null);
  assert.ok(getDistanceMeters({ lat: from[0], lng: from[1] }, { lat: to[0], lng: to[1] }) > 1000);
});
