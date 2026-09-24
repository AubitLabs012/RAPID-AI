# RAPID-AI Prototype

This project is now a high-fidelity RAPID-AI dashboard prototype for oceanographic, fisheries, and biodiversity monitoring.

It includes:

- Dark command-center dashboard layout, with a **Day / Night mode** switch in the top bar (also in Settings). The choice is saved in the browser; the globe fades between a blue night tint and true-colour daylight
- Sidebar navigation for live maps, ocean conditions, fisheries, biodiversity, predictions, alerts, assistant, uploads, and settings
- KPI cards for sea surface temperature, chlorophyll, abundance, biodiversity, health score, and alerts
- Leaflet marine explorer with zoom, pan, search, marker clustering, popups, coordinates, and layer controls
- Marine layers for SST, chlorophyll, fisheries, biodiversity, coral reefs, and ocean currents
- **Live weather** for each region from [Open-Meteo](https://open-meteo.com/) (free, no API key): current conditions on the Regional Analysis card, plus current readings and a 3-day forecast in the area analysis drawer. Refreshes on the Settings data-refresh interval (default 10 min). Code: `src/services/weather.ts`, `src/components/rapid/LiveWeather.tsx`
- Dynamic marker loading from `src/marine-markers.json`, which can be replaced with a backend API endpoint
- Analytics panels for fish prediction, biodiversity distribution, and ocean health
- Alerts and AI assistant side panels
- Species-in-focus cards with marine imagery

## Run

This is a Vite + React app:

```bash
npm install
npm run dev
```

Then open `http://localhost:4173`.

## Notes

- The current deliverable is a static frontend prototype.
- Dashboard data is sample UI data and can be connected to real APIs later.
- The backend folder is still present from the previous project and can be repurposed for RAPID-AI APIs if needed.
