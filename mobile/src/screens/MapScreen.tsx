import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Crosshair, Layers, Maximize, Menu, Search, Video } from "lucide-react";
import { EventPreview } from "../components/EventPreview";
import { SearchOverlay } from "../components/SearchOverlay";
import { Timeline } from "../components/Timeline";
import { Segmented, Sheet, comingSoon, toast } from "../components/ui";
import { hazard } from "../lib/hazards";
import { goBack, navigate } from "../lib/router";
import { getMyPosition } from "../services/geocode";
import { useEvents, type DisasterEvent } from "../services/events";

type Mode = "satellite" | "cctv" | "weather" | "terrain";
type Product = "true" | "infrared" | "radar" | "clouds";

// Free imagery sources (no API keys). Each needs its attribution shown on the map.
const ESRI_IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTR = "Imagery © Esri, Maxar, Earthstar Geographics";
const DARK_BASE = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const DARK_ATTR = "Esri, HERE, Garmin, © OpenStreetMap contributors";
const TOPO = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
const TOPO_ATTR = "© OpenStreetMap contributors, SRTM · © OpenTopoMap (CC-BY-SA)";
const GIBS_ATTR = "NASA EOSDIS GIBS";
const gibs = (layer: string, date: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;

const PRODUCTS: Record<Product, { label: string; title: string; sub: string; gibsLayer?: string }> = {
  true: { label: "True Color", title: "Esri World Imagery", sub: "High-resolution mosaic · not live" },
  infrared: { label: "Infrared", title: "NASA MODIS Terra (bands 7-2-1)", sub: "Daily · shows burn scars and flood water", gibsLayer: "MODIS_Terra_CorrectedReflectance_Bands721" },
  radar: { label: "Rain Radar", title: "RainViewer precipitation radar", sub: "Live · last 2 hours" },
  clouds: { label: "Clouds", title: "NASA VIIRS true colour", sub: "Daily · today's cloud cover", gibsLayer: "VIIRS_SNPP_CorrectedReflectance_TrueColor" },
};

// Tile x/y for a thumbnail over India.
function tileUrl(template: string, z = 4, lat = 22, lon = 80) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)).replace("{s}", "a").replace("{r}", "");
}

// GIBS daily imagery is complete for yesterday (UTC); today's is still being filled in.
function gibsDate(daysAgo: number) {
  const d = new Date(Date.now() - (daysAgo + 1) * 86400_000);
  return d.toISOString().slice(0, 10);
}

type RadarFrames = { host: string; frames: { time: number; path: string }[] };
async function fetchRadar(): Promise<RadarFrames> {
  const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
  if (!res.ok) throw new Error(`RainViewer ${res.status}`);
  const d = (await res.json()) as { host: string; radar: { past: { time: number; path: string }[] } };
  return { host: d.host, frames: d.radar.past };
}
const radarUrl = (r: RadarFrames, i: number) => `${r.host}${r.frames[i].path}/256/{z}/{x}/{y}/2/1_1.png`;

