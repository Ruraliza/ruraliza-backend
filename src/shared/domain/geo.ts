// Distância em linha reta entre dois pontos (graus decimais, WGS84), em km (fórmula de haversine).
// Serve para "perto de você"; a distância pela estrada é maior.
export interface Point {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

export function distanceKm(a: Point, b: Point): number {
  const rad = (degrees: number): number => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
