import { useQuery } from "@tanstack/react-query";
import { distanceKm, type LatLon } from "../lib/geo";

// Nearby hospitals from OpenStreetMap via the Overpass API (free, no key).
// Driving routes from the public OSRM server (free, no key; fine for light use).
export type Hospital = { id: string; name: string; lat: number; lon: number; km: number; phone?: string; emergency?: boolean };

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

export async function fetchHospitals(at: LatLon, radiusM = 8000, signal?: AbortSignal): Promise<Hospital[]> {
  const q = `[out:json][timeout:20];nwr["amenity"="hospital"](around:${radiusM},${at.lat},${at.lon});out center tags 40;`;
  let lastError: unknown;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, { method: "POST", body: new URLSearchParams({ data: q }), signal });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const data = (await res.json()) as {
        elements: { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[];
      };
      return data.elements
        .map((e) => {
          const p = e.center ?? { lat: e.lat!, lon: e.lon! };
          const t = e.tags ?? {};
          return {
            id: `${e.type}-${e.id}`,
            name: t["name:en"] || t.name || "Hospital",
            lat: p.lat,
            lon: p.lon,
            km: distanceKm(at, p),
            phone: t.phone || t["contact:phone"],
            emergency: t.emergency === "yes",
          };
        })
        .filter((h) => Number.isFinite(h.lat))
        .sort((a, b) => a.km - b.km);
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err; // try the next server
    }
  }
  throw lastError;
}

export function useHospitals(at: LatLon | null) {
  return useQuery({
    queryKey: ["hospitals", at?.lat.toFixed(3), at?.lon.toFixed(3)],
    queryFn: ({ signal }) => fetchHospitals(at!, 8000, signal),
    enabled: !!at,
    staleTime: 30 * 60_000,
    retry: 1,
  });
}

export type Route = { km: number; minutes: number; line: [number, number][] };

export async function fetchRoute(from: LatLon, to: LatLon, signal?: AbortSignal): Promise<Route> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Route ${res.status}`);
  const d = (await res.json()) as { code: string; routes: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };
  const r = d.routes[0];
  if (d.code !== "Ok" || !r) throw new Error("No route");
  return { km: r.distance / 1000, minutes: r.duration / 60, line: r.geometry.coordinates.map(([lon, lat]) => [lat, lon]) };
}

export function useRoute(from: LatLon | null, to: LatLon | null) {
  return useQuery({
    queryKey: ["route", from?.lat.toFixed(4), from?.lon.toFixed(4), to?.lat.toFixed(4), to?.lon.toFixed(4)],
    queryFn: ({ signal }) => fetchRoute(from!, to!, signal),
    enabled: !!from && !!to,
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

// Opens turn-by-turn directions in the phone's maps app.
export function directionsUrl(to: LatLon) {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lon}&travelmode=driving`;
}
