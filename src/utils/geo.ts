export type Coordinates = { lat: number; lng: number };
type LatLngPair = [number, number];

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

function getSegmentDistanceMeters(
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
  const along = lengthSquared
    ? Math.max(0, Math.min(1, (pointX * endX + pointY * endY) / lengthSquared))
    : 0;
  return Math.hypot(pointX - endX * along, pointY - endY * along);
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
