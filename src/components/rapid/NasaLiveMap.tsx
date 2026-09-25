import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Crosshair, RefreshCw } from 'lucide-react';
import type { ImageryLayer } from '../../services/liveSources';
import type { Region } from './regions';

maplibregl.setWorkerUrl(workerUrl);

type Props = {
  layer: ImageryLayer;
  date: string;
  overlay?: ImageryLayer;
  opacity: number;
  selected: Region;
  reducedMotion: boolean;
};

function imageryStyle(layer: ImageryLayer, date: string, overlay?: ImageryLayer): StyleSpecification {
  const result: StyleSpecification = {
    version: 8,
    sources: {
      imagery: {
        type: 'raster', tiles: [layer.tiles.replace('{date}', date)],
        tileSize: layer.tile_size, maxzoom: layer.maxzoom,
        attribution: layer.attribution,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#121e27' } },
      { id: 'imagery', type: 'raster', source: 'imagery' },
    ],
  };
  if (overlay) {
    if (overlay.source_type === 'raster') {
      result.sources.hotspots = { type: 'raster', tiles: [overlay.tiles.replace('{date}', date)], tileSize: overlay.tile_size, maxzoom: overlay.maxzoom, attribution: overlay.attribution };
      result.layers.push({ id: 'hotspots', type: 'raster', source: 'hotspots', paint: { 'raster-opacity': 0.85 } });
    } else {
      result.sources.hotspots = { type: 'vector', tiles: [overlay.tiles.replace('{date}', date)], maxzoom: overlay.maxzoom, attribution: overlay.attribution };
      overlay.source_layers.forEach((sourceLayer, index) => {
        result.layers.push({ id: `hotspot-glow-${index}`, type: 'circle', source: 'hotspots', 'source-layer': sourceLayer, paint: { 'circle-color': '#ff5c22', 'circle-radius': 9, 'circle-blur': 0.8, 'circle-opacity': 0.5 } });
        result.layers.push({ id: `hotspot-dot-${index}`, type: 'circle', source: 'hotspots', 'source-layer': sourceLayer, paint: { 'circle-color': '#ff3e22', 'circle-radius': 3.5, 'circle-stroke-width': 1, 'circle-stroke-color': '#ffe47a', 'circle-opacity': 0.85 } });
      });
    }
  }
  return result;
}

export function NasaLiveMap({ layer, date, overlay, opacity, selected, reducedMotion }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const initial = useRef({ layer, date, overlay, selected });
  const opacityRef = useRef(opacity);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  opacityRef.current = opacity;

  useEffect(() => {
    if (!host.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: host.current,
        style: imageryStyle(initial.current.layer, initial.current.date, initial.current.overlay),
        center: [initial.current.selected.lng, initial.current.selected.lat],
        zoom: 4.2, minZoom: 1, maxZoom: 11,
      });
    } catch {
      setWebglUnavailable(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('error', () => setStatus('error'));
    map.on('idle', () => setStatus(current => current === 'error' ? current : 'ready'));
    map.on('style.load', () => {
      if (map.getLayer('hotspots')) map.setPaintProperty('hotspots', 'raster-opacity', opacityRef.current);
      map.getStyle().layers?.filter(item => item.id.startsWith('hotspot-')).forEach(item => map.setPaintProperty(item.id, 'circle-opacity', opacityRef.current * (item.id.startsWith('hotspot-glow-') ? 0.6 : 1)));
    });
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setStatus('loading');
    map.setStyle(imageryStyle(layer, date, overlay), { diff: false });
  }, [layer, date, overlay, retry]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer('hotspots')) map.setPaintProperty('hotspots', 'raster-opacity', opacity);
    map?.getStyle()?.layers?.filter(item => item.id.startsWith('hotspot-')).forEach(item => map.setPaintProperty(item.id, 'circle-opacity', opacity * (item.id.startsWith('hotspot-glow-') ? 0.6 : 1)));
  }, [opacity]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.remove();
    const element = document.createElement('span');
    element.className = 'rapid-live-location';
    element.title = `Area of interest: ${selected.name}`;
    element.setAttribute('aria-label', `Area of interest: ${selected.name}`);
    markerRef.current = new maplibregl.Marker({ element }).setLngLat([selected.lng, selected.lat]).addTo(map);
    map.flyTo({ center: [selected.lng, selected.lat], duration: reducedMotion ? 0 : 600 });
  }, [selected, reducedMotion]);

  const worldviewUrl = `https://worldview.earthdata.nasa.gov/?l=${encodeURIComponent(layer.id)}&t=${date}&v=${selected.lng - 10},${selected.lat - 8},${selected.lng + 10},${selected.lat + 8}`;
  return <div className="rapid-nasa-map">
    <div className="rapid-nasa-canvas" ref={host} aria-label="NASA satellite imagery map" />
    <button type="button" className="rapid-live-recenter" onClick={() => mapRef.current?.flyTo({ center: [79, 22], zoom: 4.2, duration: reducedMotion ? 0 : 600 })} title="Recenter on India" aria-label="Recenter satellite map on India"><Crosshair size={18} /></button>
    <div className="rapid-live-map-caption"><strong>{date} UTC</strong><span>Satellite observations · daily mosaic</span><a href={worldviewUrl} target="_blank" rel="noreferrer">Open in NASA Worldview ↗</a></div>
    {status === 'loading' && !webglUnavailable && <div className="rapid-live-map-status" role="status">Loading NASA imagery…</div>}
    {(status === 'error' || webglUnavailable) && <div className="rapid-live-map-status is-error" role="status">
      {webglUnavailable ? 'This browser cannot display the satellite map. Use the NASA Worldview link.' : 'Some satellite tiles could not load. Coverage for recent dates may be incomplete.'}
      {!webglUnavailable && <button type="button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={13} /> Retry tiles</button>}
    </div>}
  </div>;
}
