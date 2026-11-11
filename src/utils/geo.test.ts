import { test } from "node:test";
import assert from "node:assert/strict";
import {
  choosePathFor,
  nearestServedPoint,
  matchRoutes,
  nearestPointOnPath,
  pathLengthMeters,
  rideProgress,
  reachedDropoff,
  rideStats,
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

test("choosePathFor picks the single path closest to both points", () => {
  const unrelated: LatLngPair[] = [
    [14.7, 121.0],
    [14.7, 121.02],
  ];
  const a = offNorth(121.002, 0);
  const b = offNorth(121.018, 0);
  assert.deepEqual(choosePathFor([unrelated, P], a, b), P);
  assert.equal(choosePathFor([], a, b), null);
});

test("rideStats measures progress and remaining distance from A to B", () => {
  const a = offNorth(121.002, 0);
  const b = offNorth(121.018, 0);
  const total = nearestPointOnPath(b, P).alongMeters - nearestPointOnPath(a, P).alongMeters;
  const stats = rideStats(P, a, b, offNorth(121.01, 20));
  near(stats.progress, 0.5, 0.01);
  near(stats.remainingMeters, total / 2, 5);
  near(nearestPointOnPath({ lat: stats.ahead.at(-1)![0], lng: stats.ahead.at(-1)![1] }, P).alongMeters,
    nearestPointOnPath(b, P).alongMeters, 2);
  near(nearestPointOnPath({ lat: stats.travelled[0][0], lng: stats.travelled[0][1] }, P).alongMeters,
    nearestPointOnPath(a, P).alongMeters, 2);
});

test("rideStats without a position shows the whole ride ahead", () => {
  const a = offNorth(121.002, 0);
  const b = offNorth(121.018, 0);
  const stats = rideStats(P, a, b, null);
  assert.equal(stats.progress, 0);
  assert.deepEqual(stats.travelled, []);
  near(stats.remainingMeters, stats.totalMeters, 0.001);
});

test("reachedDropoff ignores a straight-line pass near B earlier on the route", () => {
  // Out-and-back path: B sits beside the outbound leg, but is reached on the way back.
  const outAndBack: LatLngPair[] = [
    [14.6, 121.0],
    [14.6, 121.02],
    [14.6003, 121.02],
    [14.6003, 121.0],
  ];
  const a = { lat: 14.6, lng: 121.0 };
  const b = { lat: 14.6003, lng: 121.01 };
  const outbound = { lat: 14.6, lng: 121.01 };
  const stats = rideStats(outAndBack, a, b, outbound);
  assert.equal(reachedDropoff(stats, outbound, b), false);
});

test("reachedDropoff fires within 50 m of B along the route", () => {
  const a = offNorth(121.002, 0);
  const b = offNorth(121.018, 0);
  const here = offNorth(121.0177, 0);
  assert.equal(reachedDropoff(rideStats(P, a, b, here), here, b), true);
});

test("reachedDropoff fires once the ride has passed B", () => {
  const a = offNorth(121.002, 0);
  const b = offNorth(121.01, 0);
  const past = offNorth(121.019, 0);
  assert.equal(reachedDropoff(rideStats(P, a, b, past), past, b), true);
});

test("reachedDropoff falls back to straight-line distance without a path", () => {
  const b = offNorth(121.01, 0);
  assert.equal(reachedDropoff(null, offNorth(121.01, 40), b), true);
  assert.equal(reachedDropoff(null, offNorth(121.01, 80), b), false);
});

test("nearestServedPoint skips a closer waiting area whose route never reaches B", () => {
  // Route X runs east along 14.6 but stops at 121.01; route Y runs 700 m north
  // and reaches B at 121.018.
  const routeX: LatLngPair[] = [
    [14.6, 121.0],
    [14.6, 121.01],
  ];
  const routeY: LatLngPair[] = [
    [14.6063, 121.0],
    [14.6063, 121.02],
  ];
  const routes = [
    { routeId: "x", paths: [routeX] },
    { routeId: "y", paths: [routeY] },
  ];
  const place = { lat: 14.6005, lng: 121.002 };
  const onX = { id: "on-x", lat: 14.6, lng: 121.002 };
  const onY = { id: "on-y", lat: 14.6063, lng: 121.002 };
  const b = { lat: 14.6063, lng: 121.018 };
  assert.equal(nearestServedPoint(place, [onX, onY], b, routes)?.id, "on-y");
  assert.equal(nearestServedPoint(place, [onX], b, routes), null);
});
