import { useQuery } from "@tanstack/react-query";
import type { HazardType, Severity } from "../lib/hazards";
import { settings } from "../lib/storage";

// Live disaster events from two free, key-less, CORS-enabled feeds:
//  - USGS earthquakes (past 7 days, magnitude 2.5+)  https://earthquake.usgs.gov/earthquakes/feed/
//  - NASA EONET open natural events (past 30 days)  https://eonet.gsfc.nasa.gov/docs/v3
export type DisasterEvent = {
  id: string;
  type: HazardType;
  title: string; // display name, e.g. "Earthquake M 5.4" or "Tropical Cyclone 01B"
  place: string; // where: USGS place text, or coordinates for NASA events (EONET has no place names)
  lat: number;
  lon: number;
  time: number; // ms since epoch
  severity: Severity;
  detail: string; // e.g. "M 5.4 · 10 km deep"
  magnitude?: number; // earthquakes only
  source: "USGS" | "NASA EONET";
  url: string;
};

const USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson";
const EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30";

type UsgsFeature = {
  id: string;
  properties: { mag: number; place: string | null; time: number; url: string; title: string };
  geometry: { coordinates: [number, number, number] };
};

// Magnitude bands follow common USGS wording: 6+ strong, 5+ moderate.
function quakeSeverity(mag: number): Severity {
  if (mag >= 6) return "High";
  if (mag >= 5) return "Moderate";
  return "Low";
}

async function fetchQuakes(signal?: AbortSignal): Promise<DisasterEvent[]> {
  const res = await fetch(USGS_URL, { signal });
  if (!res.ok) throw new Error(`USGS ${res.status}`);
  const data = (await res.json()) as { features: UsgsFeature[] };
  return data.features.map((f) => {
    const [lon, lat, depth] = f.geometry.coordinates;
    const mag = f.properties.mag;
    return {
      id: `usgs-${f.id}`,
      type: "earthquake" as const,
      title: `Earthquake M ${mag.toFixed(1)}`,
      place: f.properties.place ?? "Unknown location",
      lat,
      lon,
      time: f.properties.time,
      severity: quakeSeverity(mag),
      detail: `M ${mag.toFixed(1)} · ${Math.round(depth)} km deep`,
      magnitude: mag,
      source: "USGS" as const,
      url: f.properties.url,
    };
  });
}

type EonetEvent = {
  id: string;
  title: string;
  link: string;
  categories: { id: string }[];
  sources: { url: string }[];
  geometry: { date: string; type: string; coordinates: number[] | number[][][]; magnitudeValue: number | null; magnitudeUnit: string | null }[];
};

function eonetType(category: string, title: string): HazardType | null {
  switch (category) {
    case "wildfires": return "wildfire";
    case "volcanoes": return "volcano";
    case "floods": return "flood";
    case "landslides": return "landslide";
    case "earthquakes": return "earthquake";
    case "severeStorms": return /cyclone|typhoon|hurricane|tropical|storm/i.test(title) ? "cyclone" : "weather";
    case "tempExtremes":
    case "drought":
    case "dustHaze":
    case "snow":
      return "weather";
    default:
      return null; // sea/lake ice, water colour, man-made: not disasters for this app
  }
}

function eonetSeverity(type: HazardType, value: number | null, unit: string | null): Severity {
  // Storm wind in knots: 64+ kt is hurricane/typhoon strength, 34+ kt a named tropical storm.
  if (type === "cyclone" && unit === "kts" && value != null) return value >= 64 ? "High" : value >= 34 ? "Moderate" : "Watch";
  // Fire size in acres, when EONET provides it.
  if (type === "wildfire" && unit === "acres" && value != null) return value >= 10000 ? "High" : value >= 1000 ? "Moderate" : "Low";
  if (type === "flood" || type === "landslide") return "Moderate";
  return "Watch";
}

function centroid(coords: number[] | number[][][]): [number, number] {
  if (typeof coords[0] === "number") return coords as [number, number];
  const ring = (coords as number[][][])[0];
  const sum = ring.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
  return [sum[0] / ring.length, sum[1] / ring.length];
}

async function fetchEonet(signal?: AbortSignal): Promise<DisasterEvent[]> {
  const res = await fetch(EONET_URL, { signal });
  if (!res.ok) throw new Error(`EONET ${res.status}`);
  const data = (await res.json()) as { events: EonetEvent[] };
  return data.events.flatMap((e) => {
    const type = eonetType(e.categories[0]?.id ?? "", e.title);
    const last = e.geometry.at(-1);
    if (!type || !last) return [];
    const [lon, lat] = centroid(last.coordinates);
    const detail = last.magnitudeValue != null ? `${Math.round(last.magnitudeValue).toLocaleString()} ${last.magnitudeUnit ?? ""}`.trim() : "Open event";
    return [{
      id: `eonet-${e.id}`,
      type,
      title: e.title,
      place: `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? "E" : "W"}`,
      lat,
      lon,
      time: Date.parse(last.date),
      severity: eonetSeverity(type, last.magnitudeValue, last.magnitudeUnit),
      detail,
      source: "NASA EONET" as const,
      url: e.sources[0]?.url ?? e.link,
    }];
  });
}

// Title for the place page opened from an event: the town for quakes, the event name otherwise.
export function eventPageName(e: DisasterEvent) {
  return e.type === "earthquake" ? e.place : e.title;
}

export async function fetchAllEvents(signal?: AbortSignal) {
  // One feed failing should not hide the other.
  const [quakes, eonet] = await Promise.allSettled([fetchQuakes(signal), fetchEonet(signal)]);
  const events = [
    ...(quakes.status === "fulfilled" ? quakes.value : []),
    ...(eonet.status === "fulfilled" ? eonet.value : []),
  ];
  if (quakes.status === "rejected" && eonet.status === "rejected") throw new Error("Disaster feeds unavailable");
  return events.sort((a, b) => b.time - a.time);
}

export function useEvents() {
  const refreshMinutes = settings.use().refreshMinutes;
  return useQuery({
    queryKey: ["events"],
    queryFn: ({ signal }) => fetchAllEvents(signal),
    staleTime: refreshMinutes * 60_000,
    refetchInterval: refreshMinutes * 60_000,
  });
}
