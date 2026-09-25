import { useSyncExternalStore } from "react";

// Tiny hash router. Hash URLs work on GitHub Pages (no server rewrites) and keep the
// phone's back button / swipe-back working, e.g. #/place?lat=28.6&lon=77.2&name=New%20Delhi
export type Route = { path: string; params: URLSearchParams };

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { path: path || "/", params: new URLSearchParams(query) };
}

let current = parse();
const listeners = new Set<() => void>();
window.addEventListener("hashchange", () => {
  current = parse();
  listeners.forEach((fn) => fn());
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}

export function navigate(path: string, params?: Record<string, string | number | undefined>) {
  const query = params
    ? new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]),
      ).toString()
    : "";
  window.location.hash = query ? `${path}?${query}` : path;
}

export function goBack(fallback = "/") {
  // If the user opened a deep link directly there is no history to go back to.
  if (window.history.length > 1) window.history.back();
  else navigate(fallback);
}

export function openPlace(place: { lat: number; lon: number; name: string; event?: string }) {
  navigate("/place", { lat: place.lat.toFixed(4), lon: place.lon.toFixed(4), name: place.name, event: place.event });
}
