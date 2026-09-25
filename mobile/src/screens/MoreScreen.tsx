import { Bell, ChevronRight, Clock, Crown, Download, FileText, HelpCircle, Info, MapPin, Settings, UserRound, type LucideIcon } from "lucide-react";
import { ScreenHeader, comingSoon } from "../components/ui";
import { navigate } from "../lib/router";
import { places, settings } from "../lib/storage";

type Item = { label: string; Icon: LucideIcon; onClick: () => void; badge?: string };

export function MoreScreen() {
  const { displayName } = settings.use();
  const { saved, history } = places.use();

  const primary: Item[] = [
    { label: "Saved Locations", Icon: MapPin, onClick: () => navigate("/saved"), badge: saved.length ? String(saved.length) : undefined },
    { label: "My Alerts", Icon: Bell, onClick: () => navigate("/alerts") },
    { label: "History", Icon: Clock, onClick: () => navigate("/history"), badge: history.length ? String(history.length) : undefined },
    { label: "Reports", Icon: FileText, onClick: () => comingSoon("A saved reports list") },
    { label: "Offline Maps", Icon: Download, onClick: () => comingSoon("Offline maps") },
  ];
  const secondary: Item[] = [
    { label: "Settings", Icon: Settings, onClick: () => navigate("/settings") },
    { label: "Help & Guide", Icon: HelpCircle, onClick: () => navigate("/help") },
    { label: "About RAPID-AI", Icon: Info, onClick: () => navigate("/about") },
  ];

  return (
    <div className="pb-6">
      <ScreenHeader back={false} title="More" />
      <div className="space-y-4 px-4">
        <button type="button" onClick={() => navigate("/settings")} className="card flex w-full items-center gap-4 p-4 text-left">
          <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
            <UserRound size={28} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] font-semibold">{displayName || "Guest"}</span>
            <span className="block text-[13px] text-muted">{displayName ? "Free plan" : "Tap to add your name"}</span>
          </span>
          <ChevronRight size={20} className="text-muted" />
        </button>

        <List items={primary} />
        <List items={secondary} />

        <button
          type="button"
          onClick={() => comingSoon("Paid plans")}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 py-4 text-[15px] font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
        >
          <Crown size={20} className="text-amber-500" /> Upgrade for Advanced Features
        </button>
      </div>
    </div>
  );
}

function List({ items }: { items: Item[] }) {
  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {items.map(({ label, Icon, onClick, badge }) => (
        <li key={label}>
          <button type="button" onClick={onClick} className="flex w-full items-center gap-4 px-4 py-3.5 text-left active:bg-surface-2">
            <Icon size={21} className="text-ink-2" />
            <span className="flex-1 text-[15px]">{label}</span>
            {badge && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[12px] font-semibold text-muted">{badge}</span>}
            <ChevronRight size={18} className="text-muted" />
          </button>
        </li>
      ))}
    </ul>
  );
}
