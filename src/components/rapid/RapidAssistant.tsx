import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Activity, ArrowUp, ChevronDown, Database, MapPin, Paperclip, Route, ShieldAlert, Target, CloudSun, X } from 'lucide-react';
import assistantImage from '../../assets/aubit-pod.png';
import { historyEvents } from './historyEvents';
import { regions, type Region } from './regions';
import { fetchLiveWeather, describeWeather } from '../../services/weather';
import './rapid-assistant.css';

type Message = { id: number; role: 'assistant' | 'user'; text: string; source?: string; severity?: 'low' | 'moderate' | 'high' | 'critical' | 'unknown' };
type AssistantTool = 'analyze' | 'forecast' | 'prioritize' | 'route' | 'risks';
type Coordinate = { lat: number; lng: number };

export const intelligenceStages = [
  'Multi-source data', 'Multimodal AI analysis', 'Evidence verification', 'Damage & risk assessment',
  'Geographic intelligence', 'Incident clustering', 'Priority engine', 'Prediction / situation forecast',
  'Response recommendation', 'Responder dashboard + alerts',
] as const;

function AubitPod({ className = '' }: { className?: string }) {
  return <span className={`rapid-assistant-pod ${className}`} aria-hidden="true">
    <img src={assistantImage} alt="" />
    <span className="rapid-assistant-eyes"><i /><i /></span>
  </span>;
}

const starter: Message = {
  id: 0,
  role: 'assistant',
  text: 'I can summarize supplied incident details, show live weather, and help plan a candidate route. Reported facts, live weather, and illustrative scenarios are kept separate. RAPID does not have verified demographic, road-closure, shelter, or official hazard-warning feeds connected.',
};

function localAnswer(question: string, selected: Region): Pick<Message, 'text' | 'source'> {
  const query = question.toLowerCase();
  const matchedRegion = regions.find(region => [region.name, region.state].some(name => query.includes(name.toLowerCase()))) ?? selected;
  const hazardNames = ['cyclone', 'flood', 'tsunami', 'volcanic', 'earthquake', 'landslide'];
  const hazard = hazardNames.find(name => query.includes(name));
  const historyRequested = /history|historical|past|record|happen|occur|event/.test(query);
  if (historyRequested || (hazard && !/risk|forecast|predict/.test(query))) {
    const matches = historyEvents.filter(event => !hazard || event.hazards.some(type => type.toLowerCase().includes(hazard)))
      .filter(event => ![matchedRegion.name, matchedRegion.state].some(name => query.includes(name.toLowerCase())) || event.location.toLowerCase().includes(matchedRegion.state.toLowerCase()))
      .sort((a, b) => b.year - a.year);
    if (!matches.length) return { text: `I found no matching ${hazard ?? 'disaster'} records for ${matchedRegion.state} in the supplied reports.`, source: 'Supplied RAPID historical reports' };
    return { text: `I found ${matches.length} matching record${matches.length === 1 ? '' : 's'}:\n${matches.slice(0, 4).map(event => `${event.date}: ${event.title} (${event.location})`).join('\n')}${matches.length > 4 ? '\nOpen History for the full list and map.' : ''}`, source: 'Supplied RAPID historical reports' };
  }
  if (/risk|region|area|damage|assess|forecast|predict|weather|alert/.test(query)) return {
    text: `${matchedRegion.name}, ${matchedRegion.state} is shown as a ${matchedRegion.hazard} sample scenario (illustrative score ${matchedRegion.score}/100). This is not a live hazard assessment. Use Analyze area to enter observed conditions and check live weather.`,
    source: 'Illustrative RAPID sample scenario',
  };
  if (/pipeline|work|source|data|verify|ai/.test(query)) return { text: `RAPID's workflow has ${intelligenceStages.length} stages, from source collection through evidence checks, geographic analysis, priorities, forecasts and response recommendations. Several data connectors and models are still pending.`, source: 'RAPID workflow design' };
  return { text: `Try “Show the weather outlook” or “What happened in cyclone history?” I can use live weather and the supplied historical reports; hazard alerts and disaster forecasting are not connected.`, source: 'Local information mode' };
}

