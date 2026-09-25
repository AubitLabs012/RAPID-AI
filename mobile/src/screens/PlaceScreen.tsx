import { useEffect, useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, ChevronRight, CloudRain, Droplets, FileText, Share2, Thermometer, Wind } from "lucide-react";
import { Empty, IconButton, ScreenHeader, Skeleton, cn, toast } from "../components/ui";
import { HazardIcon, SeverityBadge, hazard, type HazardType, type Severity } from "../lib/hazards";
import { distanceKm, formatCoords, timeAgo } from "../lib/geo";
import { navigate, openPlace } from "../lib/router";
import { addToHistory, isSaved, places, toggleSaved } from "../lib/storage";
import { eventPageName, useEvents, type DisasterEvent } from "../services/events";
import { describeWeather, useWeather, weatherAlerts, weatherIcon, weatherRisk, type Weather, type WeatherAlert } from "../services/weather";

const BASE = import.meta.env.BASE_URL;
const NEARBY_KM = 500; // "Live updates" radius
const ALERT_KM = 300; // events this close also appear as alerts
const WEEK = 7 * 24 * 3600_000;

type Tab = "overview" | "live" | "analysis" | "forecast";

export function PlaceScreen({ params }: { params: URLSearchParams }) {
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  const name = params.get("name") || "Selected location";
  const eventId = params.get("event") ?? undefined;
  const valid = Number.isFinite(lat) && Number.isFinite(lon);
  const [tab, setTab] = useState<Tab>("overview");
  places.use(); // re-render when the bookmark changes
  const saved = valid && isSaved({ lat, lon });

  const weather = useWeather(valid ? lat : undefined, valid ? lon : undefined);
  const events = useEvents();

  useEffect(() => {
    if (valid) addToHistory({ name, lat, lon });
  }, [valid, name, lat, lon]);

  // Events near this place, nearest-in-time first; the event that was tapped always comes first.
  const nearby = useMemo(() => {
    const list = (events.data ?? [])
      .filter((e) => Date.now() - e.time < WEEK)
      .map((e) => ({ ...e, km: distanceKm({ lat, lon }, e) }))
      .filter((e) => e.km <= NEARBY_KM || e.id === eventId)
      .sort((a, b) => (a.id === eventId ? -1 : b.id === eventId ? 1 : b.time - a.time));
    return list;
  }, [events.data, lat, lon, eventId]);

  if (!valid) return <Empty title="Location not found">Go back and pick a place.</Empty>;

  const alerts = [
    ...(weather.data ? weatherAlerts(weather.data).map((a) => ({ kind: "weather" as const, a })) : []),
    ...nearby
      .filter((e) => (e.km <= ALERT_KM || e.id === eventId) && e.severity !== "Low")
      .slice(0, 5)
      .map((e) => ({ kind: "event" as const, e })),
  ];

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `RAPID-AI · ${name}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      }
    } catch {
      // The user closed the share sheet.
    }
  }

  return (
    <div className="pb-6">
      <ScreenHeader
        title={name}
        subtitle={formatCoords({ lat, lon })}
        actions={
          <>
            <IconButton label={saved ? "Remove from saved" : "Save location"} onClick={() => { toggleSaved({ name, lat, lon }); toast(saved ? "Removed from saved" : "Saved location"); }}>
              {saved ? <BookmarkCheck size={21} className="text-accent" /> : <Bookmark size={21} />}
            </IconButton>
            <IconButton label="Share" onClick={share}><Share2 size={20} /></IconButton>
          </>
        }
      />

      <div role="tablist" className="sticky top-[60px] z-10 flex border-b border-line bg-bg px-3">
        {(["overview", "live", "analysis", "forecast"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("flex-1 border-b-2 py-2.5 text-[14px] font-medium capitalize", tab === t ? "border-accent text-accent" : "border-transparent text-muted")}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-4 pt-4">
        {tab === "overview" && (
          <>
            <WeatherCard weather={weather.data} loading={weather.isPending} error={weather.isError} />
            <section className="card p-4">
              <SectionTitle title="Active Alerts" action={nearby.length ? { label: "View All", onClick: () => setTab("live") } : undefined} />
              {weather.isPending && <Skeleton className="h-16" />}
              {!weather.isPending && alerts.length === 0 && <p className="py-2 text-[13px] text-muted">No active alerts for this area right now.</p>}
              <ul className="divide-y divide-line">
                {alerts.map((item) =>
                  item.kind === "weather" ? <WeatherAlertRow key={item.a.id} alert={item.a} /> : <EventRow key={item.e.id} event={item.e} km={item.e.km} />,
                )}
              </ul>
              <p className="mt-2 text-[11px] text-muted">Weather alerts are worked out from the Open-Meteo forecast; they are not official IMD warnings.</p>
            </section>
            <section className="card p-4">
              <SectionTitle title="Live Updates" action={nearby.length > 3 ? { label: "See More", onClick: () => setTab("live") } : undefined} />
              <LiveUpdates weather={weather.data} events={nearby.slice(0, 3)} loading={events.isPending} />
            </section>
            <div className="grid grid-cols-2 gap-3">
              <ActionCard
                img={`${BASE}assistant.png`}
                title="AI Assistant"
                sub="Ask anything"
                onClick={() => navigate("/assistant", { lat: lat.toFixed(4), lon: lon.toFixed(4), name })}
              />
              <ActionCard icon={<FileText size={22} className="text-violet-600" />} title="Generate Report" sub="Simple summary" onClick={() => generateReport(name, lat, lon, weather.data, alerts, nearby)} />
            </div>
          </>
        )}

        {tab === "live" && (
          <section className="card p-4">
            <SectionTitle title={`Within ${NEARBY_KM} km · last 7 days`} />
            {events.isPending && <Skeleton className="h-40" />}
            {!events.isPending && nearby.length === 0 && <p className="py-2 text-[13px] text-muted">No disasters reported nearby this week.</p>}
            <ul className="divide-y divide-line">
              {nearby.map((e) => <EventRow key={e.id} event={e} km={e.km} showSource />)}
            </ul>
          </section>
        )}

        {tab === "analysis" && <Analysis weather={weather.data} nearby={nearby} loading={weather.isPending} />}
        {tab === "forecast" && <Forecast weather={weather.data} loading={weather.isPending} />}
      </div>
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-[16px] font-semibold">{title}</h2>
      {action && <button type="button" onClick={action.onClick} className="text-[13px] font-medium text-accent">{action.label}</button>}
    </div>
  );
}

function WeatherCard({ weather, loading, error }: { weather?: Weather; loading: boolean; error: boolean }) {
  if (loading) return <Skeleton className="h-44" />;
  if (error || !weather) return <div className="card p-4 text-[14px] text-muted">Weather is unavailable right now.</div>;
  const c = weather.current;
  const Icon = weatherIcon(c.code, c.isDay);
  const risk = weatherRisk(weather);
  return (
    <section className="card p-4" aria-label="Current weather">
      <div className="flex items-start gap-4">
        <Icon size={64} strokeWidth={1.4} className="shrink-0 text-sky-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[40px] leading-none font-semibold">{Math.round(c.temperature)}<span className="align-top text-[20px]">°C</span></p>
          <p className="mt-1 text-[16px] font-medium">{describeWeather(c.code)}</p>
          <p className="text-[13px] text-muted">Feels like {Math.round(c.feelsLike)}°C</p>
        </div>
        <SeverityBadge severity={risk} label={`${risk} Risk`} />
      </div>
      <div className="mt-4 grid grid-cols-3 border-t border-line pt-3 text-center">
        <Stat icon={<Droplets size={16} />} value={`${c.humidity}%`} label="Humidity" />
        <Stat icon={<Wind size={16} />} value={`${Math.round(c.windSpeed)} km/h`} label="Wind" />
        <Stat icon={<CloudRain size={16} />} value={`${c.rain1h.toFixed(1)} mm`} label="Rain (1h)" />
      </div>
    </section>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div>
      <p className="flex items-center justify-center gap-1.5 text-[14px] font-semibold"><span className="text-accent">{icon}</span>{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

const ALERT_ICON: Record<WeatherAlert["kind"], HazardType> = { rain: "flood", storm: "weather", wind: "cyclone", heat: "wildfire" };

function WeatherAlertRow({ alert }: { alert: WeatherAlert }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <HazardIcon type={ALERT_ICON[alert.kind]} filled size={18} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">{alert.title}</p>
        <p className="text-[12px] text-muted">{alert.detail}</p>
      </div>
      <SeverityBadge severity={alert.severity} label={alert.status} />
    </li>
  );
}

function EventRow({ event, km, showSource = false }: { event: DisasterEvent; km: number; showSource?: boolean }) {
  return (
    <li>
      <button type="button" onClick={() => openPlace({ lat: event.lat, lon: event.lon, name: eventPageName(event), event: event.id })} className="flex w-full items-center gap-3 py-2.5 text-left">
        <HazardIcon type={event.type} filled size={18} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium">{event.title}</p>
          <p className="truncate text-[12px] text-muted">
            {event.type === "earthquake" ? `${event.place} · ` : ""}{Math.round(km)} km away · {timeAgo(event.time)}
            {showSource && ` · ${event.source}`}
          </p>
        </div>
        <SeverityBadge severity={event.severity} />
        <ChevronRight size={16} className="text-muted" />
      </button>
    </li>
  );
}

function LiveUpdates({ weather, events, loading }: { weather?: Weather; events: (DisasterEvent & { km: number })[]; loading: boolean }) {
  const items: { key: string; when: string; text: string; icon: React.ReactNode }[] = [];
  if (weather) {
    const Icon = weatherIcon(weather.current.code, weather.current.isDay);
    items.push({
      key: "wx",
      when: "Now",
      text: `${describeWeather(weather.current.code)}, ${Math.round(weather.current.temperature)}°C. ${weather.current.rain1h > 0 ? `${weather.current.rain1h.toFixed(1)} mm of rain in the last hour.` : "No rain in the last hour."}`,
      icon: <Icon size={18} className="text-sky-500" />,
    });
  }
  for (const e of events) {
    items.push({
      key: e.id,
      when: timeAgo(e.time),
      text: `${e.title}, ${Math.round(e.km)} km away${e.type === "earthquake" ? ` (${e.place})` : ""}.`,
      icon: <HazardIcon type={e.type} size={18} />,
    });
  }
  if (loading && !items.length) return <Skeleton className="h-24" />;
  if (!items.length) return <p className="text-[13px] text-muted">Nothing new nearby.</p>;
  return (
    <ol className="relative ml-2 border-l border-line">
      {items.map((it) => (
        <li key={it.key} className="relative pb-3 pl-6 last:pb-0">
          <span className="absolute top-0 -left-[11px] grid size-[22px] place-items-center rounded-full bg-surface">{it.icon}</span>
          <p className="text-[12px] text-muted">{it.when}</p>
          <p className="text-[13px] text-ink-2">{it.text}</p>
        </li>
      ))}
    </ol>
  );
}

function ActionCard({ img, icon, title, sub, onClick }: { img?: string; icon?: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="card flex items-center gap-3 p-3 text-left active:scale-[0.99]">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-100 dark:bg-violet-500/15">
        {img ? <img src={img} alt="" className="size-10 object-contain" /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-accent">{title}</span>
        <span className="block text-[12px] text-muted">{sub}</span>
      </span>
    </button>
  );
}

function Analysis({ weather, nearby, loading }: { weather?: Weather; nearby: (DisasterEvent & { km: number })[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-64" />;
  const rain24 = weather ? weather.hourly.reduce((s, h) => s + h.rain, 0) : 0;
  const gust = weather ? Math.max(...weather.hourly.map((h) => h.gusts)) : 0;
  const heat = weather ? Math.max(...weather.hourly.map((h) => h.temperature)) : 0;
  const within300 = nearby.filter((e) => e.km <= 300);
  const biggestQuake = within300.filter((e) => e.type === "earthquake").sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0))[0];
  // Each factor: value, the level at which it becomes Moderate / High, and the unit.
  const factors = [
    { label: "Rain, next 24 h", value: rain24, moderate: 15.6, high: 64.5, max: 120, unit: "mm", note: "IMD: 15.6 mm moderate, 64.5 mm heavy" },
    { label: "Strongest gust, next 24 h", value: gust, moderate: 40, high: 62, max: 100, unit: "km/h", note: "62 km/h is gale force" },
    { label: "Highest temperature, next 24 h", value: heat, moderate: 40, high: 45, max: 50, unit: "°C", note: "IMD heatwave from 40°C" },
  ];
  const level = (v: number, m: number, h: number): Severity => (v >= h ? "High" : v >= m ? "Moderate" : "Low");
  const counts = Object.entries(
    within300.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.type]: (acc[e.type] ?? 0) + 1 }), {}),
  ) as [HazardType, number][];

  return (
    <>
      <section className="card p-4">
        <SectionTitle title="Weather risk factors" />
        <ul className="space-y-4">
          {factors.map((f) => (
            <li key={f.label}>
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium">{f.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">{f.value.toFixed(f.unit === "mm" ? 1 : 0)} {f.unit}</span>
                  <SeverityBadge severity={level(f.value, f.moderate, f.high)} />
                </span>
              </div>
              <div className="relative mt-1.5 h-2 rounded-full bg-surface-2" aria-hidden>
                <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.min(100, (Math.max(0, f.value) / f.max) * 100)}%` }} />
                <span className="absolute top-[-2px] h-3 w-0.5 bg-amber-500" style={{ left: `${(f.moderate / f.max) * 100}%` }} />
                <span className="absolute top-[-2px] h-3 w-0.5 bg-red-500" style={{ left: `${(f.high / f.max) * 100}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted">{f.note}. Ticks mark the moderate and high levels.</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="card p-4">
        <SectionTitle title="Disasters within 300 km (7 days)" />
        {counts.length === 0 ? (
          <p className="text-[13px] text-muted">None reported.</p>
        ) : (
          <ul className="space-y-2">
            {counts.map(([type, n]) => (
              <li key={type} className="flex items-center gap-3 text-[14px]">
                <HazardIcon type={type} size={18} />
                <span className="flex-1">{hazard(type).label}</span>
                <span className="font-semibold tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        )}
        {biggestQuake && <p className="mt-3 text-[13px] text-ink-2">Strongest earthquake: {biggestQuake.detail}, {Math.round(biggestQuake.km)} km away, {timeAgo(biggestQuake.time)}.</p>}
      </section>
      <p className="px-1 text-[11px] text-muted">This summary uses simple, published thresholds on live data. It is not a model prediction or an official warning.</p>
    </>
  );
}

function Forecast({ weather, loading }: { weather?: Weather; loading: boolean }) {
  if (loading) return <Skeleton className="h-64" />;
  if (!weather) return <p className="text-[14px] text-muted">Forecast unavailable.</p>;
  const hours = weather.hourly.filter((_, i) => i % 3 === 0).slice(0, 8);
  return (
    <>
      <section className="card p-4">
        <SectionTitle title="Next 24 hours" />
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto">
          {hours.map((h) => {
            const Icon = weatherIcon(h.code);
            return (
              <div key={h.time} className="flex min-w-[56px] flex-col items-center gap-1 rounded-xl px-1 py-2 text-center">
                <span className="text-[12px] text-muted">{h.time.slice(11, 16)}</span>
                <Icon size={20} className="text-sky-500" aria-label={describeWeather(h.code)} />
                <span className="text-[14px] font-semibold">{Math.round(h.temperature)}°</span>
                <span className="flex items-center gap-0.5 text-[11px] text-sky-600 dark:text-sky-400"><Droplets size={10} />{h.rainChance}%</span>
              </div>
            );
          })}
        </div>
      </section>
      <section className="card p-4">
        <SectionTitle title="7-day forecast" />
        <ul className="divide-y divide-line">
          {weather.daily.map((d, i) => {
            const Icon = weatherIcon(d.code);
            const day = i === 0 ? "Today" : new Date(`${d.date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
            return (
              <li key={d.date} className="flex items-center gap-3 py-2.5 text-[14px]">
                <span className="w-16 font-medium">{day}</span>
                <Icon size={20} className="text-sky-500" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{describeWeather(d.code)}</span>
                <span className="text-[12px] text-sky-600 tabular-nums dark:text-sky-400">{d.rainSum.toFixed(1)} mm</span>
                <span className="flex w-20 items-center justify-end gap-1 tabular-nums"><Thermometer size={13} className="text-muted" />{Math.round(d.tempMin)}–{Math.round(d.tempMax)}°</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[11px] text-muted">Forecast by Open-Meteo.com</p>
      </section>
    </>
  );
}

// Builds a plain-text summary and shares it (phones) or downloads it (desktop).
async function generateReport(
  name: string,
  lat: number,
  lon: number,
  weather: Weather | undefined,
  alerts: ({ kind: "weather"; a: WeatherAlert } | { kind: "event"; e: DisasterEvent & { km: number } })[],
  nearby: (DisasterEvent & { km: number })[],
) {
  const lines = [
    `RAPID-AI situation summary`,
    `${name} (${formatCoords({ lat, lon })})`,
    `Generated ${new Date().toLocaleString()}`,
    ``,
    `WEATHER NOW`,
    weather
      ? `${describeWeather(weather.current.code)}, ${Math.round(weather.current.temperature)}°C (feels ${Math.round(weather.current.feelsLike)}°C), humidity ${weather.current.humidity}%, wind ${Math.round(weather.current.windSpeed)} km/h, rain last hour ${weather.current.rain1h.toFixed(1)} mm. Overall weather risk: ${weatherRisk(weather)}.`
      : `Unavailable.`,
    ``,
    `ACTIVE ALERTS`,
    ...(alerts.length ? alerts.map((x) => (x.kind === "weather" ? `- ${x.a.title}: ${x.a.detail} (${x.a.severity})` : `- ${x.e.title} (${x.e.detail}), ${x.e.place}, ${Math.round(x.e.km)} km away (${x.e.severity})`)) : ["- None"]),
    ``,
    `DISASTERS WITHIN ${NEARBY_KM} KM, LAST 7 DAYS`,
    ...(nearby.length ? nearby.slice(0, 15).map((e) => `- ${timeAgo(e.time)}: ${e.title} (${e.detail}), ${e.place}, ${Math.round(e.km)} km away (${e.source})`) : ["- None reported"]),
    ``,
    `Sources: Open-Meteo (weather), USGS (earthquakes), NASA EONET (natural events).`,
    `Weather alerts are rule-based from the forecast and are not official warnings. Follow IMD / NDMA / local authorities.`,
  ];
  const text = lines.join("\n");
  const fileName = `rapid-ai-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report.txt`;
  const file = new File([text], fileName, { type: "text/plain" });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `RAPID-AI report · ${name}` });
      return;
    }
  } catch {
    return; // share sheet closed
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Report downloaded");
}
