import type { MarineMarker } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export async function fetchMarineMarkers(): Promise<MarineMarker[]> {
  const backendUrl = `${API_BASE}/api/marine/markers`;
  const fallbackUrl = "/src/marine-markers.json";

  try {
    const response = await fetch(backendUrl, { headers: { Accept: "application/json" } });
    if (response.ok) {
      return response.json();
    }
  } catch {
    // Local static preview can run without the FastAPI service.
  }

  const fallback = await fetch(fallbackUrl, { headers: { Accept: "application/json" } });
  if (!fallback.ok) {
    throw new Error(`Marker API returned ${fallback.status}`);
  }
  return fallback.json();
}