function parseCoordinate(value: string): Coordinate | null {
  const parts = value.split(',').map(part => Number(part.trim()));
  if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
  const [lat, lng] = parts;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}

async function prepareVisionImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image. PDF analysis is not connected.');
  if (file.size > 20_000_000) throw new Error('Image is over 20 MB. Choose a smaller file.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the image.');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not encode image.')), 'image/jpeg', 0.82));
  if (blob.size > 4_500_000) throw new Error('Image is too large after compression. Try a smaller image.');
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read image.'));
    reader.onerror = () => reject(new Error('Could not read image.'));
    reader.readAsDataURL(blob);
  });
}

export function RapidAssistant({ selected, onRoute }: { selected: Region; onRoute: (coordinates: [number, number][], destination: Coordinate) => void }) {
  const [open, setOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [apiState, setApiState] = useState<'checking' | 'ready' | 'offline'>('checking');
  const [visionEnabled, setVisionEnabled] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([starter]);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [tool, setTool] = useState<AssistantTool | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState('');
  const [siteReports, setSiteReports] = useState('');
  const [people, setPeople] = useState('');
  const [vulnerable, setVulnerable] = useState('');
  const [trapped, setTrapped] = useState(false);
  const [injured, setInjured] = useState(false);
  const [fire, setFire] = useState(false);
  const [flood, setFlood] = useState(false);
  const [checkedNoDanger, setCheckedNoDanger] = useState(false);
  const [start, setStart] = useState('');
  const [destination, setDestination] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    let active = true;
    fetch('/api/assistant/capabilities').then(response => response.ok ? response.json() : Promise.reject())
      .then(data => { if (active) { setApiState(data.chat_enabled ? 'ready' : 'offline'); setVisionEnabled(Boolean(data.vision_llm || data.connectors?.vision_llm)); } })
      .catch(() => { if (active) setApiState('offline'); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, open]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function addMessage(text: string, source?: string, severity?: Message['severity']) {
    setMessages(current => [...current, { id: Date.now() + Math.random(), role: 'assistant', text, source, severity }]);
  }

  async function runAssessment() {
    if (!report.trim() && !trapped && !injured && !fire && !flood && !checkedNoDanger) {
      addMessage('Enter observed conditions or explicitly confirm that you checked and found no immediate danger. Without that evidence, I cannot assign a risk level.', 'Evidence required', 'unknown');
      return;
    }
    setBusy(true);
    try {
      const weather = await fetchLiveWeather(selected.lat, selected.lng);
      const severity: NonNullable<Message['severity']> = trapped || injured ? 'critical' : fire || flood ? 'high' : report.trim() || Number(people) > 0 ? 'moderate' : checkedNoDanger ? 'low' : 'unknown';
      const labels = { low: '🟢 LOW', moderate: '🟡 MODERATE', high: '🟠 HIGH', critical: '🔴 CRITICAL', unknown: '⚪ UNKNOWN' };
      const reportedCounts = [people && `${people} people reported`, vulnerable && `${vulnerable} reported as vulnerable`].filter(Boolean).join('; ') || 'No population count supplied';
      const conditions = [trapped && 'people reported trapped', injured && 'injuries reported', fire && 'fire reported', flood && 'flooding reported'].filter(Boolean).join(', ') || 'No immediate-danger flags supplied';
      const text = `${labels[severity]} — preliminary triage for ${selected.name}, ${selected.state}.\n\nReported conditions: ${report.trim() || 'No narrative supplied'}. Flags: ${conditions}.\nReported exposure: ${reportedCounts}. These counts are user-provided only; RAPID has no verified demographic or population dataset connected.\n\nLive weather at the selected region (${weather.observedAt} local): ${weather.temperature}°C, ${describeWeather(weather.code)}, wind ${weather.windSpeed} km/h, humidity ${weather.humidity}%. ${weather.days[0] ? `Today's forecast: ${weather.days[0].tempMax}°/${weather.days[0].tempMin}°C, ${weather.days[0].rainSum} mm rain.` : ''}\n\nPriority: treat reported trapped or injured people as the first rescue check if responders can reach them safely; then verify vulnerable-group needs and other reported sites. Confirm details with local responders. This is a report-based triage label, not an official warning or a validated prediction.`;
      addMessage(text, 'User report + Open-Meteo live weather', severity);
    } catch {
      addMessage('Live weather could not be fetched. The incident notes remain user-reported only; no weather-based assessment was added. Retry when connected.', 'Weather source unavailable', 'unknown');
    } finally { setBusy(false); }
  }

  async function runForecast() {
    setBusy(true);
    try {
      const weather = await fetchLiveWeather(selected.lat, selected.lng);
      const outlook = weather.days.map(day => `${day.date}: ${describeWeather(day.code)}, ${day.tempMin}–${day.tempMax}°C, ${day.rainSum} mm rain${day.rainChance == null ? '' : ` (up to ${day.rainChance}% chance)`}, wind up to ${day.windMax} km/h`).join('\n');
      addMessage(`Weather outlook for ${selected.name}, ${selected.state}. Current: ${weather.temperature}°C, ${describeWeather(weather.code)}, wind ${weather.windSpeed} km/h.\n${outlook}\n\nThis is a weather outlook, not a disaster prediction. No validated flood, cyclone, earthquake, fire, or evacuation forecast model is connected.`, 'Open-Meteo forecast', 'unknown');
    } catch { addMessage('The weather forecast source is unavailable right now. No hazard prediction was generated.', 'Open-Meteo unavailable', 'unknown'); }
    finally { setBusy(false); }
  }

  function runPrioritization() {
    const rows = siteReports.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      const [location, ...fields] = line.split('|').map(part => part.trim());
      const read = (key: string) => {
        const match = fields.join(' ').match(new RegExp(`${key}\\s*[:=]\\s*(\\d+)`, 'i'));
        return match ? Number(match[1]) : 0;
      };
      return { location, trapped: read('trapped'), injured: read('injured'), vulnerable: read('vulnerable'), people: read('people') };
    }).filter(site => site.location);
    if (rows.length < 2) {
      addMessage('Add at least two location reports so I can compare them. Use one line per place: Location | trapped: 2 | injured: 1 | vulnerable: 4 | people: 20. Counts must come from a person or source you trust.', 'More location reports needed');
      return;
    }
    const ordered = [...rows].sort((a, b) => b.trapped - a.trapped || b.injured - a.injured || b.vulnerable - a.vulnerable || b.people - a.people);
    const lines = ordered.map((site, index) => `${index + 1}. ${site.location} — ${site.trapped} trapped, ${site.injured} injured, ${site.vulnerable} vulnerable people reported${site.people ? `, ${site.people} people reported` : ''}`).join('\n');
    addMessage(`Reported-need order for human review:\n${lines}\n\nThe order sorts only the counts you entered (trapped, injured, vulnerable, then total people). It does not measure hazard severity, access, distance, road safety, or available responders, and is not an evacuation or dispatch order. Verify each site with local responders before acting.`, 'User-entered site counts · not independently verified');
  }

  async function requestRoute() {
    const from = parseCoordinate(start), to = parseCoordinate(destination);
    if (!from || !to) { addMessage('Enter the start and a destination as latitude, longitude (for example: 12.97, 77.59). Use a destination you have independently confirmed as a safe place.', 'Route input required'); return; }
    setBusy(true);
    try {
      const pair = `${from.lng},${from.lat};${to.lng},${to.lat}`;
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${pair}?overview=full&geometries=geojson&steps=true`);
      if (!response.ok) throw new Error('Routing service unavailable');
      const data = await response.json();
      const route = data.routes?.[0];
      if (!route?.geometry?.coordinates?.length) throw new Error('No road route returned');
      const coordinates = route.geometry.coordinates as [number, number][];
      onRoute(coordinates, to);
      addMessage(`A candidate driving route is drawn on the map (${(route.distance / 1000).toFixed(1)} km, about ${Math.round(route.duration / 60)} minutes according to the road graph). It is NOT verified as safe: live closures, flood/fire boundaries, evacuation orders, road access, shelters, and current conditions are unavailable. Follow official responder instructions and do not enter a hazardous area.`, 'OSRM road network only');
      setTool(null);
    } catch {
      addMessage('A candidate route could not be retrieved. Check the coordinates and connection. RAPID cannot verify road closures, hazards, shelters, or route safety.', 'Routing service unavailable');
    } finally { setBusy(false); }
  }

  async function analyzeAttachment(attached: File, question = '') {
    const stamp = Date.now();
    setMessages(current => [...current,
      { id: stamp, role: 'user', text: question || `Attached ${attached?.name}` },
      { id: stamp + 1, role: 'assistant', text: attached ? `Preparing “${attached.name}” for visual analysis…` : 'Checking the regional context…' },
    ]);
    setInput(''); setAttachment(null);
    setBusy(true);
    try {
      if (!visionEnabled && apiState === 'offline') throw new Error('The Groq vision API is not configured on the local backend.');
      const image_data_url = await prepareVisionImage(attached);
      const response = await fetch('/api/assistant/vision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        image_data_url, prompt: question || `Describe visible disaster conditions and damage near the selected dashboard region (${selected.name}, ${selected.state}). Treat the region as user-provided context, not as a location verified from the image. Mention uncertainty and visible evidence only. Do not infer demographics or official risk level.`,
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Image analysis is unavailable.');
      setMessages(current => current.map(message => message.id === stamp + 1 ? { ...message, text: `${data.analysis}\n\nImage was sent to Groq for inference. RAPID did not save a copy. Image interpretation is not a verified location, demographic count, or official hazard assessment.` , source: `Groq vision · ${data.model}` } : message));
    } catch (error) {
      setMessages(current => current.map(message => message.id === stamp + 1 ? { ...message, text: `${error instanceof Error ? error.message : 'Image analysis failed.'} No visual findings were generated.` , source: 'Image analysis unavailable' } : message));
    } finally {
      setBusy(false);
    }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const question = input.trim();
    if (!question && !attachment) return;
    if (attachment) {
      await analyzeAttachment(attachment, question);
      return;
    }
    const stamp = Date.now();
    setMessages(current => [...current,
      { id: stamp, role: 'user', text: question },
      { id: stamp + 1, role: 'assistant', text: 'Checking the regional context…' },
    ]);
    setInput('');
    if (/history|historical|past|record|happen|occur|event/.test(question.toLowerCase())) {
      const answer = localAnswer(question, selected);
      setMessages(current => current.map(message => message.id === stamp + 1 ? { ...message, ...answer } : message));
      return;
    }
    try {
      const response = await fetch('/api/assistant/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        message: question, region: selected.name, state: selected.state, hazard: selected.hazard, risk_score: selected.score, scenario_summary: selected.summary,
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Assistant API unavailable');
      setApiState('ready');
      setMessages(current => current.map(message => message.id === stamp + 1 ? { ...message, text: data.response, source: `Groq · ${data.model}` } : message));
    } catch {
      setApiState('offline');
      const answer = localAnswer(question, selected);
      setMessages(current => current.map(message => message.id === stamp + 1 ? { ...message, ...answer, source: 'Local information mode · API unavailable' } : message));
    }
  }

  return <>
    <button type="button" className={`rapid-assistant-trigger ${open ? 'active' : ''}`} onClick={() => setOpen(value => !value)} aria-label={open ? 'Close RAPID assistant' : 'Open RAPID assistant'} aria-expanded={open} aria-controls="rapid-assistant-panel">
      <span className="rapid-assistant-avatar"><AubitPod /></span><span className="rapid-assistant-trigger-copy"><strong>AI ASSISTANT</strong><small>Ask RAPID</small></span><span className="rapid-assistant-presence" />
    </button>
    {open && <section id="rapid-assistant-panel" className="rapid-assistant-panel" aria-label="RAPID assistant">
      <header className="rapid-assistant-header"><AubitPod /><div><strong>RAPID ASSISTANT</strong><span>{apiState === 'ready' ? 'Groq AI · connected' : apiState === 'checking' ? 'Connecting to local AI…' : 'Local information mode · API offline'}</span></div><button type="button" onClick={() => setOpen(false)} aria-label="Close assistant"><X size={18} /></button></header>
      <div className="rapid-assistant-context"><MapPin size={14} /><span>Viewing {selected.name}, {selected.state}</span><span>Region context</span></div>
      <div className="rapid-assistant-body">
      <aside className="rapid-assistant-action-rail" aria-label="Assistant actions">
      <div className="rapid-assistant-tools" aria-label="Assistant actions">
        <button type="button" onClick={() => setTool(tool === 'analyze' ? null : 'analyze')} aria-pressed={tool === 'analyze'}><Activity size={14} />Analyze</button>
        <button type="button" onClick={() => { setTool('forecast'); void runForecast(); }} aria-pressed={tool === 'forecast'}><CloudSun size={14} />Forecast</button>
        <button type="button" onClick={() => setTool(tool === 'prioritize' ? null : 'prioritize')} aria-pressed={tool === 'prioritize'}><Target size={14} />Prioritize</button>
        <button type="button" onClick={() => setTool(tool === 'route' ? null : 'route')} aria-pressed={tool === 'route'}><Route size={14} />Route</button>
        <button type="button" onClick={() => setTool(tool === 'risks' ? null : 'risks')} aria-pressed={tool === 'risks'}><ShieldAlert size={14} />Risks</button>
      </div>
      {(tool === 'analyze' || tool === 'risks') && <div className="rapid-assistant-tool-form"><strong>{tool === 'risks' ? 'Risk assessment' : 'Incident assessment'} · {selected.state}</strong><textarea value={report} onChange={event => setReport(event.target.value)} placeholder="Describe what responders or residents have reported…" aria-label="Observed incident details" />
        <div className="rapid-assistant-counts"><label>People reported<input inputMode="numeric" value={people} onChange={event => setPeople(event.target.value.replace(/\D/g, ''))} placeholder="Optional" /></label><label>Vulnerable people reported<input inputMode="numeric" value={vulnerable} onChange={event => setVulnerable(event.target.value.replace(/\D/g, ''))} placeholder="Optional" /></label></div>
        <div className="rapid-assistant-checks">{[[trapped, setTrapped, 'People trapped'], [injured, setInjured, 'Injuries'], [fire, setFire, 'Fire reported'], [flood, setFlood, 'Flooding reported']].map(([checked, setter, label]) => <label key={String(label)}><input type="checkbox" checked={checked as boolean} onChange={event => (setter as (value: boolean) => void)(event.target.checked)} />{label as string}</label>)}</div>
        <label className="rapid-assistant-safe-check"><input type="checkbox" checked={checkedNoDanger} onChange={event => setCheckedNoDanger(event.target.checked)} />I checked and found no immediate danger</label>
        <button type="button" className="rapid-assistant-action" onClick={() => void runAssessment()} disabled={busy}><ShieldAlert size={14} />{busy ? 'Checking…' : 'Assess reported conditions'}</button>
        <small>Preliminary triage only. Weather is live; incident details and counts come from you. No demographic database or official hazard warnings are connected.</small></div>}
      {tool === 'prioritize' && <div className="rapid-assistant-tool-form"><strong>Compare reported locations</strong><p>One location per line. Only the counts you provide are used; missing counts are treated as zero.</p><textarea value={siteReports} onChange={event => setSiteReports(event.target.value)} placeholder={'Bhubaneswar | trapped: 2 | injured: 1 | vulnerable: 4\nGuwahati | trapped: 0 | injured: 0 | vulnerable: 8'} aria-label="Reported needs for multiple locations" /><button type="button" className="rapid-assistant-action" onClick={runPrioritization}><Target size={14} />Rank reported needs</button><small>This is not an evacuation or dispatch order. Road access, hazard exposure, and responder capacity are not checked.</small></div>}
      {tool === 'route' && <div className="rapid-assistant-tool-form"><strong>Candidate road route</strong><label>Start coordinates<input value={start} onChange={event => setStart(event.target.value)} placeholder="latitude, longitude" /></label><button type="button" className="rapid-assistant-location-button" onClick={() => navigator.geolocation?.getCurrentPosition(position => setStart(`${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`), () => addMessage('Location access was not granted. Enter coordinates manually.', 'Browser location'))}>Use my current location</button><label>Destination you confirmed as safe<input value={destination} onChange={event => setDestination(event.target.value)} placeholder="latitude, longitude" /></label><button type="button" className="rapid-assistant-action" onClick={() => void requestRoute()} disabled={busy}><Route size={14} />{busy ? 'Finding road route…' : 'Draw candidate route on map'}</button><small>Road-network route only. It does not check hazards, closures, evacuation orders, access, or shelter availability. Not a verified safe route.</small></div>}
      </aside>
      <div className="rapid-assistant-chat">
      <button type="button" className="rapid-assistant-workflow-toggle" aria-expanded={workflowOpen} onClick={() => setWorkflowOpen(value => !value)}><Database size={15} />How RAPID processes evidence<ChevronDown size={16} /></button>
      {workflowOpen && <ol className="rapid-assistant-workflow">{intelligenceStages.map((stage, index) => <li key={stage}><span>{String(index + 1).padStart(2, '0')}</span>{stage}</li>)}<p>Pipeline design · several live models and data feeds are pending</p></ol>}
      <div className="rapid-assistant-messages" role="log" aria-live="polite">{messages.map(message => <div key={message.id} className={`rapid-assistant-message ${message.role} ${message.severity ? `severity-${message.severity}` : ''}`}><span>{message.role === 'assistant' ? 'RAPID' : 'YOU'}</span><p>{message.text}</p>{message.source && <small>Source: {message.source}</small>}</div>)}<div ref={endRef} /></div>
      {messages.length === 1 && <div className="rapid-assistant-suggestions"><button type="button" onClick={() => { setTool('analyze'); }}>Analyze reported conditions</button><button type="button" onClick={() => { setTool('forecast'); void runForecast(); }}>Weather outlook</button></div>}
      {attachment && <div className="rapid-assistant-attachment"><Paperclip size={14} />{attachment.name}<button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment"><X size={14} /></button></div>}
      <small className="rapid-assistant-upload-notice">Images are sent to Groq for analysis; RAPID does not save a copy. Demographics and exact image location are not inferred.</small>
      <form className="rapid-assistant-compose" onSubmit={send}><label className="rapid-assistant-file" title="Attach an image for Groq vision analysis"><Paperclip size={18} /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0] ?? null; event.currentTarget.value = ''; if (file) void analyzeAttachment(file, input.trim()); }} aria-label="Attach image for analysis" /></label><textarea ref={inputRef} rows={2} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Ask about a region or historical event…" aria-label="Message RAPID assistant" /><button type="submit" aria-label="Send message" disabled={busy || (!input.trim() && !attachment)}><ArrowUp size={18} /></button></form>
      <footer>Reported facts, live weather, and sample scenarios are labeled separately</footer>
      </div>
      </div>
    </section>}
  </>;
}
