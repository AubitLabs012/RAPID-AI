import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Info } from "lucide-react";
import { ScreenHeader } from "../components/ui";
import { distanceKm, timeAgo } from "../lib/geo";
import { hazard, type HazardType } from "../lib/hazards";
import { fetchAllEvents } from "../services/events";
import { getMyPosition, nameForPosition, searchPlaces } from "../services/geocode";
import { describeWeather, fetchWeather, weatherAlerts, weatherRisk } from "../services/weather";

const BASE = import.meta.env.BASE_URL;

// No AI model is connected yet (the backend's assistant API is still "configuration pending").
// This assistant answers simple questions from the live feeds and built-in safety guidance.
type Msg = { id: number; from: "me" | "bot"; text: string };
type Place = { name: string; lat: number; lon: number };

const TIPS: Record<HazardType, string> = {
  flood: "Flood safety:\n• Move to higher ground early; don't wait to be told twice.\n• Never walk or drive through flood water — 15 cm of moving water can knock you over, 60 cm can float a car.\n• Switch off electricity at the mains if water is coming in.\n• Drink only boiled or bottled water.",
  earthquake: "Earthquake safety:\n• Drop, Cover and Hold On under a sturdy table until the shaking stops.\n• Stay away from windows, shelves and outside walls.\n• If outside, move to an open area away from buildings and wires.\n• Expect aftershocks; check for gas leaks before using flames.",
  cyclone: "Cyclone safety:\n• Follow IMD bulletins and evacuate at once if told to.\n• Stay indoors away from windows; the calm 'eye' is not the end.\n• Keep a kit ready: water, food, torch, medicines, documents, charged phone.\n• Stay away from the coast and fallen power lines.",
  landslide: "Landslide safety:\n• Avoid steep slopes and hill roads during heavy rain.\n• Warning signs: new cracks, tilting trees or poles, sudden muddy water, rumbling sounds.\n• Move away from the slide's path, across rather than downhill.",
  wildfire: "Wildfire safety:\n• Leave early if authorities advise it; don't wait for flames.\n• Keep windows and doors closed; wear a mask (N95) against smoke.\n• Keep a clear route out and a full tank of fuel.",
  weather: "Severe weather safety:\n• During thunderstorms stay indoors and away from trees, water and metal.\n• In heat: drink water often, avoid the sun from 12–4 pm, wear light clothes, check on elderly people.\n• Heatstroke signs (confusion, hot dry skin): cool the person and call 108.",
  volcano: "Volcano safety:\n• Follow evacuation orders immediately.\n• Protect against ash: stay indoors, wear a mask and goggles, keep windows shut.\n• Avoid river valleys downstream, where mudflows travel.",
};

const EMERGENCY = "Emergency numbers in India:\n• 112 — all emergencies\n• 108 — ambulance\n• 101 — fire\n• 1078 — NDMA disaster helpline\nAlways follow IMD, NDMA and local authority instructions.";

const SUGGESTIONS = ["Weather here", "Disasters near me", "Latest earthquakes", "Flood safety tips", "Emergency numbers"];

function findHazard(q: string): HazardType | null {
  if (/flood|rain/.test(q)) return "flood";
  if (/quake|tremor/.test(q)) return "earthquake";
  if (/cyclone|storm|hurricane|typhoon/.test(q)) return "cyclone";
  if (/landslide|mudslide/.test(q)) return "landslide";
  if (/fire/.test(q)) return "wildfire";
  if (/volcan/.test(q)) return "volcano";
  if (/heat|thunder|lightning|weather/.test(q)) return "weather";
  return null;
}

