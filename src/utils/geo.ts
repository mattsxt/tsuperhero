export type Coordinates = { lat: number; lng: number };
export type LatLngPair = [number, number];

const earthRadiusMeters = 6_371_000;
const metersPerLatitude = 111_320;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function getDistanceMeters(from: Coordinates, to: Coordinates) {
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(lngDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(a));
}

export function getPairDistanceMeters(
  [fromLat, fromLng]: LatLngPair,
  [toLat, toLng]: LatLngPair,
) {
  return getDistanceMeters(
    { lat: fromLat, lng: fromLng },
    { lat: toLat, lng: toLng },
  );
}

function projectOntoSegment(
  point: Coordinates,
  [startLat, startLng]: LatLngPair,
  [endLat, endLng]: LatLngPair,
) {
  const metersPerLongitude = metersPerLatitude * Math.cos(toRadians(point.lat));
  const pointX = (point.lng - startLng) * metersPerLongitude;
  const pointY = (point.lat - startLat) * metersPerLatitude;
  const endX = (endLng - startLng) * metersPerLongitude;
  const endY = (endLat - startLat) * metersPerLatitude;
  const lengthSquared = endX * endX + endY * endY;
  const t = lengthSquared
    ? Math.max(0, Math.min(1, (pointX * endX + pointY * endY) / lengthSquared))
    : 0;
  return {
    t,
    distanceMeters: Math.hypot(pointX - endX * t, pointY - endY * t),
    point: {
      lat: startLat + (endLat - startLat) * t,
      lng: startLng + (endLng - startLng) * t,
    },
  };
}

function getSegmentDistanceMeters(
  point: Coordinates,
  start: LatLngPair,
  end: LatLngPair,
) {
  return projectOntoSegment(point, start, end).distanceMeters;
}

export function distanceToPath(point: Coordinates, path: LatLngPair[]) {
  if (path.length === 1)
    return getPairDistanceMeters([point.lat, point.lng], path[0]);
  return path
    .slice(1)
    .reduce(
      (closest, end, index) =>
        Math.min(closest, getSegmentDistanceMeters(point, path[index], end)),
      Infinity,
    );
}

export function isNearPath(
  point: Coordinates,
  path: LatLngPair[],
  maxMeters: number,
) {
  return path
    .slice(1)
    .some(
      (end, index) =>
        getSegmentDistanceMeters(point, path[index], end) <= maxMeters,
    );
}

export type PathSnap = {
  point: Coordinates;
  distanceMeters: number;
  segmentIndex: number;
  alongMeters: number;
};

export function pathLengthMeters(path: LatLngPair[]) {
  return path
    .slice(1)
    .reduce((total, end, index) => total + getPairDistanceMeters(path[index], end), 0);
}

export function nearestPointOnPath(
  point: Coordinates,
  path: LatLngPair[],
): PathSnap {
  if (path.length === 1) {
    const [lat, lng] = path[0];
    return {
      point: { lat, lng },
      distanceMeters: getDistanceMeters(point, { lat, lng }),
      segmentIndex: 0,
      alongMeters: 0,
    };
  }
  let best: PathSnap | null = null;
  let segmentStartAlong = 0;
  for (let index = 0; index < path.length - 1; index++) {
    const segmentLength = getPairDistanceMeters(path[index], path[index + 1]);
    const projection = projectOntoSegment(point, path[index], path[index + 1]);
    if (!best || projection.distanceMeters < best.distanceMeters) {
      best = {
        point: projection.point,
        distanceMeters: projection.distanceMeters,
        segmentIndex: index,
        alongMeters: segmentStartAlong + projection.t * segmentLength,
      };
    }
    segmentStartAlong += segmentLength;
  }
  return best!;
}

