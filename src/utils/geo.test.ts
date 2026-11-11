import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchRoutes,
  nearestPointOnPath,
  pathLengthMeters,
  rideProgress,
  sliceAlong,
  type LatLngPair,
} from "./geo.ts";

const P: LatLngPair[] = [
  [14.6, 121.0],
  [14.6, 121.01],
  [14.6, 121.02],
];
const metersPerDegLat = 111_320;
const near = (actual: number, expected: number, tolerance: number) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );

test("nearestPointOnPath projects a point onto the segment", () => {
  const snap = nearestPointOnPath({ lat: 14.601, lng: 121.005 }, P);
  near(snap.point.lat, 14.6, 1e-6);
  near(snap.point.lng, 121.005, 1e-6);
  near(snap.distanceMeters, 111, 2);
  assert.equal(snap.segmentIndex, 0);
  near(snap.alongMeters, 538, 5);
});

test("nearestPointOnPath clamps to the path start", () => {
  const snap = nearestPointOnPath({ lat: 14.6, lng: 120.99 }, P);
  assert.deepEqual(snap.point, { lat: 14.6, lng: 121.0 });
  assert.equal(snap.alongMeters, 0);
});

test("nearestPointOnPath measures along past the first segment", () => {
  const snap = nearestPointOnPath({ lat: 14.6, lng: 121.015 }, P);
  assert.equal(snap.segmentIndex, 1);
  assert.ok(snap.alongMeters > 1076);
});

test("pathLengthMeters sums segment lengths", () => {
  near(pathLengthMeters(P), 2152, 10);
});

test("sliceAlong cuts between two along distances", () => {
  const slice = sliceAlong(P, 500, 1500);
  const first = { lat: slice[0][0], lng: slice[0][1] };
  const last = { lat: slice.at(-1)![0], lng: slice.at(-1)![1] };
  near(nearestPointOnPath(first, P).alongMeters, 500, 2);
  near(nearestPointOnPath(last, P).alongMeters, 1500, 2);
  assert.ok(slice.some(([lat, lng]) => lat === P[1][0] && lng === P[1][1]));
});

test("sliceAlong reverses when from is after to", () => {
  assert.deepEqual(sliceAlong(P, 1500, 500), sliceAlong(P, 500, 1500).reverse());
});

test("rideProgress works in both directions and clamps", () => {
  assert.equal(rideProgress(0, 1000, 500), 0.5);
  assert.equal(rideProgress(1000, 0, 750), 0.25);
  assert.equal(rideProgress(0, 1000, -50), 0);
  assert.equal(rideProgress(0, 1000, 2000), 1);
});

const offNorth = (lng: number, meters: number) => ({
  lat: 14.6 + meters / metersPerDegLat,
  lng,
});

test("matchRoutes returns nothing when points are far from every route", () => {
  const matches = matchRoutes(offNorth(121.002, 800), offNorth(121.018, 800), [
    { routeId: "r1", paths: [P] },
  ]);
  assert.deepEqual(matches, []);
});

test("matchRoutes snaps pickup and dropoff onto a nearby route", () => {
  const matches = matchRoutes(offNorth(121.002, 100), offNorth(121.018, 200), [
    { routeId: "r1", paths: [P] },
  ]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].routeId, "r1");
  near(matches[0].pickup.point.lat, 14.6, 1e-6);
  near(matches[0].walkMeters, 100, 2);
});

test("matchRoutes sorts the closer route first", () => {
  const farther: LatLngPair[] = P.map(([lat, lng]) => [lat + 300 / metersPerDegLat, lng]);
  const matches = matchRoutes(offNorth(121.002, 0), offNorth(121.018, 0), [
    { routeId: "far", paths: [farther] },
    { routeId: "close", paths: [P] },
  ]);
  assert.deepEqual(
    matches.map((m) => m.routeId),
    ["close", "far"],
  );
});

test("matchRoutes honours the 500 m boundary", () => {
  const routes = [{ routeId: "r1", paths: [P] }];
  assert.equal(matchRoutes(offNorth(121.002, 499), offNorth(121.018, 0), routes).length, 1);
  assert.equal(matchRoutes(offNorth(121.002, 501), offNorth(121.018, 0), routes).length, 0);
});

test("matchRoutes never mixes main and alternative paths", () => {
  const westHalf: LatLngPair[] = [
    [14.6, 121.0],
    [14.6, 121.005],
  ];
  const eastHalf: LatLngPair[] = [
    [14.62, 121.015],
    [14.62, 121.02],
  ];
  const a = offNorth(121.002, 0);
  const b = { lat: 14.62, lng: 121.018 };
  assert.deepEqual(matchRoutes(a, b, [{ routeId: "r2", paths: [westHalf, eastHalf] }]), []);
});

test("matchRoutes can match on an alternative path", () => {
  const unrelated: LatLngPair[] = [
    [14.7, 121.0],
    [14.7, 121.02],
  ];
  const matches = matchRoutes(offNorth(121.002, 0), offNorth(121.018, 0), [
    { routeId: "r3", paths: [unrelated, P] },
  ]);
  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].path, P);
});

test("matchRoutes rejects a drop-off too close to the pickup", () => {
  const matches = matchRoutes(offNorth(121.002, 0), offNorth(121.00228, 0), [
    { routeId: "r1", paths: [P] },
  ]);
  assert.deepEqual(matches, []);
});