// "weather in Chennai" -> "Chennai"
function placeFromText(q: string) {
  const m = q.match(/\b(?:in|near|at|around|for)\s+([a-z][a-z .'-]{1,40})\??$/i);
  const name = m?.[1]?.trim();
  return name && !/^(me|here|my (area|location))$/i.test(name) ? name : null;
}

async function resolvePlace(q: string, context: Place | null): Promise<Place | null> {
  const named = placeFromText(q);
  if (named) {
    const [hit] = await searchPlaces(named);
    return hit ? { name: hit.name, lat: hit.lat, lon: hit.lon } : null;
  }
  if (/\b(me|here|my)\b/.test(q) || !context) {
    const pos = await getMyPosition();
    if (pos) return { ...pos, name: await nameForPosition(pos.lat, pos.lon) };
  }
  return context;
}

async function answer(raw: string, context: Place | null): Promise<string> {
  const q = raw.toLowerCase();
  try {
    if (/emergency|helpline|number|call|112/.test(q)) return EMERGENCY;

    const h = findHazard(q);
    if (/safe|safety|tip|prepare|what (should|to) do|precaution/.test(q)) return h ? TIPS[h] : `${TIPS.flood}\n\nAsk about a specific hazard, e.g. “earthquake safety”.`;

    if (/weather|temperature|rain|hot|forecast|wind/.test(q)) {
      const place = await resolvePlace(q, context);
      if (!place) return "Tell me a place, e.g. “weather in Chennai”, or allow location access.";
      const w = await fetchWeather(place.lat, place.lon);
      const alerts = weatherAlerts(w);
      const c = w.current;
      const today = w.daily[0];
      return `${place.name} now: ${describeWeather(c.code)}, ${Math.round(c.temperature)}°C (feels ${Math.round(c.feelsLike)}°C), wind ${Math.round(c.windSpeed)} km/h, humidity ${c.humidity}%.\nToday: ${Math.round(today.tempMin)}–${Math.round(today.tempMax)}°C, ${today.rainSum.toFixed(1)} mm rain (${today.rainChance}% chance).\nWeather risk: ${weatherRisk(w)}.${alerts.length ? `\n${alerts.map((a) => `• ${a.title}: ${a.detail}`).join("\n")}` : ""}`;
    }

    if (/disaster|quake|earthquake|fire|flood|cyclone|storm|volcan|landslide|near|latest|happening|alert/.test(q)) {
      const events = await fetchAllEvents();
      const nearMe = /near|here|around|my|close/.test(q) || placeFromText(q);
      const place = nearMe ? await resolvePlace(q, context) : null;
      let list = h ? events.filter((e) => e.type === h || (h === "weather" && e.type === "cyclone")) : events.filter((e) => e.type !== "earthquake" || (e.magnitude ?? 0) >= 4.5);
      // Nearby: every report within 500 km. Worldwide: skip small quakes (below M4.5).
      if (place) list = list.filter((e) => distanceKm(place, e) <= 500);
      else list = list.filter((e) => e.type !== "earthquake" || (e.magnitude ?? 0) >= 4.5);
      const top = list.slice(0, 4);
      const where = place ? ` within 500 km of ${place.name}` : " worldwide";
      if (!top.length) return `No ${h ? hazard(h).label.toLowerCase() : "disaster"} reports${where} in the last week.`;
      return `Latest ${h ? hazard(h).label.toLowerCase() + " " : ""}reports${where}:\n${top
        .map((e) => `• ${e.title} — ${e.place}, ${timeAgo(e.time)} (${e.severity})`)
        .join("\n")}\nSource: USGS and NASA EONET.`;
    }
  } catch {
    return "I couldn't reach the live data just now. Check your connection and try again.";
  }
  return "I can help with:\n• “Weather in Mumbai”\n• “Disasters near me”\n• “Latest earthquakes”\n• “Cyclone safety tips”\n• “Emergency numbers”";
}

export function AssistantScreen({ params }: { params: URLSearchParams }) {
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  const context: Place | null = params.get("name") && Number.isFinite(lat) && Number.isFinite(lon) ? { name: params.get("name")!, lat, lon } : null;
  const [messages, setMessages] = useState<Msg[]>([
    { id: 0, from: "bot", text: `Hi! I'm RAPID-AI. ${context ? `Ask me about ${context.name}, ` : "Ask me about "}the weather, disasters nearby, or how to stay safe.` },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function send(text: string, e?: FormEvent) {
    e?.preventDefault();
    const question = text.trim();
    if (!question || busy) return;
    const id = Date.now();
    setMessages((m) => [...m, { id, from: "me", text: question }]);
    setInput("");
    setBusy(true);
    const reply = await answer(question, context);
    setMessages((m) => [...m, { id: id + 1, from: "bot", text: reply }]);
    setBusy(false);
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title="Ask RAPID-AI" subtitle={context ? `About ${context.name}` : "Live data and safety advice"} />
      <p className="mx-4 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[12px] text-muted">
        <Info size={14} className="mt-0.5 shrink-0" /> Answers use live weather and disaster feeds plus standard safety guidance. No AI model is connected yet.
      </p>
      <div className="flex-1 space-y-3 px-4 py-4" aria-live="polite">
        {messages.map((m) =>
          m.from === "bot" ? (
            <div key={m.id} className="flex items-end gap-2">
              <img src={`${BASE}assistant.png`} alt="" className="size-8 shrink-0 rounded-full bg-surface-2 object-contain" />
              <p className="max-w-[80%] rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-line shadow-sm">{m.text}</p>
            </div>
          ) : (
            <p key={m.id} className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-[14px] text-white">{m.text}</p>
          ),
        )}
        {busy && <p className="ml-10 text-[13px] text-muted">Checking live data…</p>}
        <div ref={endRef} />
      </div>
      <div className="safe-bottom sticky bottom-0 space-y-2 border-t border-line bg-bg px-3 pt-2">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => send(s)} className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-2">
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => send(input, e)} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about weather, disasters or safety"
            aria-label="Message"
            className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-[15px] outline-none placeholder:text-muted"
            enterKeyHint="send"
          />
          <button type="submit" aria-label="Send" disabled={!input.trim() || busy} className="grid size-11 place-items-center rounded-full bg-accent text-white disabled:opacity-40">
            <ArrowUp size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
