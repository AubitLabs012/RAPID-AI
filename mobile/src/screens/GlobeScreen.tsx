import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Box, Crosshair, Layers, Mic, Search, UserRound } from "lucide-react";
import { Globe, type GlobeHandle } from "../components/Globe";
import { SearchOverlay } from "../components/SearchOverlay";
import { Timeline } from "../components/Timeline";
import { Sheet, cn, toast } from "../components/ui";
import { EventPreview } from "../components/EventPreview";
import { HAZARDS, HazardIcon, type HazardType } from "../lib/hazards";
import { goBack, navigate } from "../lib/router";
import { getMyPosition } from "../services/geocode";
import { useEvents, type DisasterEvent } from "../services/events";

const BASE = import.meta.env.BASE_URL;
const RANGE_HOURS = 7 * 24; // the feeds cover the last week
const SEVERITY_RANK = { High: 3, Moderate: 2, Watch: 1, Low: 0 } as const;

export function GlobeScreen() {
  const globeRef = useRef<GlobeHandle>(null);
  const events = useEvents();
  const [filter, setFilter] = useState<HazardType | "all">("all");
  const [hoursAgo, setHoursAgo] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<DisasterEvent | null>(null);
  const [search, setSearch] = useState<null | "type" | "voice">(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [showClouds, setShowClouds] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [me, setMe] = useState<{ lat: number; lon: number } | null>(null);

  // Events on the globe: the chosen hazard, known at the chosen time, and only significant quakes
  // (M4.5+) so the globe stays readable. The full list is on the Alerts tab.
  const visible = useMemo(() => {
    const cutoff = Date.now() - hoursAgo * 3600_000;
    return (events.data ?? [])
      .filter((e) => filter === "all" || e.type === filter)
      .filter((e) => e.time <= cutoff && e.time >= cutoff - RANGE_HOURS * 3600_000)
      .filter((e) => e.type !== "earthquake" || (e.magnitude ?? 0) >= 4.5 || filter === "earthquake")
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.time - a.time)
      .slice(0, 180);
  }, [events.data, filter, hoursAgo]);

  async function locate() {
    const pos = await getMyPosition();
    if (!pos) return toast("Location is off. Allow location access to see where you are.");
    setMe(pos);
    globeRef.current?.focus(pos.lat, pos.lon);
  }

  return (
    <div data-theme="dark" className="relative flex h-full flex-col overflow-hidden bg-[#050a16] text-white">
      <img src={`${BASE}starfield.jpg`} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70" />

      <header className="safe-top relative z-10 flex items-center gap-3 px-4 pb-3">
        <button type="button" onClick={() => goBack()} aria-label="Back" className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 text-white">
          <ArrowLeft size={19} />
        </button>
        <img src={`${BASE}logo-96.png`} alt="" className="size-11 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-[21px] leading-tight font-bold tracking-[0.12em]">RAPID-AI</p>
          <p className="text-[12px] text-white/75">Disaster Intelligence Network</p>
        </div>
        <button type="button" onClick={() => navigate("/more")} aria-label="Profile" className="grid size-11 place-items-center rounded-xl border border-white/20 bg-white/10">
          <UserRound size={22} />
        </button>
      </header>

      <div className="relative z-10 px-4">
        <div className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-3 text-slate-500 shadow-lg">
          <button type="button" onClick={() => setSearch("type")} className="flex min-w-0 flex-1 items-center gap-2.5 text-left text-[14px]">
            <Search size={18} aria-hidden />
            <span className="truncate">Search any location… (e.g. India, Tokyo)</span>
          </button>
          <button type="button" aria-label="Search by voice" onClick={() => setSearch("voice")} className="text-slate-700">
            <Mic size={18} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2" role="toolbar" aria-label="Filter by hazard">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
          {HAZARDS.map((h) => (
            <Chip key={h.type} active={filter === h.type} onClick={() => setFilter(filter === h.type ? "all" : h.type)}>
              <HazardIcon type={h.type} size={16} /> {h.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="relative z-0 mt-1 min-h-0 flex-1">
        {/* Leave room at the bottom so the timeline doesn't cover the globe. */}
        <div className="absolute inset-x-0 top-0 bottom-[72px]">
          <Globe ref={globeRef} events={visible} selectedId={selected?.id} onSelect={setSelected} showClouds={showClouds} showGrid={showGrid} me={me} />
        </div>

        <div className="pointer-events-none absolute top-3 left-4 flex flex-col items-start gap-1.5">
          <span className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold">
            <span className={cn("size-2 rounded-full", hoursAgo === 0 ? "bg-green-400" : "bg-amber-400")} aria-hidden />
            {hoursAgo === 0 ? "Live" : `Replay −${formatAgo(hoursAgo)}`}
          </span>
          <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-white/80">
            {events.isPending ? "Loading live events…" : events.isError ? "Live feeds unavailable" : `${visible.length} events on globe`}
          </span>
        </div>

        <div className="absolute top-3 right-4 flex flex-col gap-2.5">
          <RoundButton label="Show my location" onClick={locate}><Crosshair size={20} /></RoundButton>
          <RoundButton label="Globe layers" onClick={() => setLayersOpen(true)}><Layers size={20} /></RoundButton>
          <RoundButton label="Open 2D map" onClick={() => navigate("/map")}><span className="text-[13px] font-bold">2D</span></RoundButton>
        </div>

        <div className="absolute inset-x-3 bottom-3">
          <Timeline
            value={hoursAgo}
            max={RANGE_HOURS}
            step={6}
            onChange={setHoursAgo}
            playing={playing}
            setPlaying={setPlaying}
            labels={["-7d", "-3d", "Now"]}
            formatValue={formatAgo}
          />
        </div>
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        {selected && <EventPreview event={selected} />}
      </Sheet>

      <Sheet open={layersOpen} onClose={() => setLayersOpen(false)} title="Globe layers">
        <Toggle label="Clouds" checked={showClouds} onChange={setShowClouds} />
        <Toggle label="Coordinate grid" checked={showGrid} onChange={setShowGrid} />
        <p className="mt-4 mb-4 text-[12px] leading-relaxed text-muted">
          <Box size={12} className="mr-1 inline" aria-hidden />
          Events: USGS earthquakes (M4.5+ on the globe) and NASA EONET open events. Tap a marker for details.
        </p>
      </Sheet>

      {search && <SearchOverlay events={events.data ?? []} startListening={search === "voice"} onClose={() => setSearch(null)} />}
    </div>
  );
}

function formatAgo(h: number) {
  return h >= 24 ? `${Math.round(h / 24)}d` : `${h}h`;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium shadow-sm",
        active ? "bg-indigo-500 text-white ring-2 ring-indigo-300" : "bg-white text-slate-800",
      )}
    >
      {children}
    </button>
  );
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-12 place-items-center rounded-full bg-white text-slate-900 shadow-lg">
      {children}
    </button>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between border-b border-line py-3 text-[15px]">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-indigo-500" />
    </label>
  );
}
