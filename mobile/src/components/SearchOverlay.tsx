import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MapPin, Mic } from "lucide-react";
import { HazardIcon } from "../lib/hazards";
import { openPlace } from "../lib/router";
import { places } from "../lib/storage";
import { searchPlaces } from "../services/geocode";
import { eventPageName, type DisasterEvent } from "../services/events";

// The browser's speech recognition, where available (Chrome/Android, Safari iOS 14.5+).
type SpeechCtor = new () => { lang: string; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; start: () => void };
const Speech = ((window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: SpeechCtor }).webkitSpeechRecognition) as SpeechCtor | undefined;

type Picked = { lat: number; lon: number; name: string; event?: string };

// onPick defaults to opening the place page; the map passes its own to fly there instead.
export function SearchOverlay({
  onClose,
  events,
  startListening = false,
  onPick = openPlace,
}: {
  onClose: () => void;
  events: DisasterEvent[];
  startListening?: boolean;
  onPick?: (p: Picked) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const history = places.use().history;

  useEffect(() => {
    inputRef.current?.focus();
    if (startListening) listen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const results = useQuery({
    queryKey: ["search", debounced],
    queryFn: ({ signal }) => searchPlaces(debounced, signal),
    enabled: debounced.trim().length >= 2,
  });
  const q = query.trim().toLowerCase();
  const eventMatches = q.length >= 2 ? events.filter((e) => `${e.title} ${e.place} ${e.type}`.toLowerCase().includes(q)).slice(0, 5) : [];

  function listen() {
    if (!Speech) return;
    const rec = new Speech();
    rec.lang = "en-IN";
    rec.onresult = (e) => setQuery(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  return (
    <div className="fade-in absolute inset-0 z-40 flex flex-col bg-bg text-ink" role="dialog" aria-label="Search">
      <div className="safe-top flex items-center gap-2 px-3 pb-3">
        <button type="button" onClick={onClose} aria-label="Close search" className="grid size-10 place-items-center rounded-full active:bg-surface-2">
          <ArrowLeft size={22} />
        </button>
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any location… (e.g. India, Tokyo)"
            aria-label="Search any location"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
            enterKeyHint="search"
          />
          {results.isFetching && <Loader2 size={16} className="animate-spin text-muted" aria-label="Searching" />}
          {Speech && (
            <button type="button" onClick={listen} aria-label="Search by voice" className={listening ? "text-red-500" : "text-muted"}>
              <Mic size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-6">
        {eventMatches.length > 0 && (
          <Section title="Disasters">
            {eventMatches.map((e) => (
              <Row key={e.id} onClick={() => onPick({ lat: e.lat, lon: e.lon, name: eventPageName(e), event: e.id })} icon={<HazardIcon type={e.type} filled size={16} />} title={e.title} sub={e.place} />
            ))}
          </Section>
        )}
        {(results.data?.length ?? 0) > 0 && (
          <Section title="Places">
            {results.data!.map((p) => (
              <Row key={p.id} onClick={() => onPick(p)} icon={<MapPin size={18} className="text-accent" />} title={p.name} sub={p.region} />
            ))}
          </Section>
        )}
        {q.length >= 2 && !results.isFetching && !results.data?.length && !eventMatches.length && (
          <p className="px-3 py-8 text-center text-[14px] text-muted">{results.isError ? "Search is unavailable offline." : `No places found for “${query}”.`}</p>
        )}
        {q.length < 2 && history.length > 0 && (
          <Section title="Recent">
            {history.slice(0, 8).map((p) => (
              <Row key={`${p.lat},${p.lon}`} onClick={() => onPick(p)} icon={<MapPin size={18} className="text-muted" />} title={p.name} sub="" />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="px-2 pb-1 text-[12px] font-semibold tracking-wide text-muted uppercase">{title}</h2>
      <div className="card divide-y divide-line overflow-hidden">{children}</div>
    </section>
  );
}

function Row({ onClick, icon, title, sub }: { onClick: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-3 py-3 text-left active:bg-surface-2">
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{title}</span>
        {sub && <span className="block truncate text-[12px] text-muted">{sub}</span>}
      </span>
    </button>
  );
}