function pointAtAlong(path: LatLngPair[], along: number): LatLngPair {
  let segmentStartAlong = 0;
  for (let index = 0; index < path.length - 1; index++) {
    const segmentLength = getPairDistanceMeters(path[index], path[index + 1]);
    if (along <= segmentStartAlong + segmentLength || index === path.length - 2) {
      const t = segmentLength
        ? Math.max(0, Math.min(1, (along - segmentStartAlong) / segmentLength))
        : 0;
      const [startLat, startLng] = path[index];
      const [endLat, endLng] = path[index + 1];
      return [startLat + (endLat - startLat) * t, startLng + (endLng - startLng) * t];
    }
    segmentStartAlong += segmentLength;
  }
  return path[0];
}

export function sliceAlong(
  path: LatLngPair[],
  fromAlong: number,
  toAlong: number,
): LatLngPair[] {
  if (path.length < 2) return [...path];
  if (fromAlong > toAlong) return sliceAlong(path, toAlong, fromAlong).reverse();
  const total = pathLengthMeters(path);
  const from = Math.max(0, Math.min(total, fromAlong));
  const to = Math.max(0, Math.min(total, toAlong));
  const slice: LatLngPair[] = [pointAtAlong(path, from)];
  let vertexAlong = 0;
  for (let index = 1; index < path.length; index++) {
    vertexAlong += getPairDistanceMeters(path[index - 1], path[index]);
    if (vertexAlong > from && vertexAlong < to) slice.push(path[index]);
  }
  slice.push(pointAtAlong(path, to));
  return slice;
}

export function rideProgress(alongA: number, alongB: number, alongNow: number) {
  const total = Math.abs(alongB - alongA);
  if (!total) return 1;
  const covered = (alongNow - alongA) * Math.sign(alongB - alongA);
  return Math.max(0, Math.min(1, covered / total));
}

export type RouteCandidate = { routeId: string; paths: LatLngPair[][] };

export type RouteMatch = {
  routeId: string;
  path: LatLngPair[];
  pickup: PathSnap;
  dropoff: PathSnap;
  walkMeters: number;
  rideMeters: number;
};

const walkCostPerMeter = (2 * 3600) / 5000;
const rideCostPerMeter = 3600 / 18000;

export function matchRoutes(
  a: Coordinates,
  b: Coordinates,
  routes: RouteCandidate[],
  maxMeters = 500,
  minRideMeters = 50,
  maxDropoffMeters = Infinity,
): RouteMatch[] {
  const score = (match: RouteMatch) =>
    (match.walkMeters + match.dropoff.distanceMeters) * walkCostPerMeter +
    match.rideMeters * rideCostPerMeter;
  return routes
    .map((route) =>
      route.paths
        .filter((path) => path.length > 1)
        .map((path): RouteMatch => {
          const pickup = nearestPointOnPath(a, path);
          const dropoff = nearestPointOnPath(b, path);
          return {
            routeId: route.routeId,
            path,
            pickup,
            dropoff,
            walkMeters: pickup.distanceMeters,
            rideMeters: Math.abs(dropoff.alongMeters - pickup.alongMeters),
          };
        })
        .filter(
          (match) =>
            match.pickup.distanceMeters <= maxMeters &&
            match.dropoff.distanceMeters <= maxDropoffMeters &&
            match.rideMeters >= minRideMeters,
        )
        .sort((x, y) => score(x) - score(y))[0],
    )
    .filter((match): match is RouteMatch => match !== undefined)
    .sort((x, y) => score(x) - score(y));
}

export function choosePathFor(
  paths: LatLngPair[][],
  a: Coordinates,
  b: Coordinates,
): LatLngPair[] | null {
  let best: { path: LatLngPair[]; worst: number } | null = null;
  for (const path of paths) {
    if (path.length < 2) continue;
    const worst = Math.max(
      nearestPointOnPath(a, path).distanceMeters,
      nearestPointOnPath(b, path).distanceMeters,
    );
    if (!best || worst < best.worst) best = { path, worst };
  }
  return best?.path ?? null;
}

export type RideStats = {
  totalMeters: number;
  remainingMeters: number;
  progress: number;
  travelled: LatLngPair[];
  ahead: LatLngPair[];
};

