import {
  pathLengthMeters,
  pointAtAlong,
  type LatLngPair,
} from "@/utils/geo";

export type Mover = {
  id: string;
  path: LatLngPair[];
  along: number;
  speedKmh: number;
  onArrive?: () => void;
};

export type MoverPosition = { lat: number; lng: number; heading: number };

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const bearing = (from: LatLngPair, to: LatLngPair): number => {
  const [lat1, lng1] = from.map(toRadians);
  const [lat2, lng2] = to.map(toRadians);
  const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

const lengthOf = (mover: Mover): number => pathLengthMeters(mover.path);

export const advance = (mover: Mover, seconds: number): Mover => {
  const total = lengthOf(mover);
  if (mover.along >= total) return mover;
  const along = Math.min(total, mover.along + (mover.speedKmh * seconds) / 3.6);
  const next = { ...mover, along };
  if (along >= total) mover.onArrive?.();
  return next;
};

export const positionOf = (mover: Mover): MoverPosition => {
  const { path, along } = mover;
  if (path.length === 0) return { lat: 0, lng: 0, heading: 0 };
  const [lat, lng] = path.length > 1 ? pointAtAlong(path, along) : path[0];
  if (path.length < 2) return { lat, lng, heading: 0 };
  const total = pathLengthMeters(path);
  const ahead = pointAtAlong(path, Math.min(total, along + 5));
  const behind = pointAtAlong(path, Math.max(0, along - 5));
  const from = along + 5 <= total ? ([lat, lng] as LatLngPair) : behind;
  const to = along + 5 <= total ? ahead : ([lat, lng] as LatLngPair);
  return { lat, lng, heading: bearing(from, to) };
};
