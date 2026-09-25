import { MapPin, Trash2 } from "lucide-react";
import { Empty, ScreenHeader, Segmented, cn, toast } from "../components/ui";
import { formatCoords, timeAgo } from "../lib/geo";
import { openPlace } from "../lib/router";
import { places, settings, toggleSaved, type Theme } from "../lib/storage";

export function SettingsScreen() {
  const s = settings.use();
  return (
    <div className="pb-6">
      <ScreenHeader title="Settings" />
      <div className="space-y-4 px-4">
        <section className="card space-y-2 p-4">
          <label htmlFor="name" className="text-[14px] font-semibold">Your name</label>
          <input
            id="name"
            value={s.displayName}
            onChange={(e) => settings.set({ displayName: e.target.value.slice(0, 40) })}
            placeholder="Shown on the More tab"
            className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[15px] outline-none placeholder:text-muted"
            autoComplete="nickname"
          />
          <p className="text-[12px] text-muted">Stored only on this phone.</p>
        </section>
        <section className="card space-y-3 p-4">
          <p className="text-[14px] font-semibold">Appearance</p>
          <Segmented<Theme>
            value={s.theme}
            onChange={(theme) => settings.set({ theme })}
            options={[
              { value: "light", label: "Day" },
              { value: "dark", label: "Night" },
              { value: "system", label: "Auto" },
            ]}
          />
          <p className="text-[12px] text-muted">The globe and map screens always stay dark.</p>
        </section>
        <section className="card space-y-3 p-4">
          <p className="text-[14px] font-semibold">Refresh live data every</p>
          <Segmented<string>
            value={String(s.refreshMinutes)}
            onChange={(v) => settings.set({ refreshMinutes: Number(v) })}
            options={[
              { value: "5", label: "5 min" },
              { value: "10", label: "10 min" },
              { value: "30", label: "30 min" },
            ]}
          />
        </section>
        <button
          type="button"
          onClick={() => {
            places.set({ saved: [], history: [] });
            toast("Saved places and history cleared");
          }}
          className="w-full rounded-2xl border border-red-200 py-3 text-[15px] font-semibold text-red-600 dark:border-red-500/30 dark:text-red-400"
        >
          Clear saved places and history
        </button>
      </div>
    </div>
  );
}

export function PlaceListScreen({ kind }: { kind: "saved" | "history" }) {
  const p = places.use();
  const list = kind === "saved" ? p.saved : p.history;
  return (
    <div className="pb-6">
      <ScreenHeader title={kind === "saved" ? "Saved Locations" : "History"} subtitle={kind === "history" ? "Places you opened recently" : undefined} />
      <div className="px-4">
        {list.length === 0 ? (
          <Empty title={kind === "saved" ? "No saved places yet" : "Nothing here yet"}>
            {kind === "saved" ? "Open a place and tap the bookmark to save it." : "Places you open will show up here."}
          </Empty>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {list.map((place) => (
              <li key={`${place.lat},${place.lon}`} className="flex items-center">
                <button type="button" onClick={() => openPlace(place)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
                  <MapPin size={20} className="shrink-0 text-accent" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">{place.name}</span>
                    <span className="block truncate text-[12px] text-muted">{formatCoords(place)} · {timeAgo(place.savedAt)}</span>
                  </span>
                </button>
                {kind === "saved" && (
                  <button type="button" aria-label={`Remove ${place.name}`} onClick={() => toggleSaved(place)} className="grid size-12 place-items-center text-muted">
                    <Trash2 size={18} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const SOURCES = [
  ["Earthquakes", "USGS Earthquake Hazards Program, M2.5+ from the last 7 days", "https://earthquake.usgs.gov/earthquakes/feed/"],
  ["Wildfires, storms, volcanoes, floods", "NASA EONET open natural events", "https://eonet.gsfc.nasa.gov/"],
  ["Weather and forecasts", "Open-Meteo", "https://open-meteo.com/"],
  ["Place search", "Open-Meteo Geocoding, BigDataCloud", "https://open-meteo.com/en/docs/geocoding-api"],
  ["Satellite imagery", "Esri World Imagery, NASA GIBS (MODIS, VIIRS)", "https://www.earthdata.nasa.gov/gibs"],
  ["Rain radar", "RainViewer", "https://www.rainviewer.com/api.html"],
  ["Maps", "Esri, OpenStreetMap, OpenTopoMap", "https://www.openstreetmap.org/copyright"],
] as const;

export function InfoScreen({ kind }: { kind: "help" | "about" }) {
  if (kind === "about") {
    return (
      <div className="pb-6">
        <ScreenHeader title="About RAPID-AI" />
        <div className="space-y-4 px-4">
          <section className="card flex items-center gap-4 p-4">
            <img src={`${import.meta.env.BASE_URL}logo-96.png`} alt="" className="size-14 object-contain" />
            <div>
              <p className="text-[17px] font-semibold">RAPID-AI Mobile</p>
              <p className="text-[13px] text-muted">Disaster Intelligence Network · version 0.1</p>
            </div>
          </section>
          <section className="card p-4">
            <p className="mb-2 text-[14px] font-semibold">Where the data comes from</p>
            <ul className="space-y-2.5">
              {SOURCES.map(([what, who, url]) => (
                <li key={what} className="text-[13px]">
                  <span className="font-medium">{what}</span>
                  <br />
                  <a href={url} target="_blank" rel="noreferrer" className="text-accent">{who}</a>
                </li>
              ))}
            </ul>
          </section>
          <p className="px-1 text-[12px] leading-relaxed text-muted">
            RAPID-AI shows public data to help people stay aware. Its alerts are worked out from forecasts and feeds and are not official
            warnings. Always follow IMD, NDMA and your local authorities. In an emergency in India, call 112.
          </p>
        </div>
      </div>
    );
  }
  const topics = [
    ["Home globe", "Drag to turn the Earth, pinch to zoom. Tap a coloured marker for the event. Use the chips to show one hazard type, and the timeline to replay the last 7 days."],
    ["Search", "Tap the search bar on Home and type any city or country. You can also tap the microphone and say it."],
    ["Place page", "Shows live weather, alerts, nearby disasters, analysis and a 7-day forecast. Tap the bookmark to save a place, or Generate Report to share a text summary."],
    ["Map", "Switch between satellite, rain radar and terrain. Under Satellite, tap the image source to pick True Color, Infrared, Rain Radar or Clouds; the timeline steps through recent days."],
    ["Alerts", "Lists disasters Nearby (uses your location), in India, or worldwide. Tap a card for details."],
    ["Install on your phone", "In Chrome tap ⋮ → Add to Home screen. In Safari tap Share → Add to Home Screen. RAPID-AI then opens full screen like an app."],
  ] as const;
  return (
    <div className="pb-6">
      <ScreenHeader title="Help & Guide" />
      <ul className="space-y-3 px-4">
        {topics.map(([title, body]) => (
          <li key={title} className={cn("card p-4")}>
            <p className="text-[15px] font-semibold">{title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
