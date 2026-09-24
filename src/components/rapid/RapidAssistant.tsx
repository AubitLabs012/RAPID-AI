import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, ChevronDown, Database, MapPin, Paperclip, X } from 'lucide-react';
import assistantImage from '../../assets/rapid-assistant.png';
import { historyEvents } from './historyEvents';
import { regions, type Region } from './regions';
import './rapid-assistant.css';

type Message = { id: number; role: 'assistant' | 'user'; text: string; source?: string };

export const intelligenceStages = [
  'Multi-source data',
  'Multimodal AI analysis',
  'Evidence verification',
  'Damage & risk assessment',
  'Geographic intelligence',
  'Incident clustering',
  'Priority engine',
  'Prediction / situation forecast',
  'Response recommendation',
  'Responder dashboard + alerts',
] as const;

const starter: Message = {
  id: 0,
  role: 'assistant',
  text: 'I can help you explore RAPID’s sample regional scenarios and the historical disaster reports. Live AI analysis is awaiting your API connection.',
};

function localAnswer(question: string, selected: Region): Pick<Message, 'text' | 'source'> {
  const query = question.toLowerCase();
  const matchedRegion = regions.find(region =>
    [region.name, region.state].some(name => query.includes(name.toLowerCase())),
  ) ?? selected;
  const hazardNames = ['cyclone', 'flood', 'tsunami', 'volcanic', 'earthquake', 'landslide'];
  const hazard = hazardNames.find(name => query.includes(name));
  const historyRequested = /history|historical|past|record|happen|occur|event/.test(query);

  if (historyRequested || (hazard && !/risk|forecast|predict/.test(query))) {
    const matches = historyEvents
      .filter(event => !hazard || event.hazards.some(type => type.toLowerCase().includes(hazard)))
      .filter(event => ![matchedRegion.name, matchedRegion.state].some(name => query.includes(name.toLowerCase()))
        || event.location.toLowerCase().includes(matchedRegion.state.toLowerCase()))
      .sort((a, b) => b.year - a.year);
    if (!matches.length) return { text: `I found no matching ${hazard ?? 'disaster'} records for ${matchedRegion.state} in the three supplied reports. Try the History section for all events.`, source: 'Supplied RAPID historical reports' };
    const preview = matches.slice(0, 3).map(event => `${event.date}: ${event.title} (${event.location})`).join('\n');
    return { text: `I found ${matches.length} matching report record${matches.length === 1 ? '' : 's'}:\n${preview}${matches.length > 3 ? '\nOpen History to see the full list and map.' : ''}`, source: 'Supplied RAPID historical reports' };
  }
  if (/risk|region|area|damage|assess|forecast|predict|weather|alert/.test(query)) {
    return {
      text: `${matchedRegion.name}, ${matchedRegion.state} is a ${matchedRegion.hazard.toLowerCase()} sample scenario. Its illustrative risk index is ${matchedRegion.score}/100 (${matchedRegion.level.toLowerCase()}). ${matchedRegion.summary}\n\nThis is not a live warning or model forecast. Select its map marker for the regional view and live weather.`,
      source: 'RAPID sample scenario',
    };
  }
  if (/pipeline|work|source|data|verify|ai/.test(query)) {
    return { text: `RAPID’s intended flow has ${intelligenceStages.length} stages, from collecting source data through verification, geographic analysis, priorities, forecasts, recommendations, and alerts. The live model, vision, and external feeds are pending API credentials and deployment. Open “How it works” to see every stage.`, source: 'RAPID workflow design' };
  }
  return { text: `Try asking “What is the risk in ${selected.state}?” or “Show cyclone history.” I can answer from the visible sample regions and supplied historical reports; live AI analysis will be available after the API is connected.`, source: 'Local information mode' };
}

export function RapidAssistant({ selected }: { selected: Region }) {
  const [open, setOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([starter]);
  const [attachment, setAttachment] = useState<File | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, open]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function send(event?: FormEvent) {
    event?.preventDefault();
    const question = input.trim();
    if (!question && !attachment) return;
    const answer = attachment
      ? { text: `“${attachment.name}” is ready as evidence, but image/document analysis is waiting for the AI API and secure upload storage. No file was uploaded.`, source: 'API pending' }
      : localAnswer(question, selected);
    const stamp = Date.now();
    setMessages(current => [...current,
      { id: stamp, role: 'user', text: question || `Attached ${attachment?.name}` },
      { id: stamp + 1, role: 'assistant', ...answer },
    ]);
    setInput('');
    setAttachment(null);
  }

  return <>
    <button type="button" className={`rapid-assistant-trigger ${open ? 'active' : ''}`} onClick={() => setOpen(value => !value)} aria-label={open ? 'Close RAPID assistant' : 'Open RAPID assistant'} aria-expanded={open} aria-controls="rapid-assistant-panel">
      <span className="rapid-assistant-avatar"><img src={assistantImage} alt="" /></span>
      <span className="rapid-assistant-trigger-copy"><strong>AI ASSISTANT</strong><small>Ask RAPID</small></span>
      <span className="rapid-assistant-presence" />
    </button>
    {open && <section id="rapid-assistant-panel" className="rapid-assistant-panel" aria-label="RAPID assistant">
      <header className="rapid-assistant-header">
        <img src={assistantImage} alt="" />
        <div><strong>RAPID ASSISTANT</strong><span>Local information mode · AI API pending</span></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant"><X size={18} /></button>
      </header>
      <div className="rapid-assistant-context"><MapPin size={14} /><span>Viewing {selected.name}, {selected.state}</span><span>Sample scenario</span></div>
      <button type="button" className="rapid-assistant-workflow-toggle" aria-expanded={workflowOpen} onClick={() => setWorkflowOpen(value => !value)}><Database size={15} /> How RAPID processes evidence <ChevronDown size={16} /></button>
      {workflowOpen && <ol className="rapid-assistant-workflow">{intelligenceStages.map((stage, index) => <li key={stage}><span>{String(index + 1).padStart(2, '0')}</span>{stage}</li>)}<p>Pipeline design · live connectors and models are pending</p></ol>}
      <div className="rapid-assistant-messages" role="log" aria-live="polite">{messages.map(message => <div key={message.id} className={`rapid-assistant-message ${message.role}`}><span>{message.role === 'assistant' ? 'RAPID' : 'YOU'}</span><p>{message.text}</p>{message.source && <small>Source: {message.source}</small>}</div>)}<div ref={endRef} /></div>
      {messages.length === 1 && <div className="rapid-assistant-suggestions"><button onClick={() => { setInput(`What is the risk in ${selected.state}?`); inputRef.current?.focus(); }}>Regional risk</button><button onClick={() => { setInput('Show cyclone history'); inputRef.current?.focus(); }}>Cyclone history</button></div>}
      {attachment && <div className="rapid-assistant-attachment"><Paperclip size={14} />{attachment.name}<button onClick={() => setAttachment(null)} aria-label="Remove attachment"><X size={14} /></button></div>}
      <form className="rapid-assistant-compose" onSubmit={send}><label className="rapid-assistant-file" title="Attach evidence (preview only)"><Paperclip size={18} /><input type="file" accept="image/*,.pdf,.txt" onChange={event => setAttachment(event.target.files?.[0] ?? null)} aria-label="Attach evidence" /></label><textarea ref={inputRef} rows={2} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Ask about a region or historical event…" aria-label="Message RAPID assistant" /><button type="submit" aria-label="Send message" disabled={!input.trim() && !attachment}><ArrowUp size={18} /></button></form>
      <footer>Report records and sample scenarios only · Verify before response decisions</footer>
    </section>}
  </>;
}
