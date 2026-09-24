import { Waves } from "lucide-react";
import { navItems } from "../../data/dashboard";
import { useDashboardStore } from "../../store";

type SidebarProps = {
  onLogoClick?: () => void;
};

export function Sidebar({ onLogoClick }: SidebarProps) {
  const activeNav = useDashboardStore((state) => state.activeNav);
  const setActiveNav = useDashboardStore((state) => state.setActiveNav);

  return (
    <aside className="sidebar" aria-label="Primary">
      <a
        className="brand"
        href="#"
        onClick={(event) => {
          event.preventDefault();
          onLogoClick?.();
        }}
      >
        <span className="brand-mark" aria-hidden="true"><Waves size={28} /></span>
        <span>
            <strong>RAPID-AI</strong>
          <small>AI-Powered Ocean Intelligence Platform for Oceanographic, Fisheries & Biodiversity Insights</small>
        </span>
      </a>

      <nav className="nav-list">
        {navItems.map(({ label, icon: Icon }) => (
          <a
            key={label}
            className={`nav-item ${activeNav === label ? "active" : ""}`}
            href="#"
            aria-current={activeNav === label ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              setActiveNav(label);
            }}
          >
            <Icon size={21} />
            <span>{label}</span>
          </a>
        ))}
      </nav>

    </aside>
  );
}
