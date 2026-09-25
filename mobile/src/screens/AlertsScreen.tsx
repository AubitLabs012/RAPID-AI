import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import { Empty, IconButton, ScreenHeader, Segmented, Skeleton, cn } from "../components/ui";
import { HAZARDS, HazardIcon, SeverityBadge, hazard, type HazardType } from "../lib/hazards";
import { INDIA_CENTER, distanceKm, isInIndia, satelliteThumb, timeAgo } from "../lib/geo";
import { openPlace } from "../lib/router";
import { getMyPosition, nameForPosition } from "../services/geocode";
import { eventPageName, useEvents, type DisasterEvent } from "../services/events";

type Scope = "nearby" | "india" | "world";
const NEARBY_KM = 1000;
const PAGE = 40;

export function AlertsScreen() {
  const events = useEvents();
  const [scope, setScope] = useState<Scope>("nearby");
  const [type, setType] = useState<HazardType | "all">("all");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [origin, setOrigin] = useState<{ lat: number; lon: number; name: string; fromDevice: boolean } | null>(null);

  // "Nearby" uses the phone's location; if that is refused we fall back to the centre of India.
  useEffect(() => {
    if (scope !== "nearby" || origin) return;
    let cancelled = false;
    getMyPosition().then(async (pos) => {
      if (cancelled) return;
      if (!pos) return setOrigin({ ...INDIA_CENTER, fromDevice: false });
      setOrigin({ ...pos, name: "your location", fromDevice: true });
      const name = await nameForPosition(pos.lat, pos.lon);
      if (!cancelled) setOrigin({ ...pos, name, fromDevice: true });
    });
    return () => {
      cancelled = true;
    };
  }, [scope, origin]);

  useEffect(() => {
    setLimit(PAGE);
  }, [scope, type, query]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = (events.data ?? []).map((e) => ({ ...e, km: origin ? distanceKm(origin, e) : undefined }));
    if (scope === "nearby") items = origin ? items.filter((e) => (e.km ?? Infinity) <= NEARBY_KM) : [];
    if (scope === "india") items = items.filter((e) => isInIndia(e));
    if (scope === "world") items = items.filter((e) => e.type !== "earthquake" || (e.magnitude ?? 0) >= 4.5);
    if (type !== "all") items = items.filter((e) => e.type === type);
    if (q) items = items.filter((e) => `${e.title} ${e.place} ${hazard(e.type).label}`.toLowerCase().includes(q));
    return items;
  }, [events.data, scope, origin, type, query]);

  return (
    <div className="pb-4">
      <ScreenHeader
        back={false}
        title="Find Disasters"
        actions={
          <IconButton label={searching ? "Close search" : "Search disasters"} onClick={() => { setSearching(!searching); setQuery(""); }}>
            {searching ? <X size={21} /> : <Search size={21} />}
          </IconButton>
        }
      />
      <div className="space-y-3 px-4">
        {searching && (
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by place or type"
            aria-label="Search disasters"
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none placeholder:text-muted"
          />
        )}
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: "nearby", label: "Nearby" },
            { value: "india", label: "India" },
            { value: "world", label: "World" },
          ]}
        />
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="toolbar" aria-label="Filter by hazard">
          <FilterChip active={type === "all"} onClick={() => setType("all")}>All</FilterChip>
          {HAZARDS.map((h) => (
            <FilterChip key={h.type} active={type === h.type} onClick={() => setType(type === h.type ? "all" : h.type)}>
              <HazardIcon type={h.type} size={14} /> {h.label}
            </FilterChip>
          ))}
        </div>

        {scope === "nearby" && origin && (
          <p className="text-[12px] text-muted">
            Within {NEARBY_KM.toLocaleString()} km of {origin.name}
            {!origin.fromDevice && " · turn on location to use where you are"}
          </p>
        )}
        {scope === "india" && <p className="text-[12px] text-muted">In and around India, including coastal waters</p>}
        {scope === "world" && <p className="text-[12px] text-muted">Worldwide · earthquakes M4.5+</p>}

        {(events.isPending || (scope === "nearby" && !origin)) && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />)}
        {events.isError && (
          <Empty title="Can't load disasters">
            Check your connection and try again.
            <button type="button" onClick={() => events.refetch()} className="mt-3 block w-full rounded-xl bg-accent py-2.5 text-[14px] font-semibold text-white">Retry</button>
          </Empty>
        )}
        {!events.isPending && !events.isError && (scope !== "nearby" || origin) && list.length === 0 && (
          <Empty title="Nothing reported">No matching disasters in this area in the last week.</Empty>
        )}

        <ul className="space-y-3">
          {list.slice(0, limit).map((e) => <DisasterCard key={e.id} event={e} km={e.km} />)}
        </ul>
        {list.length > limit && (
          <button type="button" onClick={() => setLimit(limit + PAGE)} className="w-full rounded-xl bg-surface-2 py-3 text-[14px] font-semibold text-accent">
            Show more ({list.length - limit})
          </button>
        )}
        {!events.isPending && <p className="pt-1 text-center text-[11px] text-muted">Sources: USGS earthquakes (7 days) · NASA EONET open events (30 days)</p>}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium",
        active ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink-2",
      )}
    >
      {children}
    </button>
  );
}

function DisasterCard({ event, km }: { event: DisasterEvent; km?: number }) {
  const h = hazard(event.type);
  return (
    <li>
      <button
        type="button"
        onClick={() => openPlace({ lat: event.lat, lon: event.lon, name: eventPageName(event), event: event.id })}
        className="card flex w-full items-center gap-3 p-2.5 text-left active:scale-[0.99]"
      >
        <img
          src={satelliteThumb(event)}
          alt=""
          loading="lazy"
          className="size-[72px] shrink-0 rounded-xl bg-surface-2 object-cover"
        />
        <HazardIcon type={event.type} size={24} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{event.type === "earthquake" ? event.title : h.label}</p>
          <p className="truncate text-[12px] text-muted">{event.type === "earthquake" ? event.place : event.title}</p>
          <p className="text-[12px] text-muted">
            {timeAgo(event.time)}
            {km != null && ` · ${Math.round(km).toLocaleString()} km`}
          </p>
          <div className="mt-1"><SeverityBadge severity={event.severity} /></div>
        </div>
        <ChevronRight size={18} className="shrink-0 text-muted" />
      </button>
    </li>
  );
}
