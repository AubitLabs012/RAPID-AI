import { useEffect, useState } from 'react';
import { CalendarDays, MapPin, RefreshCw, Satellite, Wind } from 'lucide-react';
import { fetchLiveSource, imageryDateAvailable, type ImageryCatalog, type LiveProviders } from '../../services/liveSources';
import { regions, type Region } from './regions';
import { NasaLiveMap } from './NasaLiveMap';
import { WindyLiveMap } from './WindyLiveMap';
import './live-monitoring.css';

export function LiveMonitoring({ selected, onSelectRegion, reducedMotion }: {
  selected: Region; onSelectRegion: (region: Region) => void; reducedMotion: boolean;
}) {
  const [source, setSource] = useState<'nasa' | 'windy'>('nasa');
  const [catalog, setCatalog] = useState<ImageryCatalog | null>(null);
  const [providers, setProviders] = useState<LiveProviders | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [providerError, setProviderError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [baseId, setBaseId] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [hotspots, setHotspots] = useState(false);
  const [opacity, setOpacity] = useState(0.85);

  useEffect(() => {
    const controller = new AbortController();
    const update = async () => {
      setLoading(true);
      try {
        const data = await fetchLiveSource<ImageryCatalog>('imagery', controller.signal);
        if (!controller.signal.aborted) { setCatalog(data); setCatalogError(false); }
      } catch {
        if (!controller.signal.aborted) setCatalogError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void update();
    const timer = window.setInterval(() => { void update(); }, 10 * 60 * 1000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLiveSource<LiveProviders>('providers', controller.signal)
      .then(data => { if (!controller.signal.aborted) { setProviders(data); setProviderError(false); } })
      .catch(() => { if (!controller.signal.aborted) setProviderError(true); });
    return () => controller.abort();
  }, [refresh]);

  const bases = catalog?.layers.filter(layer => layer.kind === 'base') ?? [];
  const base = bases.find(layer => layer.id === baseId) ?? bases[0];
  const date = requestedDate || base?.default_date || '';
  const dateAvailable = base && imageryDateAvailable(base, date);
  const overlay = catalog?.layers.find(layer => layer.kind === 'overlay');
  const overlayAvailable = overlay && imageryDateAvailable(overlay, date);

  return <section className="rapid-live-monitoring" aria-label="Live satellite and weather maps">
    <div className="rapid-live-sources" role="group" aria-label="Live map source">
      <button type="button" aria-pressed={source === 'nasa'} onClick={() => setSource('nasa')}><Satellite size={19} /><span><strong>NASA satellite</strong><small>Observed imagery</small></span></button>
      <button type="button" aria-pressed={source === 'windy'} onClick={() => setSource('windy')}><Wind size={19} /><span><strong>Windy weather</strong><small>Animated forecast layers</small></span></button>
      <button className="rapid-live-refresh" type="button" onClick={() => setRefresh(value => value + 1)} disabled={loading} aria-label="Refresh live sources" title="Refresh live sources"><RefreshCw size={17} /></button>
    </div>
    <div className="rapid-live-region"><MapPin size={15} /><label htmlFor="rapid-live-region">Area of interest</label><select id="rapid-live-region" value={selected.id} onChange={event => { const region = regions.find(item => item.id === event.target.value); if (region) onSelectRegion(region); }}>{regions.map(region => <option key={region.id} value={region.id}>{region.name}, {region.state}</option>)}</select></div>
    {source === 'nasa' ? <>
      {base && <div className="rapid-live-imagery-controls">
        <label>Satellite <select aria-label="NASA satellite layer" value={base.id} onChange={event => { setBaseId(event.target.value); setRequestedDate(''); }}>{bases.map(layer => <option key={layer.id} value={layer.id}>{layer.title}</option>)}</select></label>
        <label><CalendarDays size={14} /> Date (UTC) <input type="date" aria-label="Satellite observation date" value={date} min={base.date_min} max={base.date_max} onChange={event => setRequestedDate(event.target.value)} /></label>
        <button type="button" onClick={() => setRequestedDate('')} aria-pressed={!requestedDate}>Latest available</button>
        {overlay && <label><input type="checkbox" checked={hotspots} disabled={!overlayAvailable} onChange={event => setHotspots(event.target.checked)} /> Fire hotspots</label>}
        {hotspots && overlayAvailable && <label>Intensity <input aria-label="Hotspot overlay opacity" type="range" min="0.2" max="1" step="0.05" value={opacity} onChange={event => setOpacity(Number(event.target.value))} /></label>}
      </div>}
      {base && dateAvailable ? <NasaLiveMap layer={base} date={date} overlay={hotspots && overlayAvailable ? overlay : undefined} opacity={opacity} selected={selected} reducedMotion={reducedMotion} /> : <div className="rapid-live-empty" role="status"><Satellite size={36} /><strong>{base ? 'No imagery advertised for this date' : loading ? 'Connecting to NASA satellite imagery…' : 'NASA imagery is unavailable'}</strong><p>{base ? 'Choose another observation date or return to the latest available imagery.' : 'The live imagery service needs a connection to the RAPID backend and NASA.'}</p><button type="button" onClick={() => { setRequestedDate(''); setRefresh(value => value + 1); }}>Try latest imagery</button></div>}
      {(catalogError || catalog?.stale) && <p className="rapid-live-warning" role="status">{catalog ? 'NASA metadata refresh is unavailable; showing the last fetched dates.' : 'Could not reach the NASA imagery service. Retry when the connection is available.'}</p>}
      {hotspots && !overlayAvailable && <p className="rapid-live-warning">Fire hotspot imagery is unavailable for the selected date.</p>}
      <footer className="rapid-live-source-note"><span>NASA GIBS / EOSDIS · Near real-time satellite observations. Recent mosaics can have gaps as satellites pass overhead.</span>{catalog && <span>Catalog fetched {new Date(catalog.fetched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Refreshes every 10 min</span>}{hotspots && <span>Thermal anomalies may indicate fires or other heat sources; they are not confirmed damage reports.</span>}</footer>
    </> : <>
      {providers?.windy.maps_key ? <WindyLiveMap lat={selected.lat} lng={selected.lng} apiKey={providers.windy.maps_key} reducedMotion={reducedMotion} /> : <div className="rapid-live-empty" role="status"><Wind size={36} /><strong>{providerError ? 'Windy configuration unavailable' : providers ? 'Windy Maps key required' : 'Connecting to Windy…'}</strong><p>{providerError ? 'Start the RAPID backend, then refresh the live sources.' : 'The weather map uses a Windy Map Forecast credential from the server.'}</p><button type="button" onClick={() => setRefresh(value => value + 1)}>Reconnect</button></div>}
      <footer className="rapid-live-source-note">Windy · Weather model forecasts. Use the displayed valid time when comparing with NASA observations.</footer>
    </>}
  </section>;
}
