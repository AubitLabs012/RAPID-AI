import { Activity, CloudLightning, Flame, Mountain, Tornado, Triangle, Waves, type LucideIcon } from "lucide-react";

export type HazardType = "earthquake" | "flood" | "cyclone" | "landslide" | "wildfire" | "weather" | "volcano";
export type Severity = "High" | "Moderate" | "Low" | "Watch";

// Order matches the filter chips in the mockup.
export const HAZARDS: { type: HazardType; label: string; color: string; Icon: LucideIcon }[] = [
  { type: "earthquake", label: "Earthquake", color: "#ef4444", Icon: Activity },
  { type: "flood", label: "Flood", color: "#2563eb", Icon: Waves },
  { type: "cyclone", label: "Cyclone", color: "#9333ea", Icon: Tornado },
  { type: "landslide", label: "Landslide", color: "#a16207", Icon: Mountain },
  { type: "wildfire", label: "Wildfire", color: "#f97316", Icon: Flame },
  { type: "weather", label: "Weather", color: "#0ea5e9", Icon: CloudLightning },
  { type: "volcano", label: "Volcano", color: "#78716c", Icon: Triangle },
];

export const hazard = (type: HazardType) => HAZARDS.find((h) => h.type === type)!;

export function HazardIcon({ type, size = 18, filled = false }: { type: HazardType; size?: number; filled?: boolean }) {
  const h = hazard(type);
  if (!filled) return <h.Icon size={size} color={h.color} strokeWidth={2.2} aria-hidden />;
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full"
      style={{ width: size * 1.9, height: size * 1.9, background: `${h.color}1f` }}
      aria-hidden
    >
      <h.Icon size={size} color={h.color} strokeWidth={2.2} />
    </span>
  );
}

const SEVERITY_STYLE: Record<Severity, string> = {
  High: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  Moderate: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  Low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  Watch: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

// Severity always shows as a text badge, never colour alone.
export function SeverityBadge({ severity, label }: { severity: Severity; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_STYLE[severity]}`}>
      {label ?? severity}
    </span>
  );
}
