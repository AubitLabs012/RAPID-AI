import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { historyEvents, historyHazards } from './historyEvents';

export function HistoryPanel() {
  const [hazard, setHazard] = useState('All events');
  const [query, setQuery] = useState('');
  const events = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return historyEvents
      .filter(event => hazard === 'All events' || event.hazards.includes(hazard))
      .filter(event => !normalized || [event.date, event.title, event.location, event.impact, event.summary, event.source, ...event.hazards].join(' ').toLowerCase().includes(normalized))
      .sort((a, b) => b.year - a.year || b.date.localeCompare(a.date));
  }, [hazard, query]);

  return <section className="rapid-history" aria-labelledby="rapid-history-title">
    <header className="rapid-history-heading">
      <div><span className="rapid-eyebrow">FILTERABLE EVENT REGISTER</span><h2 id="rapid-history-title">Event timeline</h2></div>
      <span className="rapid-history-count">{events.length} EVENTS</span>
    </header>
    <div className="rapid-history-controls">
      <label className="rapid-history-search"><Search size={15} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search event or location" aria-label="Search historical events" /></label>
      <label className="rapid-history-filter"><span>HAZARD</span><select value={hazard} onChange={event => setHazard(event.target.value)} aria-label="Filter historical events by hazard">{historyHazards.map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <p className="rapid-history-note">Records transcribed from the three supplied RAPID hazard reports. Fatality estimates are reported as written in those documents; recent entries flagged “Verify” should be checked against official records.</p>
    {events.length ? <div className="rapid-history-list">{events.map(event => <article className="rapid-history-event" key={event.id}>
      <div className="rapid-history-event-top"><time>{event.date}</time>{event.confidence && <span className="rapid-history-verify">VERIFY</span>}</div>
      <h3>{event.title}</h3>
      <div className="rapid-history-tags">{event.hazards.map(item => <span key={item}>{item}</span>)}</div>
      <p className="rapid-history-location">{event.location}</p>
      <p className="rapid-history-impact">{event.impact}</p>
      <p className="rapid-history-summary">{event.summary}</p>
      <footer>SOURCE <span>{event.source}</span></footer>
    </article>)}</div> : <div className="rapid-history-empty">No history records match this search.</div>}
  </section>;
}
