import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertsPanel } from "./components/dashboard/AlertsPanel";
import { AnalyticsDeck } from "./components/dashboard/AnalyticsDeck";
import { CommandPalette } from "./components/dashboard/CommandPalette";
import { CopilotPanel } from "./components/dashboard/CopilotPanel";
import { KpiStrip } from "./components/dashboard/KpiStrip";
import { SpeciesFocus } from "./components/dashboard/SpeciesFocus";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { MarineMapbox } from "./components/map/MarineMapbox";
import { useDashboardStore } from "./store";

function App() {
  const setCommandPaletteOpen = useDashboardStore((state) => state.setCommandPaletteOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setCommandPaletteOpen]);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="mission-main">
        <TopBar />
        <KpiStrip />
        <motion.section
          className="mission-workspace"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div className="mission-center">
            <MarineMapbox />
            <AnalyticsDeck />
          </div>
          <aside className="mission-right-rail">
            <AlertsPanel />
            <CopilotPanel />
          </aside>
        </motion.section>
        <SpeciesFocus />
      </main>
      <CommandPalette />
    </div>
  );
}

export default App;
