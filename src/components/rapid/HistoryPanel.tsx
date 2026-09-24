import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowLeft, Globe2, MapPin, Search } from 'lucide-react';
import { historyEvents, type HistoricalEvent } from './historyEvents';
import { HistoryMap } from './HistoryMap';
import { locateHistoryEvent } from './historyLocations';
import { historyArtStyle, historyTypes } from './historyTypes';

const newestFirst = (a: HistoricalEvent, b: HistoricalEvent) => b.year - a.year || b.date.localeCompare(a.date);

export function HistoryPanel() {
  const [hazard, setHazard] = useState<string | null>(null);
  const [allMap, setAllMap] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<HistoricalEvent | null>(null);
  const type = historyTypes.find(item => item.hazard === hazard);
  const showMap = Boolean(type || allMap);
  const events = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return historyEvents
      .filter(event => !hazard || event.hazards.includes(hazard))
      .filter(event => !normalized || [event.date, event.title, event.location, event.impact, event.summary, event.source, ...event.hazards].join(' ').toLowerCase().includes(normalized))
      .sort(newestFirst);
  }, [hazard, query]);
  const location = selected ? locateHistoryEvent(selected) : null;
  const siteEvents = selected && location ? events.filter(event => {
    const other = locateHistoryEvent(event);
    return other.lat === location.lat && other.lng === location.lng;
  }) : [];

  function chooseHazard(next: string | null) { setHazard(next); setAllMap(false); setSelected(null); setQuery(''); }

  return <section className={`rapid-history ${showMap ? 'is-map' : ''}`} aria-labelledby="rapid-history-title">
    <header className="rapid-history-heading">
      <div><span className="rapid-eyebrow">REPORT-SOURCED EVENT REGISTER</span><h2 id="rapid-history-title">{type ? type.label : allMap ? 'All historical events' : 'Choose a disaster type'}</h2></div>
      <span className="rapid-history-count">{events.length} EVENTS</span>
    </header>
    {showMap && <button className="rapid-history-back" onClick={() => chooseHazard(null)}><ArrowLeft size={14} /> All history records</button>}
    <div className="rapid-history-type-grid" role="group" aria-label="Historical disaster types">
      {historyTypes.map(item => {
        const count = historyEvents.filter(event => event.hazards.includes(item.hazard)).length;
        return <button key={item.hazard} className={`rapid-history-type ${hazard === item.hazard ? 'active' : ''}`} style={{ '--hazard-color': item.color } as CSSProperties} aria-pressed={hazard === item.hazard} onClick={() => chooseHazard(item.hazard)}>
          <span className="rapid-history-type-art" style={historyArtStyle(item)} aria-hidden="true" />
          <strong>{item.label}</strong><small>{count} EVENTS</small>
        </button>;
      })}
    </div>
    <div className="rapid-history-controls">
      <label className="rapid-history-search"><Search size={15} /><input value={query} onChange={event => { setQuery(event.target.value); setSelected(null); }} placeholder={type ? `Search ${type.label.toLowerCase()}` : 'Search all events or locations'} aria-label="Search historical events" /></label>
      {!showMap && <button className="rapid-history-show-all" onClick={() => { setAllMap(true); setSelected(null); }}><Globe2 size={13} /> Map all {historyEvents.length} events</button>}
    </div>
    {showMap ? <div className="rapid-history-explorer">
      <HistoryMap key={type?.hazard ?? 'all'} events={events} type={type} selected={selected} onSelect={setSelected} />
      <aside className="rapid-history-details" aria-label="Historical event details">
        {selected ? <div className="rapid-history-selected" key={selected.id}>
          <span className="rapid-eyebrow">EVENT STATS &amp; HISTORY</span>
          <h3>{selected.title}</h3>
          <div className="rapid-history-stat-grid"><span>DATE<strong>{selected.date}</strong></span><span>IMPACT<strong>{selected.impact}</strong></span></div>
          <p className="rapid-history-selected-place"><MapPin size={13} /> {selected.location}</p>
          <p>{selected.summary}</p>
          <div className="rapid-history-selected-source">SOURCE <strong>{selected.source}</strong>{selected.confidence && <em>VERIFY WITH OFFICIAL RECORDS</em>}</div>
          {location?.approximate && <small className="rapid-history-approx">Map point represents the reported area; the report does not give an exact event coordinate.</small>}
          {siteEvents.length > 1 && <div className="rapid-history-site-events"><strong>AT THIS LOCATION · {siteEvents.length} EVENTS</strong>{siteEvents.map(event => <button key={event.id} className={event.id === selected.id ? 'active' : ''} onClick={() => setSelected(event)}>{event.date} · {event.title}</button>)}</div>}
        </div> : <div className="rapid-history-select-hint"><MapPin size={21} /><strong>Select a map marker</strong><span>Open its event stats, report history and source.</span></div>}
        <div className="rapid-history-index"><strong>{(type?.label ?? 'All hazards').toUpperCase()} · {events.length} RECORDS</strong>{events.length ? events.map(event => <button key={event.id} className={selected?.id === event.id ? 'active' : ''} onClick={() => setSelected(event)}><time>{event.date}</time><span>{event.title}<small>{event.location}</small></span></button>) : <p>No events match this search.</p>}</div>
      </aside>
    </div> : <>
      <p className="rapid-history-note">Select a disaster type to see its historical events on the satellite map. Markers use the locations stated in the three supplied RAPID reports; broad locations are shown approximately. Recent records flagged “Verify” need checking against official sources.</p>
      {events.length ? <div className="rapid-history-list">{events.map(event => <article className="rapid-history-event" key={event.id}>
        <div className="rapid-history-event-top"><time>{event.date}</time>{event.confidence && <span className="rapid-history-verify">VERIFY</span>}</div>
        <h3>{event.title}</h3>
        <div className="rapid-history-tags">{event.hazards.map(item => <span key={item}>{item}</span>)}</div>
        <p className="rapid-history-location">{event.location}</p>
        <p className="rapid-history-impact">{event.impact}</p>
        <p className="rapid-history-summary">{event.summary}</p>
        <footer>SOURCE <span>{event.source}</span></footer>
      </article>)}</div> : <div className="rapid-history-empty">No history records match this search.</div>}
    </>}
  </section>;
}
