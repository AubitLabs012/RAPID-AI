import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Crosshair, Globe2, Map, Minus, Plus, Radar, Satellite } from 'lucide-react';
import { createBaseLayer, type MapMode } from '../map/mapLayers';
import { regions, type Region } from './regions';
import './rapid-map.css';

export type MapFocus = { lat: number; lng: number; region?: Region };
const modes = [{ id: 'satellite', label: 'Satellite', icon: Satellite }, { id: 'normal', label: 'Normal', icon: Map }, { id: 'risks', label: 'Risk', icon: Radar }] as const;

export function RapidMap({ focus, selected, onSelect, onClose, hazard, onHazardChange, markers, onMarkersChange, reducedMotion }: {
  focus: MapFocus; selected: Region; onSelect: (region: Region) => void; onClose: () => void;
  hazard: string; onHazardChange: (hazard: string) => void; markers: boolean;
  onMarkersChange: (enabled: boolean) => void; reducedMotion: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<L.TileLayer | null>(null);
  const selectRef = useRef(onSelect);
  const initialFocus = useRef(focus);
  const previousSelected = useRef(selected.id);
  const [mode, setMode] = useState<MapMode>('satellite');
  const [zoom, setZoom] = useState(5);
  const [tileError, setTileError] = useState(false);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!host.current) return;
    const map = L.map(host.current, { center: [initialFocus.current.lat, initialFocus.current.lng], zoom: 5,
      minZoom: 2, maxZoom: 19, zoomControl: false, worldCopyJump: true,
      zoomAnimation: !reducedMotion, fadeAnimation: !reducedMotion, markerZoomAnimation: !reducedMotion });
    mapRef.current = map;
    map.on('zoomend', () => setZoom(map.getZoom()));
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(host.current);
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; };
  }, [reducedMotion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setTileError(false);
    const tiles = createBaseLayer(mode).addTo(map);
    baseRef.current = tiles;
    tiles.on('tileerror', () => setTileError(true));
    tiles.on('tileload', () => setTileError(false));
    return () => { tiles.remove(); tiles.off(); baseRef.current = null; };
  }, [mode, reducedMotion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    const visible = regions.filter(region => hazard === 'All hazards' || region.hazard === hazard);
    for (const region of visible) {
      const color = region.level === 'High' ? '#ff5968' : '#edb85e';
      // Reuse MARIS's translucent risk-area treatment with RAPID's sample regions.
      if (mode === 'risks') L.circle([region.lat, region.lng], {
        radius: region.level === 'High' ? 100000 : 65000, color, fillColor: color,
        fillOpacity: 0.18, opacity: 0.65, weight: 1, interactive: false,
      }).addTo(layer);
      if (!markers && mode !== 'risks') continue;
      const label = `${region.name}: ${region.hazard}, ${region.level} sample risk`;
      const icon = L.divIcon({ className: 'rapid-leaflet-pin', iconSize: [30, 38], iconAnchor: [15, 34],
        html: `<span class="${region.id === selected.id ? 'selected' : ''}" style="--pin-color:${color}"><i></i></span>` });
      const tooltip = document.createElement('span');
      tooltip.textContent = `${region.name} · ${region.hazard} · ${region.level}`;
      L.marker([region.lat, region.lng], { icon, title: label, alt: label, keyboard: true, riseOnHover: true })
        .bindTooltip(tooltip, { direction: 'top', offset: [0, -28] })
        .on('click', () => selectRef.current(region)).addTo(layer);
    }
    return () => { layer.remove(); };
  }, [mode, hazard, markers, selected.id, reducedMotion]);

  useEffect(() => {
    if (selected.id === previousSelected.current) return;
    previousSelected.current = selected.id;
    mapRef.current?.setView([selected.lat, selected.lng], Math.max(5, mapRef.current.getZoom()), { animate: !reducedMotion });
  }, [selected, reducedMotion]);

  return <section className="rapid-map-view" aria-label="Interactive regional map">
    <div className="rapid-map-toolbar">
      <div className="rapid-map-modes" role="group" aria-label="Map mode">
        {modes.map(({ id, label, icon: Icon }) => <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}><Icon size={14} />{label}</button>)}
      </div>
      <button className="rapid-return-globe" onClick={onClose} aria-label="Return to globe"><Globe2 size={16} />Globe</button>
    </div>
    <div className="rapid-map-filters">
      <label>Hazard <select value={hazard} onChange={event => onHazardChange(event.target.value)}>
        {['All hazards', 'Cyclone', 'Flood', 'Earthquake', 'Heatwave', 'Landslide'].map(value => <option key={value}>{value}</option>)}
      </select></label>
      {mode !== 'risks' && <label><input type="checkbox" checked={markers} onChange={event => onMarkersChange(event.target.checked)} /> Markers</label>}
      <span>{mode === 'risks' ? 'Sample risk areas · not forecast boundaries' : 'Select a marker to analyze'}</span>
    </div>
    <div className="rapid-map-surface" ref={host} aria-label={`${mode === 'risks' ? 'Risk' : mode} map`} />
    <div className="rapid-map-zoom" role="group" aria-label="Map navigation">
      <button aria-label="Zoom in map" disabled={zoom >= 19} onClick={() => mapRef.current?.zoomIn()}><Plus size={18} /></button>
      <output aria-label="Map zoom level">{zoom}</output>
      <button aria-label="Zoom out map" disabled={zoom <= 2} onClick={() => mapRef.current?.zoomOut()}><Minus size={18} /></button>
      <button aria-label="Recenter map on India" onClick={() => mapRef.current?.setView([22, 79], 5, { animate: !reducedMotion })}><Crosshair size={18} /></button>
    </div>
    {mode === 'risks' && <div className="rapid-map-legend"><strong>ILLUSTRATIVE RISK</strong><span><i className="high" /> High</span><span><i className="moderate" /> Moderate</span></div>}
    {tileError && <div className="rapid-map-error" role="status">Some map tiles could not load. <button onClick={() => { setTileError(false); baseRef.current?.redraw(); }}>Retry</button></div>}
  </section>;
}
