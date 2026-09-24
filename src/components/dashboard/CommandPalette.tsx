import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { commandItems } from "../../data/dashboard";
import { useDashboardStore } from "../../store";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function CommandPalette() {
  const open = useDashboardStore((state) => state.commandPaletteOpen);
  const setOpen = useDashboardStore((state) => state.setCommandPaletteOpen);
  const setSatelliteEnabled = useDashboardStore((state) => state.setSatelliteEnabled);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="command-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Command palette">
          <motion.section className="command-palette glass-panel" initial={{ opacity: 0, y: -18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -18, scale: 0.98 }}>
            <header>
              <Search size={18} />
              <Input autoFocus placeholder="Run a command or search datasets..." />
              <Button variant="icon" type="button" aria-label="Close command palette" onClick={() => setOpen(false)}><X size={18} /></Button>
            </header>
            <div>
              {commandItems.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (label === "Toggle satellite imagery") setSatelliteEnabled(false);
                    setOpen(false);
                  }}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  <kbd>Enter</kbd>
                </button>
              ))}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
