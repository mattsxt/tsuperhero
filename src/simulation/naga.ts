export const NAGA_BOUNDS = { minLat: 13.57, maxLat: 13.68, minLng: 123.15, maxLng: 123.3 };

export function inNaga(point: { lat: number; lng: number }): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= NAGA_BOUNDS.minLat &&
    point.lat <= NAGA_BOUNDS.maxLat &&
    point.lng >= NAGA_BOUNDS.minLng &&
    point.lng <= NAGA_BOUNDS.maxLng
  );
}
