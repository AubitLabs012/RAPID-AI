import { Bell, Gauge, LayoutDashboard, MapPinned, Moon, RotateCcw, Shield, Sparkles, Sun } from "lucide-react";
import { useDashboardStore } from "../../store";

const homeStyles = [
  { id: "glass", label: "Glass", description: "Ocean glass panels with full visual depth." },
  { id: "compact", label: "Compact", description: "Smaller home controls for quicker scanning." },
  { id: "focus", label: "Focus", description: "Cleaner home layout with softer panels." },
] as const;

const refreshOptions = [5, 10, 15, 30];

export function SettingsPanel() {
  const homeStyle = useDashboardStore((state) => state.homeStyle);
  const colorMode = useDashboardStore((state) => state.colorMode);
  const reducedMotion = useDashboardStore((state) => state.reducedMotion);
  const mapLabels = useDashboardStore((state) => state.mapLabels);
  const alertNotifications = useDashboardStore((state) => state.alertNotifications);
  const dataRefreshMinutes = useDashboardStore((state) => state.dataRefreshMinutes);
  const setHomeStyle = useDashboardStore((state) => state.setHomeStyle);
  const setColorMode = useDashboardStore((state) => state.setColorMode);
  const setReducedMotion = useDashboardStore((state) => state.setReducedMotion);
  const setMapLabels = useDashboardStore((state) => state.setMapLabels);
  const setAlertNotifications = useDashboardStore((state) => state.setAlertNotifications);
  const setDataRefreshMinutes = useDashboardStore((state) => state.setDataRefreshMinutes);

  return (
    <section className="settings-panel glass-panel" aria-label="Application settings">
      <header>
        <div>
          <span><Sparkles size={16} />Preferences</span>
          <h2>Settings</h2>
          <p>Personalize the RAPID-AI workspace for dashboard review, live ocean monitoring, and analysis workflows.</p>
        </div>
      </header>

      <div className="settings-grid">
        <article className="settings-card wide">
          <header>
            <Sun size={19} />
            <div>
              <h3>Day / Night</h3>
              <p>Switch between the bright reef background and the darker ocean dashboard mood.</p>
            </div>
          </header>
          <div className="settings-mode-switch" aria-label="Day and night mode">
            <button
              type="button"
              className={colorMode === "day" ? "active" : ""}
              onClick={() => setColorMode("day")}
            >
              <Sun size={18} />
              <span>Day</span>
            </button>
            <button
              type="button"
              className={colorMode === "night" ? "active" : ""}
              onClick={() => setColorMode("night")}
            >
              <Moon size={18} />
              <span>Night</span>
            </button>
          </div>
        </article>

        <article className="settings-card wide">
          <header>
            <LayoutDashboard size={19} />
            <div>
              <h3>Home Style</h3>
              <p>Change how the Home dashboard feels when the four metric circles and globe are shown.</p>
            </div>
          </header>
          <div className="home-style-options" role="radiogroup" aria-label="Home style">
            {homeStyles.map((style) => (
              <button
                key={style.id}
                type="button"
                className={homeStyle === style.id ? "active" : ""}
                onClick={() => setHomeStyle(style.id)}
              >
                <strong>{style.label}</strong>
                <span>{style.description}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="settings-card">
          <header>
            <MapPinned size={19} />
            <div>
              <h3>Map Display</h3>
              <p>Control overlays and coordinate readouts.</p>
            </div>
          </header>
          <label className="settings-toggle">
            <span>
              <strong>Show map labels</strong>
              <small>Layer panel and live coordinates stay visible.</small>
            </span>
            <input type="checkbox" checked={mapLabels} onChange={(event) => setMapLabels(event.currentTarget.checked)} />
          </label>
        </article>

        <article className="settings-card">
          <header>
            <Gauge size={19} />
            <div>
              <h3>Live Refresh</h3>
              <p>Set the preferred live-ocean refresh rhythm.</p>
            </div>
          </header>
          <div className="settings-segmented" aria-label="Refresh interval">
            {refreshOptions.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className={dataRefreshMinutes === minutes ? "active" : ""}
                onClick={() => setDataRefreshMinutes(minutes)}
              >
                {minutes}m
              </button>
            ))}
          </div>
        </article>

        <article className="settings-card">
          <header>
            <Bell size={19} />
            <div>
              <h3>Alerts</h3>
              <p>Keep important risk and upload results visible.</p>
            </div>
          </header>
          <label className="settings-toggle">
            <span>
              <strong>Dashboard alerts</strong>
              <small>Show risk and model notification badges.</small>
            </span>
            <input
              type="checkbox"
              checked={alertNotifications}
              onChange={(event) => setAlertNotifications(event.currentTarget.checked)}
            />
          </label>
        </article>

        <article className="settings-card">
          <header>
            <Sparkles size={19} />
            <div>
              <h3>Motion</h3>
              <p>Reduce heavy UI animation while keeping the app usable.</p>
            </div>
          </header>
          <label className="settings-toggle">
            <span>
              <strong>Reduced motion</strong>
              <small>Softens panel transitions and decorative motion.</small>
            </span>
            <input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.currentTarget.checked)} />
          </label>
        </article>

        <article className="settings-card wide">
          <header>
            <Shield size={19} />
            <div>
              <h3>Account & Data</h3>
              <p>Session is local for now. Uploads and model analysis stay controlled from the dashboard tools.</p>
            </div>
          </header>
          <button
            className="settings-reset-button"
            type="button"
            onClick={() => {
              setHomeStyle("glass");
              setColorMode("night");
              setReducedMotion(false);
              setMapLabels(true);
              setAlertNotifications(true);
              setDataRefreshMinutes(10);
            }}
          >
            <RotateCcw size={17} />
            <span>Reset Settings</span>
          </button>
        </article>
      </div>
    </section>
  );
}
