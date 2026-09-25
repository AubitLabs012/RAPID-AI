import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import { Ambulance, Hospital as HospitalIcon, Minus, Navigation, Phone, PhoneCall, Plus, RefreshCw, Share2 } from "lucide-react";
import { ScreenHeader, Sheet, Skeleton, cn, toast } from "../components/ui";
import { navigate } from "../lib/router";
import { addressForPosition, getMyPosition } from "../services/geocode";
import { directionsUrl, useHospitals, useRoute, type Hospital } from "../services/hospitals";

const BASE = import.meta.env.BASE_URL;
const STREET = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
const STREET_ATTR = "Esri, HERE, Garmin, © OpenStreetMap contributors";

type Pos = { lat: number; lon: number };

// Shared: a precise position for emergencies, with a retry.
function usePrecisePosition() {
  const [pos, setPos] = useState<Pos | null>(null);
  const [state, setState] = useState<"locating" | "ok" | "denied">("locating");
  const locate = useCallback(async () => {
    setState("locating");
    const p = await getMyPosition(true);
    if (p) {
      setPos(p);
      setState("ok");
    } else setState("denied");
  }, []);
  useEffect(() => {
    locate();
  }, [locate]);
  return { pos, state, locate };
}

const pin = (html: string, size: number) => L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
const ME_PIN = pin(
  `<div style="position:relative;width:44px;height:44px"><span style="position:absolute;inset:0;border-radius:9999px;background:rgb(239 68 68/.25)" class="sos-ring"></span><svg viewBox="0 0 24 24" width="30" height="30" style="position:absolute;left:7px;top:2px" fill="#ef4444" stroke="#fff" stroke-width="1.5"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6" fill="#fff"/></svg></div>`,
  44,
);
const HOSPITAL_PIN = pin(
  `<div style="width:26px;height:26px;border-radius:9999px;background:#fff;border:2px solid #7166e8;display:grid;place-items:center;box-shadow:0 2px 6px rgb(0 0 0/.25)"><svg viewBox="0 0 24 24" width="14" height="14" stroke="#7166e8" stroke-width="3.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></div>`,
  26,
);

