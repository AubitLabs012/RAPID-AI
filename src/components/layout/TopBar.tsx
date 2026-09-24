import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronDown, Globe2, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useDashboardStore } from "../../store";

export function TopBar() {
  const setCommandPaletteOpen = useDashboardStore((state) => state.setCommandPaletteOpen);
  const alertNotifications = useDashboardStore((state) => state.alertNotifications);
  const [now, setNow] = useState(() => new Date());
  const liveTime = useMemo(
    () => ({
      date: new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(now),
      weekday: new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(now),
      time: new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(now),
      season: getSeason(now),
    }),
    [now],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-actions">
        <Button className="icon-button" variant="icon" type="button" aria-label="Search" onClick={() => setCommandPaletteOpen(true)}>
          <Search size={21} />
        </Button>
        <Button className="date-button home-clock-card" type="button" aria-label="Live home clock">
          <span className="home-clock-label">Home Clock</span>
          <strong>{liveTime.time}</strong>
          <span className="home-clock-meta">{liveTime.weekday}<i />{liveTime.season}</span>
          <small>{liveTime.date}</small>
        </Button>
        {alertNotifications && (
          <Button className="icon-button alert-badge" variant="icon" type="button" aria-label="Notifications">
            <Bell size={21} />
            <span>3</span>
          </Button>
        )}
        <Button className="icon-button" variant="icon" type="button" aria-label="Language">
          <Globe2 size={21} />
        </Button>
        <button className="topbar-admin-chip" type="button" aria-label="Admin account">
          <span>A</span>
          <strong>Admin</strong>
          <ChevronDown size={15} />
        </button>
        <Input className="hidden-input" aria-hidden="true" tabIndex={-1} />
      </div>
    </header>
  );
}

function getSeason(date: Date) {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return "Spring";
  if (month >= 5 && month <= 7) return "Summer";
  if (month >= 8 && month <= 10) return "Autumn";
  return "Winter";
}
