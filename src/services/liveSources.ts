export type ImageryLayer = {
  id: string;
  title: string;
  kind: 'base' | 'overlay';
  source_type: 'raster' | 'vector';
  source_layers: string[];
  date_min: string;
  date_max: string;
  default_date: string;
  date_intervals: { start: string; end: string; period: string }[];
  tiles: string;
  format: string;
  tile_matrix_set: string;
  maxzoom: number;
  tile_size: number;
  attribution: string;
};

export type ImageryCatalog = {
  status: 'available' | 'stale';
  provider: string;
  fetched_at: string;
  stale: boolean;
  attribution: string;
  capabilities_url: string;
  notice: string;
  layers: ImageryLayer[];
};

export type LiveProviders = {
  nasa: { configured: boolean; imagery_requires_key: boolean };
  windy: { configured: boolean; maps_key: string };
};

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export async function fetchLiveSource<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiBase}/api/live/${path}`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Live source unavailable');
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Live API unavailable');
  return response.json() as Promise<T>;
}

export function imageryDateAvailable(layer: ImageryLayer, date: string) {
  return date >= layer.date_min && date <= layer.date_max
    && layer.date_intervals.some(interval => date >= interval.start && date <= interval.end);
}
