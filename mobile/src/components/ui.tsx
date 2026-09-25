import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Bell, Home, LayoutGrid, Map, Menu, type LucideIcon } from "lucide-react";
import { goBack, navigate } from "../lib/router";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const TABS: { path: string; label: string; Icon: LucideIcon }[] = [
  { path: "/", label: "Home", Icon: Home },
  { path: "/map", label: "Map", Icon: Map },
  { path: "/alerts", label: "Alerts", Icon: Bell },
  { path: "/tools", label: "Tools", Icon: LayoutGrid },
  { path: "/more", label: "More", Icon: Menu },
];

export function TabBar({ active }: { active: string }) {
  return (
    <nav
      aria-label="Main"
      className="safe-bottom relative z-30 grid shrink-0 grid-cols-5 border-t border-line bg-surface pt-1.5"
    >
      {TABS.map(({ path, label, Icon }) => {
        const isActive = active === path;
        return (
          <button
            key={path}
            type="button"
            onClick={() => navigate(path)}
            aria-current={isActive ? "page" : undefined}
            className={cn("flex flex-col items-center gap-1 py-1 text-[11px] font-medium", isActive ? "text-accent" : "text-muted")}
          >
            <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  actions,
  back = true,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  back?: boolean;
}) {
  return (
    <header className="safe-top sticky top-0 z-20 flex items-center gap-2 bg-bg/90 px-3 pb-2 backdrop-blur">
      {back && (
        <button type="button" onClick={() => goBack()} aria-label="Back" className="grid size-10 place-items-center rounded-full text-ink active:bg-surface-2">
          <ArrowLeft size={22} />
        </button>
      )}
      <div className={cn("min-w-0 flex-1", !back && "pl-2")}>
        <h1 className="truncate text-[19px] font-semibold text-ink">{title}</h1>
        {subtitle && <p className="truncate text-[12px] text-muted">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}

export function IconButton({ label, onClick, children, className }: { label: string; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cn("grid size-10 place-items-center rounded-full text-ink active:bg-surface-2", className)}>
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  dark = false,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div role="tablist" className={cn("flex rounded-xl p-1", dark ? "glass-light" : "bg-surface-2", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 rounded-lg px-2 py-2 text-[13px] font-medium",
              active ? "bg-accent-soft text-accent shadow-sm dark:bg-accent dark:text-white" : dark ? "text-slate-600" : "text-muted",
            )}
            style={dark && active ? { background: "#dbe7ff", color: "#1d4ed8" } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Bottom sheet dialog.
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fade-in absolute inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-up safe-bottom max-h-[85%] w-full overflow-y-auto rounded-t-3xl bg-surface px-4 pt-2 text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" aria-hidden />
        {title && <h2 className="mb-3 text-[17px] font-semibold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

// Lightweight toast, triggered from anywhere with toast("...").
let pushToast: (text: string) => void = () => {};
export function toast(text: string) {
  pushToast(text);
}
export function ToastHost() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let timer: number;
    pushToast = (t) => {
      setText(t);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setText(null), 2600);
    };
    return () => window.clearTimeout(timer);
  }, []);
  if (!text) return null;
  return (
    <div role="status" className="fade-in pointer-events-none absolute inset-x-4 bottom-24 z-[60] rounded-2xl bg-slate-900/95 px-4 py-3 text-center text-[13px] text-white shadow-lg">
      {text}
    </div>
  );
}

export function comingSoon(feature: string) {
  toast(`${feature} is coming soon.`);
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 text-[13px] text-muted">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-surface-2", className)} aria-hidden />;
}
