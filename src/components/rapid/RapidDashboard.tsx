import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Bell, Check, Crosshair, Database, Download, Globe2, Layers3, MapPin, Radio, Radar, Settings, ShieldCheck, SlidersHorizontal, Target, Waves, Wind, X, Zap, Sun, Moon } from 'lucide-react';
import { IndiaGlobe } from './IndiaGlobe';
import { RapidMap, type MapFocus } from './RapidMap';
import { LiveWeatherLine, LiveWeatherSection } from './LiveWeather';
import { regions, type Region } from './regions';
import { useDashboardStore } from '../../store';
import './rapid.css';
import './rapid-day.css';

function Mark({ small = false }: { small?: boolean }) {
  return <img className={small ? 'rapid-mark small' : 'rapid-mark'} src={`${import.meta.env.BASE_URL}rapid-logo.png`} alt="" aria-hidden="true" />;
}

function Sparkline({ values, gold = false }: { values: number[]; gold?: boolean }) {
  const points = values.map((v, i) => `${i * 100 / (values.length - 1)},${45 - v * .4}`).join(' ');
  return <svg className={`rapid-spark ${gold ? 'gold' : ''}`} viewBox="0 0 100 48" preserveAspectRatio="none" role="img" aria-label="Illustrative risk score trend"><polygon points={`0,48 ${points} 100,48`} fill="currentColor" opacity=".10" /><polyline points={points} fill="none" stroke="currentColor" strokeWidth=".7" vectorEffect="non-scaling-stroke" /></svg>;
}

function RegionMap({ selected, onSelect }: { selected: Region; onSelect: (r: Region) => void }) {
  return <svg viewBox="0 0 260 235" className="rapid-region-map" role="img" aria-label="Schematic India region selector">
    <defs><pattern id="rapid-map-grid" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M18 0H0V18" fill="none" stroke="#3b9097" strokeWidth=".4" /></pattern></defs>
    <rect width="260" height="235" fill="url(#rapid-map-grid)" opacity=".35" />
    <path d="m110 17 20 10 6 20 18 8-4 20 25 21 23-7 21-18 15 7-4 19-19 12-23-4-22 18-13 10-9 24-15 14-10 36-11 17-12-28-12-31-14-22-12-20-17-6-16-16 11-9 16 3 8-18 20-8 5-18-8-19Z" fill="#0e3338" stroke="#57bfc4" strokeWidth="1" />
    <path d="m99 63 29 35 35 17M68 105l59 20-18 70M89 91l-3 44 58 22M97 166l44-31M129 49l-13 72 43 10" fill="none" stroke="#387a80" strokeWidth=".6" strokeDasharray="3 3" />
    {regions.map(r => { const x = 42 + (r.lng - 68) * 6.5; const y = 209 - (r.lat - 8) * 6.6; return <g key={r.id} onClick={() => onSelect(r)} className="rapid-map-pin" role="button" tabIndex={0} aria-label={`Analyze ${r.name}`} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(r); } }}><circle cx={x} cy={y} r="10" fill={r.level === 'High' ? '#ff5968' : '#e4b266'} opacity=".12" /><circle cx={x} cy={y} r={selected.id === r.id ? 5 : 3} fill={r.level === 'High' ? '#ff5968' : '#e4b266'} /><circle cx={x} cy={y} r="12" fill="transparent" /><title>{r.name} · {r.hazard}</title></g>; })}
    <text x="9" y="224" fill="#789496" fontSize="7" letterSpacing="1.4">INDIA / SCHEMATIC</text>
  </svg>;
}

// Day/Night switch. The choice is saved by the store (localStorage "maris_color_mode").
function ModeToggle() {
  const colorMode = useDashboardStore(s => s.colorMode);
  const setColorMode = useDashboardStore(s => s.setColorMode);
  return <div className="rapid-mode-toggle" role="group" aria-label="Display mode">
    <button type="button" aria-pressed={colorMode === 'day'} onClick={() => setColorMode('day')} title="Day mode"><Sun size={12} /><span>DAY</span></button>
    <button type="button" aria-pressed={colorMode === 'night'} onClick={() => setColorMode('night')} title="Night mode"><Moon size={12} /><span>NIGHT</span></button>
  </div>;
}

