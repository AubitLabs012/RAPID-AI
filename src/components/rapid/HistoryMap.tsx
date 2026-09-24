import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { createBaseLayer } from '../map/mapLayers';
import type { HistoricalEvent } from './historyEvents';
import { locateHistoryEvent } from './historyLocations';
import { historyArtMarkup, historyTypes, type HistoryType } from './historyTypes';

type Site = { lat: number; lng: number; events: HistoricalEvent[] };

export function HistoryMap({ events, type, selected, onSelect }: {
  events: HistoricalEvent[]; type?: HistoryType; selected: HistoricalEvent | null;
  onSelect: (event: HistoricalEvent) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;

  const sites = useMemo(() => {
    const grouped = new Map<string, Site>();
    for (const event of events) {
      const { lat, lng } = locateHistoryEvent(event);
      const key = `${lat},${lng}`;
      const site = grouped.get(key);
      if (site) site.events.push(event);
      else grouped.set(key, { lat, lng, events: [event] });
    }
    return [...grouped.values()];
  }, [events]);

  useEffect(() => {
    if (!host.current) return;
    const instance = L.map(host.current, { center: [21.5, 80], zoom: 5, minZoom: 2, maxZoom: 18, zoomControl: false, worldCopyJump: true });
    map.current = instance;
    const tiles = createBaseLayer('satellite').addTo(instance);
    const bounds = L.latLngBounds(sites.map(site => [site.lat, site.lng] as [number, number]));
    if (bounds.isValid()) instance.fitBounds(bounds.pad(0.14), { maxZoom: 6, animate: false });
    const layer = L.layerGroup().addTo(instance);
    const renderMarkers = () => {
      layer.clearLayers();
      const groups: Site[][] = [];
      const points: L.Point[] = [];
      for (const site of sites) {
        const point = instance.project([site.lat, site.lng], instance.getZoom());
        const nearby = points.findIndex(other => point.distanceTo(other) < 52);
        if (nearby < 0) { points.push(point); groups.push([site]); }
        else groups[nearby].push(site);
      }
      for (const group of groups) {
        const site = group[0];
        const count = group.reduce((total, item) => total + item.events.length, 0);
        const markerType = type ?? historyTypes.find(item => site.events[0].hazards.includes(item.hazard));
        const color = markerType?.color ?? (site.events[0].hazards.includes('Tornado') ? '#c68cf4' : '#bed9e8');
        const art = markerType ? historyArtMarkup(markerType) : `<span class="rapid-history-map-glyph">${site.events[0].hazards.includes('Tornado') ? 'T' : 'A'}</span>`;
        const cluster = group.length > 1;
        const icon = L.divIcon({
          className: cluster ? 'rapid-history-map-pin rapid-history-cluster' : 'rapid-history-map-pin', iconSize: [46, 50], iconAnchor: [23, 25],
          html: cluster
            ? `<span class="rapid-history-map-cluster" style="--hazard-glow:${type?.color ?? '#83d8ea'}"><strong>${count}</strong><small>EVENTS</small></span>`
            : `<span class="rapid-history-map-pin-inner" style="--hazard-glow:${color}">${art}${count > 1 ? `<b>${count}</b>` : ''}</span>`,
        });
        const title = cluster ? `${count} nearby historical events; activate to zoom in` : count > 1 ? `${count} historical events near ${site.events[0].location}` : `${site.events[0].title}, ${site.events[0].location}`;
        const marker = L.marker([site.lat, site.lng], { icon, title, alt: title, keyboard: true, riseOnHover: true }).addTo(layer);
        marker.on('click', () => {
          if (cluster) instance.fitBounds(L.latLngBounds(group.map(item => [item.lat, item.lng] as [number, number])).pad(0.5), { maxZoom: Math.min(18, instance.getZoom() + 2) });
          else select.current(site.events[0]);
        });
        marker.bindTooltip(cluster ? `${count} nearby events · click to zoom` : count > 1 ? `${count} events · ${site.events[0].location}` : `${site.events[0].title} · ${site.events[0].date}`, { direction: 'top', offset: [0, -22] });
      }
    };
    renderMarkers();
    instance.on('zoomend', renderMarkers);
    const observer = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
    observer.observe(host.current);
    return () => { observer.disconnect(); instance.off('zoomend', renderMarkers); instance.remove(); map.current = null; };
  }, [sites, type]);

  useEffect(() => {
    if (!selected || !map.current) return;
    const { lat, lng } = locateHistoryEvent(selected);
    map.current.flyTo([lat, lng], Math.max(map.current.getZoom(), 6), { duration: 0.65 });
  }, [selected]);

  return <div className="rapid-history-map-wrap">
    <div className="rapid-history-map" ref={host} aria-label={`${type?.label ?? 'All historical events'} satellite map`} />
    <div className="rapid-history-map-caption"><span className="rapid-status-dot" /> SATELLITE HISTORY MAP <small>{sites.length} LOCATIONS · {events.length} EVENTS</small></div>
    <div className="rapid-history-map-zoom" role="group" aria-label="History map zoom">
      <button aria-label="Zoom in history map" onClick={() => map.current?.zoomIn()}>+</button>
      <button aria-label="Zoom out history map" onClick={() => map.current?.zoomOut()}>−</button>
    </div>
  </div>;
}