export function MapScreen() {
  const mapDiv = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<L.TileLayer | null>(null);
  const overlayRef = useRef<L.TileLayer | null>(null);
  const labelsRef = useRef<L.TileLayer | null>(null);
  const eventsLayer = useRef<L.LayerGroup | null>(null);
  const meRef = useRef<L.CircleMarker | null>(null);

  const [mode, setMode] = useState<Mode>("satellite");
  const [product, setProduct] = useState<Product>("true");
  const [daysAgo, setDaysAgo] = useState(0);
  const [radarBack, setRadarBack] = useState(0); // frames back from the latest
  const [playing, setPlaying] = useState(false);
  const [showEvents, setShowEvents] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<DisasterEvent | null>(null);

  const events = useEvents();
  const radar = useQuery({ queryKey: ["radar"], queryFn: fetchRadar, staleTime: 5 * 60_000, refetchInterval: 5 * 60_000 });
  const showRadar = mode === "weather" || (mode === "satellite" && product === "radar");

  // Create the map once.
  useEffect(() => {
    const map = L.map(mapDiv.current!, { zoomControl: false, worldCopyJump: true, minZoom: 2, maxZoom: 17 }).setView([22.5, 80], 4);
    mapRef.current = map;
    eventsLayer.current = L.layerGroup().addTo(map);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(mapDiv.current!);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Base map + imagery overlay for the chosen mode / product / date / radar frame.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    baseRef.current?.remove();
    overlayRef.current?.remove();
    overlayRef.current = null;

    const base =
      mode === "terrain"
        ? L.tileLayer(TOPO, { attribution: TOPO_ATTR, maxZoom: 17, subdomains: "abc" })
        : mode === "weather"
          ? L.tileLayer(DARK_BASE, { attribution: DARK_ATTR, maxNativeZoom: 16, maxZoom: 17 })
          : L.tileLayer(ESRI_IMAGERY, { attribution: ESRI_ATTR, maxZoom: 17 });
    base.addTo(map).bringToBack();
    baseRef.current = base;

    const p = PRODUCTS[product];
    if (mode === "satellite" && p.gibsLayer) {
      overlayRef.current = L.tileLayer(gibs(p.gibsLayer, gibsDate(daysAgo)), { attribution: GIBS_ATTR, maxNativeZoom: 9, maxZoom: 17 }).addTo(map);
    }
    if (showRadar && radar.data?.frames.length) {
      const index = radar.data.frames.length - 1 - radarBack;
      // RainViewer's free tiles go up to zoom 7; Leaflet scales them beyond that.
      overlayRef.current = L.tileLayer(radarUrl(radar.data, index), { attribution: "Radar © RainViewer", opacity: 0.75, maxNativeZoom: 7, maxZoom: 17 }).addTo(map);
    }
  }, [mode, product, daysAgo, radarBack, radar.data, showRadar]);

  // Place-name labels on top (not on terrain, which has its own).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    labelsRef.current?.remove();
    labelsRef.current = null;
    if (showLabels && mode !== "terrain") {
      labelsRef.current = L.tileLayer(ESRI_LABELS, { maxZoom: 17, pane: "overlayPane", zIndex: 650 }).addTo(map);
    }
  }, [showLabels, mode]);

  // Disaster markers.
  const mapEvents = useMemo(
    () => (events.data ?? []).filter((e) => e.type !== "earthquake" || (e.magnitude ?? 0) >= 4),
    [events.data],
  );
  useEffect(() => {
    const group = eventsLayer.current;
    if (!group) return;
    group.clearLayers();
    if (!showEvents) return;
    for (const e of mapEvents) {
      const color = hazard(e.type).color;
      L.circleMarker([e.lat, e.lon], {
        radius: e.severity === "High" ? 9 : 7,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95,
      })
        .on("click", () => setSelected(e))
        .addTo(group);
    }
  }, [mapEvents, showEvents]);

  async function locate() {
    const pos = await getMyPosition();
    if (!pos || !mapRef.current) return toast("Location is off. Allow location access to see where you are.");
    meRef.current?.remove();
    meRef.current = L.circleMarker([pos.lat, pos.lon], { radius: 8, color: "#fff", weight: 3, fillColor: "#3b82f6", fillOpacity: 1 }).addTo(mapRef.current);
    mapRef.current.flyTo([pos.lat, pos.lon], 9);
  }

  function fullscreen() {
    const el = screenRef.current;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el?.requestFullscreen) el.requestFullscreen().catch(() => toast("Full screen isn't available here."));
    else toast("Full screen isn't available on this browser. Add the app to your home screen instead.");
  }

  const frames = radar.data?.frames ?? [];
  const radarMinutesAgo = frames.length ? Math.round((Date.now() / 1000 - frames[frames.length - 1 - radarBack].time) / 60) : 0;
  const timeline =
    showRadar && frames.length > 1 ? (
      <Timeline
        value={radarBack}
        max={frames.length - 1}
        onChange={setRadarBack}
        playing={playing}
        setPlaying={setPlaying}
        labels={["-2h", "-1h", "Now"]}
        formatValue={() => `-${radarMinutesAgo}m`}
      />
    ) : mode === "satellite" && PRODUCTS[product].gibsLayer ? (
      <Timeline
        value={daysAgo}
        max={6}
        onChange={setDaysAgo}
        playing={playing}
        setPlaying={setPlaying}
        labels={["-7d", "-4d", "Latest"]}
        formatValue={(v) => `-${v}d`}
      />
    ) : null;

  return (
    <div ref={screenRef} data-theme="dark" className="relative flex h-full flex-col bg-[#0b1220] text-white">
      <header className="safe-top relative z-[500] flex items-center gap-2 bg-[#0b1220] px-3 pb-2">
        <button type="button" onClick={() => goBack()} aria-label="Back" className="grid size-10 place-items-center rounded-full active:bg-white/10">
          <ArrowLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-semibold">Live View</h1>
          <p className="text-[12px] text-white/70">Satellites & Cameras</p>
        </div>
        <button type="button" aria-label="Search" onClick={() => setSearchOpen(true)} className="grid size-10 place-items-center rounded-full active:bg-white/10">
          <Search size={21} />
        </button>
        <button type="button" aria-label="Map options" onClick={() => setLayersOpen(true)} className="grid size-10 place-items-center rounded-full active:bg-white/10">
          <Menu size={21} />
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={mapDiv} className="absolute inset-0" aria-label="Map" />

        <div className="pointer-events-none absolute inset-x-3 top-2 z-[500]">
          <Segmented
            dark
            className="pointer-events-auto shadow-lg"
            value={mode}
            onChange={(m) => { setMode(m); setPlaying(false); }}
            options={[
              { value: "satellite", label: "Satellite" },
              { value: "cctv", label: "CCTV" },
              { value: "weather", label: "Weather" },
              { value: "terrain", label: "Terrain" },
            ]}
          />
        </div>

        <div className="absolute top-16 right-3 z-[500] flex flex-col gap-2.5">
          <MapButton label="Show my location" onClick={locate}><Crosshair size={20} /></MapButton>
          <MapButton label="Map layers" onClick={() => setLayersOpen(true)}><Layers size={20} /></MapButton>
          <MapButton label="Full screen" onClick={fullscreen}><Maximize size={19} /></MapButton>
        </div>

        {mode === "cctv" && (
          <div className="absolute inset-x-6 top-24 z-[500] rounded-2xl bg-white p-4 text-center text-slate-900 shadow-xl">
            <Video size={28} className="mx-auto text-blue-600" />
            <p className="mt-2 text-[15px] font-semibold">No camera feeds connected yet</p>
            <p className="mt-1 text-[13px] text-slate-600">Public CCTV and webcam streams will appear here once a camera provider is connected.</p>
            <button type="button" onClick={() => setMode("satellite")} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white">Back to satellite</button>
          </div>
        )}

        <div className="absolute inset-x-3 bottom-3 z-[500] space-y-2">
          {(mode === "satellite" || mode === "weather") && (
            <button
              type="button"
              onClick={() => mode === "satellite" && setProductsOpen(!productsOpen)}
              aria-expanded={productsOpen}
              className="flex w-full items-center gap-3 rounded-2xl bg-white p-2.5 text-left text-slate-900 shadow-lg"
            >
              <img src={thumbFor(mode === "weather" ? "radar" : product, radar.data)} alt="" className="size-10 rounded-lg bg-slate-200 object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{mode === "weather" ? PRODUCTS.radar.title : PRODUCTS[product].title}</span>
                <span className="block truncate text-[12px] text-slate-600">
                  {mode === "weather" ? (radar.isError ? "Radar unavailable" : PRODUCTS.radar.sub) : PRODUCTS[product].sub}
                </span>
              </span>
              {mode === "satellite" && <ChevronDown size={20} className={productsOpen ? "rotate-180" : ""} />}
            </button>
          )}
          {mode === "satellite" && productsOpen && (
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(PRODUCTS) as Product[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setProduct(p); setDaysAgo(0); setRadarBack(0); setPlaying(false); }}
                  aria-pressed={product === p}
                  className={`overflow-hidden rounded-xl border-2 text-center ${product === p ? "border-blue-500 bg-blue-500/20" : "border-transparent"}`}
                >
                  <img src={thumbFor(p, radar.data)} alt="" className="aspect-square w-full bg-slate-700 object-cover" />
                  <span className={`block py-1 text-[11px] font-medium ${product === p ? "text-blue-200" : "text-white"}`}>{PRODUCTS[p].label}</span>
                </button>
              ))}
            </div>
          )}
          {timeline}
        </div>
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        {selected && <EventPreview event={selected} />}
      </Sheet>

      <Sheet open={layersOpen} onClose={() => setLayersOpen(false)} title="Map layers">
        <label className="flex items-center justify-between border-b border-line py-3 text-[15px]">
          Disaster markers
          <input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} className="size-5 accent-blue-600" />
        </label>
        <label className="flex items-center justify-between border-b border-line py-3 text-[15px]">
          Place names and borders
          <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="size-5 accent-blue-600" />
        </label>
        <button type="button" onClick={() => { setLayersOpen(false); navigate("/"); }} className="w-full border-b border-line py-3 text-left text-[15px]">Open 3D globe</button>
        <button type="button" onClick={() => comingSoon("Offline maps")} className="w-full py-3 text-left text-[15px]">Download for offline use</button>
        <p className="mt-2 mb-4 text-[12px] text-muted">Markers: USGS earthquakes M4+ and NASA EONET open events. Tap one for details.</p>
      </Sheet>

      {searchOpen && (
        <SearchOverlay
          events={events.data ?? []}
          onClose={() => setSearchOpen(false)}
          onPick={(p) => {
            setSearchOpen(false);
            mapRef.current?.flyTo([p.lat, p.lon], p.event ? 7 : 10);
          }}
        />
      )}
    </div>
  );
}

function thumbFor(p: Product, radar?: RadarFrames) {
  if (p === "true") return tileUrl(ESRI_IMAGERY);
  if (p === "radar") return radar?.frames.length ? tileUrl(radarUrl(radar, radar.frames.length - 1).replace("/2/1_1.png", "/4/1_1.png"), 3) : tileUrl(DARK_BASE, 3);
  return tileUrl(gibs(PRODUCTS[p].gibsLayer!, gibsDate(0)));
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="grid size-12 place-items-center rounded-full bg-white text-slate-900 shadow-lg">
      {children}
    </button>
  );
}