export function rideStats(
  path: LatLngPair[],
  a: Coordinates,
  b: Coordinates,
  position: Coordinates | null,
): RideStats {
  const alongA = nearestPointOnPath(a, path).alongMeters;
  const alongB = nearestPointOnPath(b, path).alongMeters;
  const totalMeters = Math.abs(alongB - alongA);
  if (!position) {
    return {
      totalMeters,
      remainingMeters: totalMeters,
      progress: 0,
      travelled: [],
      ahead: sliceAlong(path, alongA, alongB),
    };
  }
  const progress = rideProgress(
    alongA,
    alongB,
    nearestPointOnPath(position, path).alongMeters,
  );
  const alongNow = alongA + (alongB - alongA) * progress;
  return {
    totalMeters,
    remainingMeters: totalMeters * (1 - progress),
    progress,
    travelled: sliceAlong(path, alongA, alongNow),
    ahead: sliceAlong(path, alongNow, alongB),
  };
}

export const dropoffArrivalMeters = 50;

export function reachedDropoff(
  stats: RideStats | null,
  position: Coordinates,
  dropoff: Coordinates,
) {
  if (stats) return stats.remainingMeters <= dropoffArrivalMeters;
  return getDistanceMeters(position, dropoff) <= dropoffArrivalMeters;
}

export function nearestServedPoint<T extends Coordinates>(
  origin: Coordinates,
  candidates: T[],
  dropoff: Coordinates,
  routes: RouteCandidate[],
): T | null {
  return (
    candidates
      .map((candidate) => ({
        candidate,
        meters: getDistanceMeters(origin, candidate),
      }))
      .sort((a, b) => a.meters - b.meters)
      .find(
        ({ candidate }) =>
          matchRoutes(candidate, dropoff, routes, 500, 50, 500).length > 0,
      )
      ?.candidate ?? null
  );
}

export function straightRideStats(
  a: Coordinates,
  b: Coordinates,
  position: Coordinates | null,
): RideStats {
  const totalMeters = getDistanceMeters(a, b);
  const toPair = (point: Coordinates): LatLngPair => [point.lat, point.lng];
  if (!position) {
    return {
      totalMeters,
      remainingMeters: totalMeters,
      progress: 0,
      travelled: [],
      ahead: [toPair(a), toPair(b)],
    };
  }
  const remainingMeters = Math.min(totalMeters, getDistanceMeters(position, b));
  return {
    totalMeters,
    remainingMeters,
    progress: totalMeters ? 1 - remainingMeters / totalMeters : 1,
    travelled: [toPair(a), toPair(position)],
    ahead: [toPair(position), toPair(b)],
  };
}

export function snapToPaths(
  point: Coordinates,
  paths: LatLngPair[][],
): PathSnap | null {
  return (
    paths
      .filter((path) => path.length > 0)
      .map((path) => nearestPointOnPath(point, path))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] ?? null
  );
}

export const dropoffOnRouteMeters = 50;

export function pickRouteChoices<T extends Pick<RouteMatch, "dropoff">>(
  matches: T[],
  max = 3,
): T[] {
  const passing = matches.filter(
    (match) => match.dropoff.distanceMeters <= dropoffOnRouteMeters,
  );
  return passing.length ? passing.slice(0, max) : matches.slice(0, 1);
}

export type TimedPosition = Coordinates & { at: number };

export function shouldRefreshPosition(
  previous: TimedPosition | null,
  next: TimedPosition,
  minMeters = 3,
  maxAgeMs = 5_000,
) {
  if (!previous) return true;
  return (
    next.at - previous.at >= maxAgeMs ||
    getDistanceMeters(previous, next) >= minMeters
  );
}


export function createPositionThrottle(minMeters = 3, maxAgeMs = 5_000) {
  let shown: TimedPosition | null = null;
  return (next: TimedPosition) => {
    if (!shouldRefreshPosition(shown, next, minMeters, maxAgeMs)) return false;
    shown = next;
    return true;
  };
}
