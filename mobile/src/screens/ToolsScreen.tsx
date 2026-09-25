import { ChevronRight, CloudSun, Download, Image, LineChart, PencilRuler, Route, Share2, Video, type LucideIcon } from "lucide-react";
import { ScreenHeader, comingSoon, toast } from "../components/ui";
import { navigate, openPlace } from "../lib/router";
import { getMyPosition, nameForPosition } from "../services/geocode";
import { fetchAllEvents } from "../services/events";

const BASE = import.meta.env.BASE_URL;

type Tool = { title: string; sub: string; Icon: LucideIcon; color: string; bg: string; onClick: () => void; soon?: boolean };

export function ToolsScreen() {
  const everyone: Tool[] = [
    { title: "Compare Images", sub: "Before / After", Icon: Image, color: "#2563eb", bg: "#e8efff", onClick: () => comingSoon("Before / after image comparison"), soon: true },
    { title: "Live Cameras", sub: "CCTV & Webcams", Icon: Video, color: "#16a34a", bg: "#e7f7ec", onClick: () => comingSoon("Live cameras"), soon: true },
    { title: "Weather Info", sub: "Current & Forecast", Icon: CloudSun, color: "#0ea5e9", bg: "#e6f6fd", onClick: weatherHere },
    { title: "Safe Routes", sub: "Travel Safety", Icon: Route, color: "#2563eb", bg: "#e8efff", onClick: () => comingSoon("Safe routes"), soon: true },
  ];
  const advanced: Tool[] = [
    { title: "Data Download", sub: "Live events (GeoJSON)", Icon: Download, color: "#7c3aed", bg: "#f1ebff", onClick: downloadEvents },
    { title: "Custom Analysis", sub: "Run AI Models", Icon: LineChart, color: "#7c3aed", bg: "#f1ebff", onClick: () => comingSoon("Custom analysis"), soon: true },
    { title: "Geospatial Tools", sub: "Measure, Draw", Icon: PencilRuler, color: "#7c3aed", bg: "#f1ebff", onClick: () => comingSoon("Geospatial tools"), soon: true },
    { title: "Export & Share", sub: "Share this app", Icon: Share2, color: "#7c3aed", bg: "#f1ebff", onClick: shareApp },
  ];

  return (
    <div className="pb-6">
      <ScreenHeader title="Tools" />
      <div className="space-y-5 px-4">
        <ToolGrid title="For Everyone" tools={everyone} large />
        <ToolGrid title="For Advanced Users" tools={advanced} />
        <button
          type="button"
          onClick={() => navigate("/assistant")}
          className="flex w-full items-center gap-3 rounded-3xl p-4 text-left text-white shadow-lg"
          style={{ background: "linear-gradient(120deg, #5b6cf6, #8b5cf6 60%, #a78bfa)" }}
        >
          <img src={`${BASE}assistant.png`} alt="" className="size-16 shrink-0 rounded-2xl bg-white/15 object-contain p-1" />
          <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-semibold">Ask RAPID-AI</span>
            <span className="block text-[13px] text-white/85">Live weather, nearby disasters and safety advice in simple language.</span>
          </span>
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  );
}

function ToolGrid({ title, tools, large = false }: { title: string; tools: Tool[]; large?: boolean }) {
  return (
    <section>
      <h2 className="mb-2.5 text-[16px] font-semibold">{title}</h2>
      <div className="grid grid-cols-2 gap-3">
        {tools.map((t) => (
          <button
            key={t.title}
            type="button"
            onClick={t.onClick}
            className={`card relative flex ${large ? "flex-col items-center py-5 text-center" : "items-center gap-3 p-3 text-left"} active:scale-[0.99]`}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl dark:!bg-white/10" style={{ background: t.bg }}>
              <t.Icon size={22} color={t.color} />
            </span>
            <span className={large ? "mt-2.5" : `min-w-0 ${t.soon ? "pr-7" : ""}`}>
              <span className="block text-[14px] font-semibold">{t.title}</span>
              <span className="block text-[12px] text-muted">{t.sub}</span>
            </span>
            {t.soon && <span className="absolute top-2 right-2 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">Soon</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

async function weatherHere() {
  toast("Finding your location…");
  const pos = await getMyPosition();
  if (!pos) {
    toast("Location is off, showing New Delhi. Search on Home for another place.");
    return openPlace({ lat: 28.6139, lon: 77.209, name: "New Delhi" });
  }
  openPlace({ ...pos, name: await nameForPosition(pos.lat, pos.lon) });
}

// All current events as GeoJSON, for use in QGIS / geojson.io / Google Earth.
async function downloadEvents() {
  try {
    toast("Preparing download…");
    const events = await fetchAllEvents();
    const geojson = {
      type: "FeatureCollection",
      generated: new Date().toISOString(),
      sources: ["USGS earthquake feed (M2.5+, 7 days)", "NASA EONET open events (30 days)"],
      features: events.map((e) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [e.lon, e.lat] },
        properties: { id: e.id, type: e.type, title: e.title, place: e.place, time: new Date(e.time).toISOString(), severity: e.severity, detail: e.detail, source: e.source, url: e.url },
      })),
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapid-ai-events-${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Downloaded ${events.length} events`);
  } catch {
    toast("Download failed. Check your connection.");
  }
}

async function shareApp() {
  const url = window.location.href.split("#")[0];
  try {
    if (navigator.share) await navigator.share({ title: "RAPID-AI", text: "Live disasters, weather and satellite views", url });
    else {
      await navigator.clipboard.writeText(url);
      toast("App link copied");
    }
  } catch {
    // share sheet closed
  }
}
