import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Globe2, LayoutGrid, LocateFixed, MapPin, Meh, Frown, Search, Smile, TriangleAlert, Lightbulb } from "lucide-react";
import { SearchOverlay } from "../components/SearchOverlay";
import { Sheet, Skeleton, cn, toast } from "../components/ui";
import { EMERGENCY_NUMBERS, GUIDES, type Guide } from "../lib/guides";
import { distanceKm, timeAgo } from "../lib/geo";
import { navigate, openPlace } from "../lib/router";
import { settings } from "../lib/storage";
import { getMyPosition, nameForPosition } from "../services/geocode";
import { eventPageName, useEvents, type DisasterEvent } from "../services/events";
import { describeWeather, useCitiesNow, useWeather, weatherAlerts, weatherIcon, type WeatherAlert } from "../services/weather";

const BASE = import.meta.env.BASE_URL;
const FALLBACK = { name: "New Delhi", lat: 28.6139, lon: 77.209 };
const DEFAULT_CITIES = [
  { name: "Mumbai", lat: 19.076, lon: 72.8777 },
  { name: "Chennai", lat: 13.0827, lon: 80.2707 },
  { name: "Kolkata", lat: 22.5726, lon: 88.3639 },
  { name: "Bengaluru", lat: 12.9716, lon: 77.5946 },
  { name: "Guwahati", lat: 26.1445, lon: 91.7362 },
  { name: "New Delhi", lat: 28.6139, lon: 77.209 },
];
const DAY = 24 * 3600_000;

type Status = "normal" | "watch" | "danger";

