# RAPID-AI Prototype

This project is now a high-fidelity RAPID-AI dashboard prototype for oceanographic, fisheries, and biodiversity monitoring.

It includes:

- Dark command-center dashboard layout
- Sidebar navigation for live maps, ocean conditions, fisheries, biodiversity, predictions, alerts, assistant, uploads, and settings
- KPI cards for sea surface temperature, chlorophyll, abundance, biodiversity, health score, and alerts
- Leaflet marine explorer with zoom, pan, search, marker clustering, popups, coordinates, and layer controls
- Marine layers for SST, chlorophyll, fisheries, biodiversity, coral reefs, and ocean currents
- Dynamic marker loading from `src/marine-markers.json`, which can be replaced with a backend API endpoint
- Analytics panels for fish prediction, biodiversity distribution, and ocean health
- Alerts and AI assistant side panels
- Species-in-focus cards with marine imagery

## Run

Serve the folder locally so Leaflet assets and the dynamic marker API request can load correctly:

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Notes

- The current deliverable is a static frontend prototype.
- Dashboard data is sample UI data and can be connected to real APIs later.
- The backend folder is still present from the previous project and can be repurposed for RAPID-AI APIs if needed.
