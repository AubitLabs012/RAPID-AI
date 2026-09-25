import { useSyncExternalStore } from "react";

// Everything the app remembers lives in this one localStorage entry per key.
// Every read/write is wrapped: storage can be blocked (private mode) and the app must still work.
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function createStore<T extends object>(key: string, initial: T) {
  let value = read(key, initial);
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(update: Partial<T> | ((v: T) => Partial<T>)) {
      value = { ...value, ...(typeof update === "function" ? update(value) : update) };
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Keep working in memory for this visit.
      }
      listeners.forEach((fn) => fn());
    },
    use(): T {
      return useSyncExternalStore(
        (fn) => {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
        () => value,
      );
    },
  };
}

export type Theme = "light" | "dark" | "system";
export type SavedPlace = { name: string; lat: number; lon: number; savedAt: number };

export const settings = createStore("rapid-mobile-settings", {
  theme: "system" as Theme,
  displayName: "",
  refreshMinutes: 10,
});

export const places = createStore("rapid-mobile-places", {
  saved: [] as SavedPlace[],
  history: [] as SavedPlace[],
});

export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function isSaved(p: { lat: number; lon: number }) {
  return places.get().saved.some((s) => Math.abs(s.lat - p.lat) < 1e-3 && Math.abs(s.lon - p.lon) < 1e-3);
}

export function toggleSaved(p: { name: string; lat: number; lon: number }) {
  places.set((v) => ({
    saved: isSaved(p)
      ? v.saved.filter((s) => !(Math.abs(s.lat - p.lat) < 1e-3 && Math.abs(s.lon - p.lon) < 1e-3))
      : [{ ...p, savedAt: Date.now() }, ...v.saved],
  }));
}

export function addToHistory(p: { name: string; lat: number; lon: number }) {
  places.set((v) => ({
    history: [
      { ...p, savedAt: Date.now() },
      ...v.history.filter((s) => !(Math.abs(s.lat - p.lat) < 1e-3 && Math.abs(s.lon - p.lon) < 1e-3)),
    ].slice(0, 20),
  }));
}