const navigation = [
  { name: 'Home', title: 'COMMAND', subtitle: 'National overview', icon: Globe2 },
  { name: 'Live', title: 'LIVE', subtitle: 'Disaster monitoring', icon: Radio },
  { name: 'Analytics', title: 'ANALYZE', subtitle: 'Regional intelligence', icon: Activity },
  { name: 'Predictions', title: 'PREDICTIONS', subtitle: 'Scenario outlook', icon: Target },
  { name: 'Settings', title: 'SETTINGS', subtitle: 'System controls', icon: Settings },
];

export function RapidDashboard({ onLogout }: { onLogout: () => void }) {
  const [selected, setSelected] = useState(regions[0]);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [layer, setLayer] = useState('All hazards');
  const [markers, setMarkers] = useState(true);
  const [grid, setGrid] = useState(false);
  const [mapFocus, setMapFocus] = useState<MapFocus | null>(null);
  const [clock, setClock] = useState(new Date());
  const [exported, setExported] = useState(false);
  const [systemMotion, setSystemMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const activeNav = useDashboardStore(s => s.activeNav);
  const setActiveNav = useDashboardStore(s => s.setActiveNav);
  const reducedMotion = useDashboardStore(s => s.reducedMotion);
  const setReducedMotion = useDashboardStore(s => s.setReducedMotion);
  const colorMode = useDashboardStore(s => s.colorMode);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 1000); const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setSystemMotion(media.matches); media.addEventListener('change', update); return () => { clearInterval(timer); media.removeEventListener('change', update); }; }, []);
  useEffect(() => {
    if (!analysisOpen) return;
    previousFocus.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAnalysisOpen(false);
      if (event.key === 'Tab') {
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button, input, select, [tabindex="0"]');
        if (!focusable?.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previousFocus.current?.focus(); };
  }, [analysisOpen]);

  function selectRegion(region: Region) { setSelected(region); setAnalysisOpen(true); setExported(false); }
  function navigate(name: string) { setActiveNav(name); if (name === 'Analytics' || name === 'Predictions') { setAnalysisOpen(true); setExported(false); } else setAnalysisOpen(false); }
  function exportReport() {
    const blob = new Blob([JSON.stringify({ application: 'RAPID-AI', dataStatus: 'ILLUSTRATIVE DEMO — NOT LIVE DATA OR A FORECAST', region: selected }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `rapid-ai-${selected.id}-demo-analysis.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setExported(true);
  }

  return <div className={`rapid-shell ${colorMode === 'day' ? 'rapid-day' : ''} ${reducedMotion || systemMotion ? 'rapid-reduced-motion' : ''}`}>
    <div className="rapid-background-grid" aria-hidden="true" />
    <header className="rapid-topbar">
      <a href="#" className="rapid-brand" onClick={e => { e.preventDefault(); navigate('Home'); }}><Mark /><span><strong>RAPID<span>-</span>AI</strong><small>DISASTER INTELLIGENCE NETWORK</small></span></a>
      <div className="rapid-top-status"><span className="rapid-status-dot" /> INDIA OPERATIONS <span className="rapid-divider" /><ShieldCheck size={14} /><span>DEMO WORKSPACE</span><ModeToggle /><button className="rapid-avatar" onClick={onLogout} title="Return to login" aria-label="Return to login">R</button></div>
    </header>

    <aside className="rapid-sidebar">
      <div className="rapid-side-label">WORKSPACE <span>01 / IN</span></div>
      <nav aria-label="Primary">{navigation.map(({ name, title, subtitle, icon: Icon }) => <button key={name} className={activeNav === name ? 'active' : ''} onClick={() => navigate(name)} aria-current={activeNav === name ? 'page' : undefined}><Icon size={21} /><span><strong>{title}</strong><small>{subtitle}</small></span>{activeNav === name && <i />}</button>)}</nav>
      <div className="rapid-sidebar-bottom">
        <div className="rapid-side-clock"><strong>{clock.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' })}<small> IST</small></strong><span>{clock.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).toUpperCase()}</span></div>
      </div>
    </aside>

    <main className="rapid-main">
      <div className="rapid-main-heading"><div><span className="rapid-eyebrow">NATIONAL COMMAND CENTER</span><h1>{activeNav === 'Live' ? 'Live monitoring' : 'Disaster intelligence'}<span> / INDIA</span></h1></div><span className="rapid-demo-tag"><span /> SAMPLE DATA</span></div>
      <div className={`rapid-center-stage ${mapFocus ? 'map-open' : ''}`}>
        {mapFocus ? <RapidMap focus={mapFocus} selected={selected} onSelect={selectRegion} onClose={() => setMapFocus(null)} hazard={layer} onHazardChange={setLayer} markers={markers} onMarkersChange={setMarkers} reducedMotion={reducedMotion || systemMotion} /> : <>
        <div className="rapid-orbit-scene" aria-hidden="true"><div className="rapid-orbit orbit-outer" /><div className="rapid-orbit orbit-gold" /><div className="rapid-orbit orbit-ticks" /><div className="rapid-orbit orbit-inner" /><div className="rapid-orbit orbit-fine" /><span className="orbit-cross top" /><span className="orbit-cross bottom" /><span className="orbit-cross left" /><span className="orbit-cross right" /></div>
        <div className="rapid-globe-wrap"><IndiaGlobe hazard={layer} selected={selected.id} onOpenMap={focus => { if (focus.region) setSelected(focus.region); setMapFocus(focus); }} markers={markers} grid={grid} reducedMotion={reducedMotion || systemMotion} dayMode={colorMode === 'day'} /></div>
        <section className="rapid-floating rapid-view-menu"><h2><Globe2 size={13} /> INDIA VIEW</h2><small>REGIONAL INTELLIGENCE</small>{['All hazards', 'Cyclone', 'Flood', 'Earthquake', 'Heatwave', 'Landslide'].map(hazard => <button key={hazard} onClick={() => setLayer(hazard)} className={layer === hazard ? 'selected' : ''}><span className="rapid-radio" />{hazard}</button>)}</section>
        <section className="rapid-floating rapid-layer-menu"><h2><Layers3 size={13} /> SATELLITE LAYERS</h2><label><input type="checkbox" checked={markers} onChange={e => setMarkers(e.target.checked)} /> DISASTER MARKERS</label><label><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} /> COORDINATE GRID</label><span className="rapid-layer-note">EARTH / OPTICAL BASEMAP</span></section>
        <div className="rapid-location-lock"><Crosshair size={16} /><span>FOCUS LOCK<strong>INDIAN SUBCONTINENT</strong></span></div>
        <div className="rapid-coordinate"><span>20°35′ N</span><i /><span>78°57′ E</span></div>
        <div className="rapid-stage-label"><span className="rapid-status-dot" /> GEOSPATIAL EXPLORER <small>DRAG TO ROTATE · CLICK TO OPEN MAP</small></div>
        </>}
      </div>

    </main>

    <aside className="rapid-right-rail" aria-label="Regional overview">
      <section className="rapid-panel rapid-sector"><header><h2><SatelliteIcon /> REGIONAL OBSERVATION</h2><SlidersHorizontal size={12} /></header><div className="rapid-observation"><RegionMap selected={selected} onSelect={selectRegion} /><div className="rapid-observation-caption"><span>AREA OF INTEREST<strong>{selected.state.toUpperCase()}</strong><small>{selected.lat.toFixed(3)}° N / {selected.lng.toFixed(3)}° E</small></span><span className="rapid-outline-tag">SCHEMATIC</span></div><div className="rapid-crosshair-corner tl" /><div className="rapid-crosshair-corner br" /></div><button className="rapid-panel-link" onClick={() => selectRegion(selected)}>EXPLORE {selected.name.toUpperCase()}<ArrowUpRight size={14} /></button></section>
      <section className="rapid-panel rapid-analysis-card"><header><h2><Zap size={13} /> REGIONAL ANALYSIS</h2><span>DEMO</span></header><div className="rapid-analysis-title"><div><small>{selected.state.toUpperCase()}</small><h3>{selected.hazard} exposure</h3></div><span className={`rapid-severity ${selected.level.toLowerCase()}`}>{selected.level}</span></div><div className="rapid-score"><strong>{selected.score}<small>/100</small></strong><span>ILLUSTRATIVE<br />RISK INDEX</span><ArrowUpRight size={20} /></div><Sparkline values={selected.trend} /><div className="rapid-card-metrics"><span>RAINFALL <strong>{selected.rain}<small> mm / 24h</small></strong></span><span>WIND <strong>{selected.wind}<small> km/h</small></strong></span></div><LiveWeatherLine region={selected} /><button className="rapid-panel-link" onClick={() => selectRegion(selected)}>OPEN AREA ANALYSIS<ArrowUpRight size={14} /></button></section>
      <section className="rapid-panel rapid-threat"><header><h2><Radar size={13} /> THREAT MONITOR</h2><span>INDIA</span></header><div className="rapid-threat-totals"><span><i className="rapid-risk-dot high" /><strong>04</strong> HIGH</span><span><i className="rapid-risk-dot moderate" /><strong>04</strong> MODERATE</span></div>{regions.filter(r => r.level === 'High').slice(0, 3).map(r => <button className="rapid-threat-row" key={r.id} onClick={() => selectRegion(r)}><span className="rapid-risk-dot high" /><span>{r.state}<small>{r.hazard} scenario</small></span><ArrowUpRight size={13} /></button>)}<div className="rapid-threat-note">Sample scenarios, not active warnings</div></section>
      <div className="rapid-rail-footer"><span className="rapid-status-dot" /> SYSTEM READY <span>IN / 01</span></div>
    </aside>

    {activeNav === 'Settings' && <section className="rapid-settings rapid-panel" aria-label="Display settings"><header><h2><Settings size={15} /> DISPLAY SETTINGS</h2><button onClick={() => navigate('Home')} aria-label="Close settings"><X size={17} /></button></header><p>Customize the command center.</p><ModeToggle /><label><input type="checkbox" checked={reducedMotion} onChange={e => setReducedMotion(e.target.checked)} /> Reduce animation</label><label><input type="checkbox" checked={markers} onChange={e => setMarkers(e.target.checked)} /> Show disaster markers</label><label><input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} /> Show coordinate grid</label><small>Your device’s reduced-motion preference is also respected.</small></section>}

    {analysisOpen && <div className="rapid-analysis-backdrop" onClick={() => setAnalysisOpen(false)}><section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="rapid-region-title" className="rapid-detail rapid-panel" onClick={e => e.stopPropagation()}><header><h2><Activity size={14} /> {activeNav === 'Predictions' ? 'REGIONAL SCENARIO OUTLOOK' : 'AREA ANALYSIS'}</h2><button ref={closeRef} onClick={() => setAnalysisOpen(false)} aria-label="Close area analysis"><X size={19} /></button></header><div className="rapid-detail-body"><div className="rapid-detail-eyebrow"><span className="rapid-demo-tag">ILLUSTRATIVE SCENARIO</span><span>IN / {selected.id.toUpperCase()}</span></div><h2 id="rapid-region-title">{selected.name}</h2><p className="rapid-detail-location"><MapPin size={14} />{selected.state}, India <span>{selected.lat.toFixed(3)}° N · {selected.lng.toFixed(3)}° E</span></p><div className="rapid-detail-risk"><div><small>PRIMARY HAZARD</small><strong>{selected.hazard}</strong></div><span className={`rapid-severity ${selected.level.toLowerCase()}`}>{selected.level} · {selected.score}/100</span></div><p className="rapid-detail-summary">{selected.summary}</p><div className="rapid-detail-metrics"><div><Waves size={18} /><strong>{selected.rain}<small>mm</small></strong><span>Sample 24h rainfall</span></div><div><Wind size={18} /><strong>{selected.wind}<small>km/h</small></strong><span>Sample wind speed</span></div><div><Target size={18} /><strong>{selected.score}<small>/100</small></strong><span>Demo risk index</span></div></div><h3>SCENARIO TREND <span>ILLUSTRATIVE SEQUENCE</span></h3><Sparkline values={selected.trend} gold /><div className="rapid-trend-labels"><span>START</span><span>SCENARIO STEPS →</span><span>END</span></div><div className="rapid-detail-exposure"><h3>EXPOSURE CONTEXT</h3><p>{selected.exposure}</p><small>Regional scenario only. No property-level or person-level assessment.</small></div><LiveWeatherSection region={selected} /><div className="rapid-data-note"><Database size={16} /><p><strong>Data status: scenario demo + live weather</strong>Hazard, risk index, scenario rainfall and wind are locally defined examples. Only the Live Weather section is real data (Open-Meteo). No official warnings or predictive model output are connected to this view.</p></div><button className="rapid-export" onClick={exportReport}>{exported ? <Check size={16} /> : <Download size={16} />}{exported ? 'REPORT DOWNLOADED' : 'EXPORT SCENARIO REPORT'}<ArrowDownRight size={15} /></button></div></section></div>}
  </div>;
}

function SatelliteIcon() { return <Radio size={13} />; }
