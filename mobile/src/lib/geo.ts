export type LatLon = { lat: number; lon: number };

export const INDIA_CENTER: LatLon & { name: string } = { lat: 22.5, lon: 79, name: "India" };

// Great-circle distance in km (haversine).
export function distanceKm(a: LatLon, b: LatLon) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function formatCoords({ lat, lon }: LatLon) {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
}

export function timeAgo(ms: number, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - ms) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Satellite thumbnail for any point: one Esri World Imagery tile (free, attribution required).
export function satelliteThumb({ lat, lon }: LatLon, zoom = 6) {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
}

// Simplified outline of India as [lon, lat]; used only to sort events into the "India" tab.
const INDIA: [number, number][] = [
  [68.2, 23.6], [69.5, 24.3], [71.0, 24.4], [70.3, 25.7], [69.6, 27.0], [71.0, 27.9], [72.8, 29.9],
  [73.9, 30.4], [74.6, 31.1], [74.6, 32.3], [74.0, 33.0], [73.9, 34.4], [74.3, 35.0], [75.9, 36.0],
  [77.8, 35.5], [78.9, 34.3], [78.8, 32.5], [79.6, 31.0], [80.9, 30.2], [80.1, 28.8], [82.0, 27.9],
  [84.0, 27.4], [85.8, 26.6], [88.1, 26.4], [88.9, 27.3], [89.8, 26.8], [92.0, 26.9], [91.6, 27.8],
  [94.6, 29.3], [96.2, 29.2], [97.3, 28.2], [96.5, 27.1], [95.2, 26.5], [94.6, 25.1], [94.2, 23.8],
  [93.4, 22.3], [92.6, 21.9], [92.3, 23.8], [91.4, 24.1], [92.4, 25.0], [89.9, 25.3], [89.0, 26.0],
  [88.4, 25.2], [88.9, 24.2], [88.7, 22.9], [89.0, 21.6], [87.0, 21.5], [86.8, 20.5], [85.2, 19.5],
  [84.1, 18.3], [82.3, 16.6], [81.2, 16.0], [80.3, 15.5], [80.1, 13.6], [80.3, 12.9], [79.8, 11.5],
  [79.9, 10.3], [79.3, 10.3], [78.2, 8.9], [77.5, 8.1], [76.6, 8.9], [76.0, 10.5], [75.5, 12.0],
  [74.8, 12.9], [74.4, 14.5], [73.4, 16.5], [72.8, 19.0], [72.7, 21.1], [72.6, 21.0], [71.0, 20.8],
  [70.0, 21.0], [69.0, 22.3], [70.4, 22.9], [68.4, 23.5],
];

// Ray-casting point-in-polygon, plus a margin so coastal / offshore events (e.g. cyclones in the
// Bay of Bengal, quakes in the Andaman Sea) still count as "India".
export function isInIndia({ lat, lon }: LatLon, marginKm = 250) {
  let inside = false;
  for (let i = 0, j = INDIA.length - 1; i < INDIA.length; j = i++) {
    const [xi, yi] = INDIA[i];
    const [xj, yj] = INDIA[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  if (inside) return true;
  return INDIA.some(([x, y]) => distanceKm({ lat, lon }, { lat: y, lon: x }) < marginKm);
}
