// Shared geo math (client + server). Routes in this app are simplified as
// straight lines (origin -> downtown garage), so straight-line (haversine)
// distance is consistent with the rest of the simulation rather than real
// road routing.

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: [number, number], b: [number, number]): number {
  const [lngA, latA] = a;
  const [lngB, latB] = b;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function etaMinutes(distanceKm: number, speedKmh: number): number {
  const safeSpeed = speedKmh > 1 ? speedKmh : 1;
  return (distanceKm / safeSpeed) * 60;
}
