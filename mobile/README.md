# RAPID-AI Mobile

A phone-first version of RAPID-AI, kept separate from the desktop dashboard in the repo root.
It's a mobile web app: open it in a phone browser and use **Add to Home Screen** to get a full-screen app icon.

Live: https://aubitlabs012.github.io/RAPID-AI/mobile/

## Screens

| Tab / screen | What it does |
| --- | --- |
| **Home** | 3D globe with live disaster markers, hazard filter chips, place search (with voice), my-location, and a 7-day replay timeline |
| **Place** (tap a marker or search result) | Live weather, rule-based alerts, live updates nearby, analysis against published thresholds, 24-hour and 7-day forecast, save, share, text report |
| **Map** ("Live View") | Satellite (true colour, infrared, clouds), rain radar with a 2-hour replay, terrain; disaster markers |
| **Alerts** ("Find Disasters") | Nearby / India / World lists with satellite thumbnails and severity |
| **Tools** | Weather info, GeoJSON data download, share; other tools marked "Soon" |
| **More** | Saved places, history, settings (Day / Night / Auto theme, refresh rate), help, data sources |
| **Ask RAPID-AI** | Answers questions from the live feeds plus safety guidance. No AI model is connected yet |

## Data (all free, no API keys)

- Earthquakes: [USGS](https://earthquake.usgs.gov/earthquakes/feed/) (M2.5+, last 7 days)
- Wildfires, storms, volcanoes, floods: [NASA EONET](https://eonet.gsfc.nasa.gov/) (open events)
- Weather, forecast, place search: [Open-Meteo](https://open-meteo.com/)
- Satellite: Esri World Imagery, [NASA GIBS](https://www.earthdata.nasa.gov/gibs) (MODIS, VIIRS)
- Rain radar: [RainViewer](https://www.rainviewer.com/api.html) · Terrain: OpenTopoMap · Reverse geocoding: BigDataCloud

Weather alerts are worked out from the forecast using IMD rainfall and heat categories; they are **not official warnings**.

## Run locally

```bash
cd mobile
npm install
npm run dev
```

Open http://localhost:4174/RAPID-AI/mobile/ and use your browser's phone/responsive view.

## Build for GitHub Pages

```bash
cd mobile
npm run build
```

`dist/` goes into the `mobile/` folder of the `gh-pages` branch, next to the desktop site.

## Code map

```
src/
  App.tsx              tab bar + screen routing (hash URLs, so links and Back work on GitHub Pages)
  screens/             Home, Map, Alerts, Tools, More, Place, Assistant, settings/help/about
  components/          Globe (Three.js), Timeline, SearchOverlay, EventPreview, shared UI
  services/            events (USGS + EONET), weather (Open-Meteo + alert rules), geocode
  lib/                 hazards (types, colours, icons), geo helpers, router, local storage
```
