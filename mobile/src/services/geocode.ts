// Place search: Open-Meteo geocoding (free, no key). https://open-meteo.com/en/docs/geocoding-api
export type PlaceResult = { id: number; name: string; lat: number; lon: number; region: string };

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  if (query.trim().length < 2) return [];
  const params = new URLSearchParams({ name: query.trim(), count: "8", language: "en", format: "json" });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal });
  if (!res.ok) throw new Error(`Search ${res.status}`);
  const data = (await res.json()) as {
    results?: { id: number; name: string; latitude: number; longitude: number; admin1?: string; country?: string }[];
  };
  return (data.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    lat: r.latitude,
    lon: r.longitude,
    region: [r.admin1, r.country].filter(Boolean).join(", "),
  }));
}

// Name for the phone's own position: BigDataCloud's free client-side reverse geocoder (no key).
export async function nameForPosition(lat: number, lon: number): Promise<string> {
  try {
    const params = new URLSearchParams({ latitude: String(lat), longitude: String(lon), localityLanguage: "en" });
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`);
    const d = (await res.json()) as { city?: string; locality?: string; principalSubdivision?: string };
    return d.city || d.locality || d.principalSubdivision || "My location";
  } catch {
    return "My location";
  }
}

// Full street-style address for the SOS screen (BigDataCloud, free client-side endpoint).
export async function addressForPosition(lat: number, lon: number): Promise<string[]> {
  try {
    const params = new URLSearchParams({ latitude: String(lat), longitude: String(lon), localityLanguage: "en" });
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`);
    const d = (await res.json()) as { locality?: string; city?: string; principalSubdivision?: string; postcode?: string; countryName?: string };
    const first = [d.locality, d.city].filter((v, i, a) => v && a.indexOf(v) === i).join(", ");
    const second = [d.principalSubdivision, d.postcode].filter(Boolean).join(", ");
    return [first, second, d.countryName ?? ""].filter(Boolean);
  } catch {
    return [];
  }
}

// Ask the phone for its location. Resolves null if the user says no or it times out.
export function getMyPosition(precise = false): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      // SOS asks for a fresh, precise fix; everything else is happy with a rough, recent one.
      precise ? { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 } : { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60_000 },
    );
  });
}