function useLeaflet(center: Pos | null, zoom: number) {
  const div = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  useEffect(() => {
    if (!div.current || map.current) return;
    map.current = L.map(div.current, { zoomControl: false, attributionControl: true }).setView([22.5, 80], 4);
    L.tileLayer(STREET, { attribution: STREET_ATTR, maxZoom: 19 }).addTo(map.current);
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    observer.observe(div.current);
    return () => {
      observer.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (center) map.current?.setView([center.lat, center.lon], zoom);
  }, [center, zoom]);
  return { div, map };
}

function ZoomButtons({ map }: { map: React.RefObject<L.Map | null> }) {
  return (
    <div className="absolute right-3 bottom-4 z-[500] flex flex-col overflow-hidden rounded-xl bg-white shadow-md">
      <button type="button" aria-label="Zoom in" onClick={() => map.current?.zoomIn()} className="grid size-9 place-items-center text-indigo-500"><Plus size={18} /></button>
      <button type="button" aria-label="Zoom out" onClick={() => map.current?.zoomOut()} className="grid size-9 place-items-center border-t border-slate-100 text-slate-600"><Minus size={18} /></button>
    </div>
  );
}

export function SosScreen() {
  const { pos, state, locate } = usePrecisePosition();
  const { div, map } = useLeaflet(pos, 15);
  const hospitals = useHospitals(pos);
  const [address, setAddress] = useState<string[]>([]);
  const [sheet, setSheet] = useState(false);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (pos) addressForPosition(pos.lat, pos.lon).then(setAddress);
  }, [pos]);

  useEffect(() => {
    if (!map.current || !pos) return;
    layer.current?.remove();
    const group = L.layerGroup().addTo(map.current);
    L.marker([pos.lat, pos.lon], { icon: ME_PIN, title: "You are here" }).addTo(group);
    hospitals.data?.slice(0, 15).forEach((h) => L.marker([h.lat, h.lon], { icon: HOSPITAL_PIN, title: h.name }).bindTooltip(h.name).addTo(group));
    layer.current = group;
  }, [pos, hospitals.data, map]);

  async function shareLocation() {
    if (!pos) return toast("Your location isn't available yet.");
    const link = `https://maps.google.com/?q=${pos.lat.toFixed(6)},${pos.lon.toFixed(6)}`;
    const text = `I need help. My location: ${address.join(", ")} ${link}`;
    try {
      if (navigator.share) await navigator.share({ title: "My location", text });
      else window.location.href = `sms:?&body=${encodeURIComponent(text)}`;
    } catch {
      // share sheet closed
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title="Current Location" />
      <div className="relative isolate h-[46vh] min-h-[260px] shrink-0">
        <div ref={div} className="absolute inset-0" aria-label="Map of your location" />
        <div className="absolute inset-x-3 top-3 z-[500] flex items-start gap-3 rounded-2xl bg-white p-3 text-slate-800 shadow-lg">
          <img src={`${BASE}logo-96.png`} alt="" className="size-9 shrink-0 object-contain" />
          <div className="min-w-0 text-[11px] leading-relaxed">
            {state === "locating" && <p>Finding your location…</p>}
            {state === "denied" && (
              <p>
                Location is off. Turn it on so you can share where you are.{" "}
                <button type="button" onClick={locate} className="font-semibold text-indigo-500">Try again</button>
              </p>
            )}
            {state === "ok" && pos && (
              <>
                <p className="font-medium">{address[0] ?? "Your location"}</p>
                <p className="text-slate-500">{address.slice(1).join(", ")}</p>
                <p className="text-slate-400">{pos.lat.toFixed(5)}, {pos.lon.toFixed(5)}</p>
              </>
            )}
          </div>
        </div>
        <ZoomButtons map={map} />
      </div>

      <section className="relative z-10 -mt-5 flex-1 rounded-t-[28px] bg-surface px-5 pt-6 pb-6 shadow-[0_-8px_24px_rgb(49_40_120/0.08)]">
        <p className="text-center text-[14px] font-semibold">Press the SOS button if you need immediate assistance.</p>
        <div className="mt-5 flex items-center gap-5">
          <button type="button" onClick={() => setSheet(true)} aria-label="SOS" className="relative grid size-28 shrink-0 place-items-center">
            <span className="sos-ring absolute inset-0 rounded-full bg-accent/40" aria-hidden />
            <span className="absolute inset-0 rounded-full bg-accent/20" aria-hidden />
            <span className="relative grid size-20 place-items-center rounded-full bg-accent text-[20px] font-bold tracking-wide text-white shadow-lg">SOS</span>
          </button>
          <div className="min-w-0">
            <p className="text-[12px] leading-relaxed text-muted">Press SOS to call for help, share your exact location, or find the nearest hospital.</p>
            <a href="tel:112" className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-red-500 px-4 py-2 text-[12px] font-bold tracking-wide text-red-600 dark:text-red-400">
              <PhoneCall size={15} /> EMERGENCY 112
            </a>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold">Nearest hospitals</h2>
            {hospitals.data?.length ? <button type="button" onClick={() => navigate("/rescue")} className="text-[12px] font-medium text-accent">Route</button> : null}
          </div>
          {state !== "ok" && <p className="text-[12px] text-muted">Needs your location.</p>}
          {state === "ok" && hospitals.isPending && <Skeleton className="h-14" />}
          {hospitals.isError && <p className="text-[12px] text-muted">Couldn't load hospitals. <button type="button" onClick={() => hospitals.refetch()} className="text-accent">Retry</button></p>}
          {hospitals.data?.length === 0 && <p className="text-[12px] text-muted">No hospitals mapped within 8 km.</p>}
          <ul className="space-y-2">
            {hospitals.data?.slice(0, 3).map((h) => <HospitalRow key={h.id} h={h} />)}
          </ul>
        </div>
      </section>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Emergency help">
        <div className="space-y-2.5 pb-4">
          <a href="tel:112" className="flex items-center gap-3 rounded-2xl bg-red-600 px-4 py-4 text-white">
            <Phone size={22} /> <span className="flex-1"><b className="block text-[16px]">Call 112</b><span className="text-[12px] opacity-90">Police, fire and ambulance</span></span>
          </a>
          <a href="tel:108" className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3.5">
            <Ambulance size={22} className="text-red-600" /> <span className="flex-1"><b className="block text-[15px]">Call 108</b><span className="text-[12px] text-muted">Ambulance</span></span>
          </a>
          <button type="button" onClick={shareLocation} className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3.5 text-left">
            <Share2 size={22} className="text-accent" /> <span className="flex-1"><b className="block text-[15px]">Share my location</b><span className="text-[12px] text-muted">Send a map link to family or friends</span></span>
          </button>
          <button type="button" onClick={() => { setSheet(false); navigate("/rescue"); }} className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3.5 text-left">
            <HospitalIcon size={22} className="text-accent" /> <span className="flex-1"><b className="block text-[15px]">Nearest hospital</b><span className="text-[12px] text-muted">Route and driving time</span></span>
          </button>
          <p className="pt-1 text-[11px] text-muted">RAPID-AI doesn't send responders itself. Calling 112 or 108 connects you to emergency services.</p>
        </div>
      </Sheet>
    </div>
  );
}

function HospitalRow({ h, active, onClick }: { h: Hospital; active?: boolean; onClick?: () => void }) {
  return (
    <li className={cn("flex items-center gap-3 rounded-2xl border px-3 py-2.5", active ? "border-accent bg-accent-soft" : "border-line bg-surface")}>
      <button type="button" onClick={onClick} disabled={!onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Plus size={18} strokeWidth={3} /></span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium">{h.name}</span>
          <span className="block text-[11px] text-muted">{h.km.toFixed(1)} km away{h.emergency ? " · emergency dept." : ""}</span>
        </span>
      </button>
      <a href={directionsUrl(h)} target="_blank" rel="noreferrer" aria-label={`Directions to ${h.name}`} className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white">
        <Navigation size={16} />
      </a>
    </li>
  );
}

export function RescueScreen() {
  const { pos, state, locate } = usePrecisePosition();
  const { div, map } = useLeaflet(pos, 14);
  const hospitals = useHospitals(pos);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const target = hospitals.data?.find((h) => h.id === chosenId) ?? hospitals.data?.[0] ?? null;
  const route = useRoute(pos, target);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!map.current || !pos) return;
    layer.current?.remove();
    const group = L.layerGroup().addTo(map.current);
    hospitals.data?.slice(0, 15).forEach((h) =>
      L.marker([h.lat, h.lon], { icon: HOSPITAL_PIN, title: h.name }).bindTooltip(h.name, { permanent: h.id === target?.id, direction: "top", offset: [0, -12] }).on("click", () => setChosenId(h.id)).addTo(group),
    );
    if (route.data) L.polyline(route.data.line, { color: "#7166e8", weight: 5, opacity: 0.9 }).addTo(group);
    L.marker([pos.lat, pos.lon], {
      icon: pin(`<div style="width:40px;height:40px;border-radius:9999px;background:rgb(113 102 232/.3);display:grid;place-items:center"><div style="width:28px;height:28px;border-radius:9999px;background:#7166e8;color:#fff;font:700 9px Poppins,sans-serif;display:grid;place-items:center;border:2px solid #fff">SOS</div></div>`, 40),
      title: "You",
    }).addTo(group);
    if (route.data) map.current.fitBounds(L.latLngBounds(route.data.line), { paddingTopLeft: [40, 110], paddingBottomRight: [60, 40] });
    layer.current = group;
  }, [pos, hospitals.data, route.data, target?.id, map]);

  return (
    <div className="flex min-h-full flex-col">
      <ScreenHeader title="Hospital Rescue" />
      <div className="relative isolate h-[52vh] min-h-[280px] shrink-0">
        <div ref={div} className="absolute inset-0" aria-label="Route to the nearest hospital" />
        <span className="absolute top-3 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[12px] font-semibold text-indigo-500 shadow-md">
          <span className="grid size-5 place-items-center rounded-full bg-indigo-500 text-white"><Plus size={13} strokeWidth={3} /></span>
          Hospital Rescue
        </span>
        <ZoomButtons map={map} />
      </div>
      <section className="relative z-10 -mt-5 flex-1 space-y-3 rounded-t-[28px] bg-surface px-5 pt-5 pb-6">
        {state === "denied" && (
          <p className="text-[13px] text-muted">Turn on location to find the nearest hospital. <button type="button" onClick={locate} className="inline-flex items-center gap-1 font-semibold text-accent"><RefreshCw size={13} /> Try again</button></p>
        )}
        {(state === "locating" || hospitals.isPending) && state !== "denied" && <Skeleton className="h-20" />}
        {target && (
          <div className="flex items-start gap-3 rounded-2xl border border-line p-3 shadow-sm">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><HospitalIcon size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">{target.name}</p>
              <p className="text-[12px] text-muted">
                {route.data ? `${route.data.km.toFixed(1)} km · about ${Math.max(1, Math.round(route.data.minutes))} min by road` : route.isError ? `${target.km.toFixed(1)} km in a straight line` : "Working out the route…"}
              </p>
              <div className="mt-2.5 flex gap-2">
                <a href={directionsUrl(target)} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-[13px] font-semibold text-white"><Navigation size={15} /> Directions</a>
                <a href="tel:108" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-red-500 py-2 text-[13px] font-semibold text-red-600 dark:text-red-400"><Ambulance size={16} /> Call 108</a>
              </div>
            </div>
          </div>
        )}
        {hospitals.data && hospitals.data.length > 1 && (
          <>
            <h2 className="pt-1 text-[13px] font-semibold">Nearby hospitals · tap to route</h2>
            <ul className="space-y-2">
              {hospitals.data.slice(0, 6).map((h) => <HospitalRow key={h.id} h={h} active={h.id === target?.id} onClick={() => setChosenId(h.id)} />)}
            </ul>
          </>
        )}
        <p className="text-[11px] text-muted">Hospitals from OpenStreetMap; driving times from OSRM and may differ in traffic. RAPID-AI doesn't dispatch ambulances — call 108 or 112.</p>
      </section>
    </div>
  );
}
