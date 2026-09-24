import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as LibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Crosshair, Globe2, Map, Minus, Plus, Radar, Satellite } from 'lucide-react';
import { regions, type Region } from './regions';
import { loadDisasterMarkerImages } from './markerArt';
import type { MapFocus } from './RapidMap';
import './rapid-map.css';

type Mode = 'satellite' | 'normal' | 'risks';
const modes = [{ id: 'satellite', label: 'Satellite', icon: Satellite }, { id: 'normal', label: 'Normal', icon: Map }, { id: 'risks', label: 'Risk', icon: Radar }] as const;
const colors: Record<string, string> = { Cyclone: '#cf48ff', Flood: '#4fe5ff', Tsunami: '#1976d2', Volcanic: '#ff263a', Earthquake: '#a8754f', Heatwave: '#ffc928', Landslide: '#39dc4a' };

function style(mode: Mode) {
  const satellite = mode === 'satellite';
  return { version: 8 as const, sources: { basemap: { type: 'raster' as const,
    tiles: [satellite ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    tileSize: 256, maxzoom: satellite ? 18 : 19, attribution: satellite ? 'Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community' : '© OpenStreetMap contributors' } },
    layers: [{ id: 'basemap', type: 'raster' as const, source: 'basemap' }] };
}

function circle(region: Region) {
  const radius = region.level === 'High' ? 100 : 65;
  const coordinates = Array.from({ length: 49 }, (_, index) => {
    const angle = index * Math.PI / 24;
    return [region.lng + Math.cos(angle) * radius / (111.32 * Math.cos(region.lat * Math.PI / 180)), region.lat + Math.sin(angle) * radius / 111.32];
  });
  return { type: 'Feature' as const, properties: { color: colors[region.hazard] ?? '#61d7ff' }, geometry: { type: 'Polygon' as const, coordinates: [coordinates] } };
}

export function RapidLibreMap({ focus, selected, onSelect, onClose, hazard, onHazardChange, markers, onMarkersChange, reducedMotion }: {
  focus: MapFocus; selected: Region; onSelect: (region: Region) => void; onClose: () => void;
  hazard: string; onHazardChange: (hazard: string) => void; markers: boolean;
  onMarkersChange: (enabled: boolean) => void; reducedMotion: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LibreMap | null>(null);
  const pins = useRef<Marker[]>([]);
  const selectRef = useRef(onSelect);
  const initialFocus = useRef(focus);
  const previousSelected = useRef(selected.id);
  const [mode, setMode] = useState<Mode>('satellite');
  const [zoom, setZoom] = useState(5);
  const [tileError, setTileError] = useState(false);
  const [art, setArt] = useState<Record<string, string>>({});
  selectRef.current = onSelect;

  useEffect(() => { let active = true; loadDisasterMarkerImages().then(result => { if (active) setArt(result); }).catch(() => undefined); return () => { active = false; }; }, []);
  useEffect(() => {
    if (!host.current) return;
    const map = new maplibregl.Map({ container: host.current, style: style('satellite'), center: [initialFocus.current.lng, initialFocus.current.lat],
      zoom: initialFocus.current.region ? 8 : 5, minZoom: 2, maxZoom: 19 });
    mapRef.current = map;
    map.on('zoomend', () => setZoom(Math.round(map.getZoom() * 10) / 10));
    map.on('error', () => setTileError(true));
    map.on('idle', () => setTileError(false));
    const observer = new ResizeObserver(() => map.resize()); observer.observe(host.current);
    return () => { observer.disconnect(); pins.current.forEach(pin => pin.remove()); pins.current = []; map.remove(); mapRef.current = null; };
  }, []);
  useEffect(() => { const map = mapRef.current; if (map) { setTileError(false); map.setStyle(style(mode)); } }, [mode]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const draw = () => {
      if (!map.getSource('basemap')) return;
      if (map.getLayer('rapid-risk-fill')) map.removeLayer('rapid-risk-fill');
      if (map.getLayer('rapid-risk-line')) map.removeLayer('rapid-risk-line');
      if (map.getSource('rapid-risk-zones')) map.removeSource('rapid-risk-zones');
      if (mode !== 'risks') return;
      const visible = regions.filter(region => hazard === 'All hazards' || region.hazard === hazard);
      map.addSource('rapid-risk-zones', { type: 'geojson', data: { type: 'FeatureCollection', features: visible.map(circle) } });
      map.addLayer({ id: 'rapid-risk-fill', type: 'fill', source: 'rapid-risk-zones', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.18 } });
      map.addLayer({ id: 'rapid-risk-line', type: 'line', source: 'rapid-risk-zones', paint: { 'line-color': ['get', 'color'], 'line-opacity': 0.65, 'line-width': 1.5 } });
    };
    map.on('style.load', draw); draw();
    return () => { map.off('style.load', draw); };
  }, [mode, hazard]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pins.current.forEach(pin => pin.remove()); pins.current = [];
    for (const region of regions.filter(item => hazard === 'All hazards' || item.hazard === hazard)) {
      if (!markers && mode !== 'risks') continue;
      const element = document.createElement('button'); element.type = 'button'; element.className = 'rapid-leaflet-pin';
      element.title = `${region.name} · ${region.hazard} · ${region.level}`;
      element.setAttribute('aria-label', `${region.name}: ${region.hazard}, ${region.level} sample risk`);
      const image = document.createElement('span'); image.className = region.id === selected.id ? 'selected' : '';
      image.style.setProperty('--pin-color', colors[region.hazard] ?? '#61d7ff');
      image.style.setProperty('--pin-filter', 'none'); image.style.setProperty('--art-filter', 'none');
      image.style.setProperty('--marker-image', art[region.hazard] ? `url(${art[region.hazard]})` : 'none');
      element.append(image);
      element.addEventListener('click', event => { event.stopPropagation(); map.flyTo({ center: [region.lng, region.lat], zoom: Math.max(8, map.getZoom()), duration: reducedMotion ? 0 : 850 }); selectRef.current(region); });
      pins.current.push(new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([region.lng, region.lat]).addTo(map));
    }
    return () => { pins.current.forEach(pin => pin.remove()); pins.current = []; };
  }, [mode, hazard, markers, selected.id, reducedMotion, art]);
  useEffect(() => {
    if (selected.id === previousSelected.current) return;
    previousSelected.current = selected.id;
    const map = mapRef.current;
    map?.flyTo({ center: [selected.lng, selected.lat], zoom: Math.max(8, map.getZoom()), duration: reducedMotion ? 0 : 850 });
  }, [selected, reducedMotion]);

  return <section className="rapid-map-view" aria-label="Interactive regional map">
    <div className="rapid-map-toolbar"><div className="rapid-map-modes" role="group" aria-label="Map mode">{modes.map(({ id, label, icon: Icon }) => <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}><Icon size={14} />{label}</button>)}</div><button className="rapid-return-globe" onClick={onClose} aria-label="Return to globe"><Globe2 size={16} />Globe</button></div>
    <div className="rapid-map-filters"><label>Hazard <select value={hazard} onChange={event => onHazardChange(event.target.value)}>{['All hazards', 'Cyclone', 'Flood', 'Tsunami', 'Volcanic', 'Earthquake', 'Heatwave', 'Landslide'].map(value => <option key={value}>{value}</option>)}</select></label>{mode !== 'risks' && <label><input type="checkbox" checked={markers} onChange={event => onMarkersChange(event.target.checked)} /> Markers</label>}<span>{mode === 'risks' ? 'Sample risk areas · not forecast boundaries' : 'Select a marker to analyze'}</span></div>
    <div className="rapid-disaster-legend" aria-label="Disaster marker colors"><span><i className="cyclone" /> Cyclone</span><span><i className="flood" /> Flood / Tsunami</span><span><i className="volcanic" /> Volcanic</span><span><i className="earthquake" /> Earthquake</span></div>
    <div className="rapid-map-surface" ref={host} aria-label={`${mode === 'risks' ? 'Risk' : mode} map`} />
    <div className="rapid-map-zoom" role="group" aria-label="Map navigation"><button aria-label="Zoom in map" disabled={zoom >= 19} onClick={() => mapRef.current?.zoomIn({ duration: reducedMotion ? 0 : 300 })}><Plus size={18} /></button><output aria-label="Map zoom level">{zoom}</output><button aria-label="Zoom out map" disabled={zoom <= 2} onClick={() => mapRef.current?.zoomOut({ duration: reducedMotion ? 0 : 300 })}><Minus size={18} /></button><button aria-label="Recenter map on India" onClick={() => mapRef.current?.flyTo({ center: [79, 22], zoom: 5, duration: reducedMotion ? 0 : 500 })}><Crosshair size={18} /></button></div>
    {mode === 'risks' && <div className="rapid-map-legend"><strong>ILLUSTRATIVE RISK</strong><span><i className="high" /> High</span><span><i className="moderate" /> Moderate</span></div>}
    {tileError && <div className="rapid-map-error" role="status">Some map tiles could not load. <button onClick={() => { setTileError(false); mapRef.current?.setStyle(style(mode)); }}>Retry</button></div>}
  </section>;
}