// The place Home watches: the one the user picked, else their location (if already allowed), else New Delhi.
function useHomePlace() {
  const { homePlace } = settings.use();
  useEffect(() => {
    if (homePlace) return;
    let cancelled = false;
    // Only use location automatically if permission was already given — never pop a prompt on launch.
    navigator.permissions?.query({ name: "geolocation" as PermissionName }).then(async (p) => {
      if (p.state !== "granted" || cancelled) return;
      const pos = await getMyPosition();
      if (pos && !cancelled) settings.set({ homePlace: { ...pos, name: await nameForPosition(pos.lat, pos.lon) } });
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [homePlace]);
  return homePlace ?? FALLBACK;
}

export function HomeScreen() {
  const home = useHomePlace();
  const events = useEvents();
  const weather = useWeather(home.lat, home.lon);
  const [changeOpen, setChangeOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [guide, setGuide] = useState<Guide | null>(null);

  // Significant events (not "Low") near home in the last two days, newest first.
  const nearby = useMemo(
    () =>
      (events.data ?? [])
        .filter((e) => e.severity !== "Low" && Date.now() - e.time < 2 * DAY)
        .map((e) => ({ ...e, km: distanceKm(home, e) }))
        .filter((e) => e.km <= 500)
        .sort((a, b) => b.time - a.time),
    [events.data, home],
  );
  const alerts = weather.data ? weatherAlerts(weather.data) : [];

  // Danger: a high weather alert, or a high-severity event within 300 km in the last day.
  // Watch: any weather alert or significant event within 500 km in the last two days.
  const status: Status =
    alerts.some((a) => a.severity === "High") || nearby.some((e) => e.severity === "High" && e.km <= 300 && Date.now() - e.time < DAY)
      ? "danger"
      : alerts.length || nearby.length
        ? "watch"
        : "normal";

  async function useMyLocation() {
    setChangeOpen(false);
    toast("Finding your location…");
    const pos = await getMyPosition();
    if (!pos) return toast("Location is off. Search for a place instead.");
    settings.set({ homePlace: { ...pos, name: await nameForPosition(pos.lat, pos.lon) } });
  }

  const now = new Date();
  return (
    <div className="space-y-4 px-4 pb-6">
      <header className="safe-top flex items-center justify-between pb-1">
        <button type="button" onClick={() => navigate("/tools")} aria-label="Tools" className="grid size-10 place-items-center rounded-xl text-ink active:bg-surface-2">
          <LayoutGrid size={22} />
        </button>
        <h1 className="text-[18px] font-semibold tracking-wide">RAPID-AI</h1>
        <button type="button" onClick={() => navigate("/about")} aria-label="About RAPID-AI" className="grid size-10 place-items-center">
          <img src={`${BASE}logo-96.png`} alt="" className="size-9 object-contain" />
        </button>
      </header>

      {/* Status card */}
      <section className="card overflow-hidden p-0">
        <div className="relative bg-gradient-to-br from-accent-soft via-surface to-surface px-4 pt-3 pb-4">
          <p className="text-[10px] text-muted">
            Update {now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <div className="flex items-center gap-2">
            <p className="flex-1 py-3 text-[17px] leading-snug font-medium">
              {status === "normal" && <>Everything looks normal.<br />Have a great day!</>}
              {status === "watch" && <>Some activity near you.<br />Stay aware today.</>}
              {status === "danger" && <>Stay alert!<br />Conditions near you need attention.</>}
            </p>
            <img src={`${BASE}assistant.png`} alt="" className="size-24 shrink-0 object-contain drop-shadow-md" />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setChangeOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-accent px-3 py-2 text-left text-[12px] text-white shadow-sm"
            >
              <MapPin size={15} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{home.name}</span>
              <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-accent">Change</span>
            </button>
            <StatusPill status={status} loading={weather.isPending || events.isPending} />
          </div>
        </div>
      </section>

      <WarningCard home={home} event={nearby[0]} alert={alerts[0]} loading={weather.isPending || events.isPending} />

      {/* Disaster guide */}
      <section>
        <h2 className="mb-2.5 text-[14px] font-semibold">Disaster Guide</h2>
        <div className="grid grid-cols-3 gap-3">
          {GUIDES.map((g) => (
            <button key={g.id} type="button" onClick={() => setGuide(g)} className="card flex flex-col items-center gap-2 py-3.5 active:scale-[0.98]">
              <span className="grid size-12 place-items-center rounded-2xl dark:!bg-white/10" style={{ background: g.tint }}>
                <g.Icon size={26} color={g.color} strokeWidth={2} />
              </span>
              <span className="text-[11px] font-medium text-ink-2">{g.label}</span>
            </button>
          ))}
        </div>
      </section>

      <CityForecast home={home} />

      <button type="button" onClick={() => navigate("/globe")} className="card flex w-full items-center gap-3 p-3 text-left active:scale-[0.99]">
        <span className="grid size-11 place-items-center rounded-xl bg-[#0b1024] text-white"><Globe2 size={22} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">Live disaster globe</span>
          <span className="block text-[12px] text-muted">{events.data ? `${events.data.length} events worldwide this week` : "Earthquakes, storms, fires and more"}</span>
        </span>
        <ChevronRight size={18} className="text-muted" />
      </button>

      <Sheet open={changeOpen} onClose={() => setChangeOpen(false)} title="Watch a location">
        <button type="button" onClick={useMyLocation} className="flex w-full items-center gap-3 border-b border-line py-3.5 text-left text-[15px]">
          <LocateFixed size={20} className="text-accent" /> Use my current location
        </button>
        <button type="button" onClick={() => { setChangeOpen(false); setPicking(true); }} className="flex w-full items-center gap-3 py-3.5 text-left text-[15px]">
          <Search size={20} className="text-accent" /> Search for a place
        </button>
        <p className="pb-4 text-[12px] text-muted">Home shows the status, warnings and weather for this place.</p>
      </Sheet>

      <Sheet open={!!guide} onClose={() => setGuide(null)} title={guide ? `${guide.label} safety` : undefined}>
        {guide && <GuideBody guide={guide} />}
      </Sheet>

      {picking && (
        <SearchOverlay
          events={[]}
          onClose={() => setPicking(false)}
          onPick={(p) => {
            settings.set({ homePlace: { name: p.name, lat: p.lat, lon: p.lon } });
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function StatusPill({ status, loading }: { status: Status; loading: boolean }) {
  if (loading) return <Skeleton className="h-8 w-24" />;
  const s = {
    normal: { label: "Normal", Icon: Smile, cls: "bg-emerald-500 text-white" },
    watch: { label: "Watch", Icon: Meh, cls: "bg-amber-400 text-amber-950" },
    danger: { label: "Danger", Icon: Frown, cls: "bg-red-500 text-white" },
  }[status];
  return (
    <span className={cn("flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold", s.cls)}>
      <s.Icon size={15} /> {s.label}
    </span>
  );
}

function WarningCard({ home, event, alert, loading }: { home: { name: string }; event?: DisasterEvent & { km: number }; alert?: WeatherAlert; loading: boolean }) {
  if (loading) return <Skeleton className="h-24" />;
  if (!event && !alert) {
    return (
      <section className="flex items-start gap-3 rounded-[20px] border border-line bg-accent-soft p-4">
        <Lightbulb size={22} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <p className="text-[13px] font-semibold text-accent">No warnings near {home.name}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">Tip: keep an emergency kit ready — water, torch, medicines, documents and a charged phone.</p>
        </div>
      </section>
    );
  }
  const text = event
    ? `${capitalise(timeAgo(event.time))} there was ${/^[AEIOU]/i.test(event.title) ? "an" : "a"} ${event.title} about ${Math.round(event.km)} km from ${home.name}. Stay safe!`
    : `${alert!.title}: ${alert!.detail} in ${home.name}. Stay safe!`;
  const Icon = event ? TriangleAlert : weatherIcon(alert!.kind === "storm" ? 95 : 63);
  return (
    <button
      type="button"
      onClick={() => (event ? openPlace({ lat: event.lat, lon: event.lon, name: eventPageName(event), event: event.id }) : undefined)}
      className="flex w-full items-center gap-3 rounded-[20px] border border-amber-200 bg-[#fdf0c4] p-4 text-left shadow-sm dark:border-amber-500/30 dark:bg-amber-500/15"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-red-600 dark:text-red-400">Warning!</p>
        <p className="mt-1 text-[12px] leading-relaxed text-amber-950 dark:text-amber-100">{text}</p>
      </div>
      <Icon size={40} strokeWidth={1.5} className="shrink-0 text-amber-800 dark:text-amber-300" />
    </button>
  );
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function CityForecast({ home }: { home: { name: string; lat: number; lon: number } }) {
  const cities = useMemo(() => {
    const list = [home, ...DEFAULT_CITIES.filter((c) => distanceKm(c, home) > 30)];
    return list.slice(0, 6);
  }, [home]);
  const now = useCitiesNow(cities);
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <section>
      <h2 className="mb-2.5 text-[14px] font-semibold">Weather Forecast <span className="font-normal text-muted">({today})</span></h2>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {now.isPending && [0, 1, 2].map((i) => <Skeleton key={i} className="h-[104px] w-[132px] shrink-0" />)}
        {now.isError && <p className="text-[13px] text-muted">Weather unavailable right now.</p>}
        {now.data?.map((c) => {
          const Icon = weatherIcon(c.code, c.isDay);
          return (
            <button key={c.name} type="button" onClick={() => openPlace(c)} className="card flex w-[132px] shrink-0 flex-col p-3 text-left active:scale-[0.98]">
              <span className="truncate text-[12px] text-muted">{c.name}</span>
              <span className="text-[12px] font-semibold">{c.localTime} {c.timezone.replace("GMT+5:30", "IST")}</span>
              <span className="mt-2 flex items-center gap-2">
                <Icon size={26} className="text-accent" />
                <span className="text-[20px] font-semibold">{Math.round(c.temperature)}°</span>
              </span>
              <span className="mt-1 truncate text-[11px] text-muted">{describeWeather(c.code)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function GuideBody({ guide }: { guide: Guide }) {
  const parts: [string, string[]][] = [["Before", guide.before], ["During", guide.during], ["After", guide.after]];
  return (
    <div className="space-y-4 pb-4">
      {parts.map(([title, items]) => (
        <section key={title}>
          <h3 className="mb-1.5 text-[13px] font-semibold" style={{ color: guide.color }}>{title}</h3>
          <ul className="space-y-1.5">
            {items.map((t) => (
              <li key={t} className="flex gap-2 text-[13px] leading-relaxed text-ink-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full" style={{ background: guide.color }} aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="grid grid-cols-2 gap-2 pt-1">
        {EMERGENCY_NUMBERS.map((n) => (
          <a key={n.number} href={`tel:${n.number}`} className="rounded-xl bg-surface-2 px-3 py-2">
            <span className="block text-[16px] font-semibold text-red-600 dark:text-red-400">{n.number}</span>
            <span className="block text-[11px] text-muted">{n.label}</span>
          </a>
        ))}
      </div>
      <p className="text-[11px] text-muted">General guidance. Always follow instructions from NDMA, IMD and local authorities.</p>
    </div>
  );
}
