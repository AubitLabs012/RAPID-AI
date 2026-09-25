# RAPID-AI Mobile

A phone-first version of RAPID-AI, kept separate from the desktop dashboard in the repo root.
It's a mobile web app: open it in a phone browser and use **Add to Home Screen** to get a full-screen app icon.

Live: https://aubitlabs012.github.io/RAPID-AI/mobile/

## Screens

The look follows a soft lavender "EQ alert" style: white rounded cards, a purple bottom bar with search, Poppins type.

| Tab / screen | What it does |
| --- | --- |
| **Home** | Status for your chosen place (Normal / Watch / Danger), a live warning card, Disaster Guide (earthquake, tsunami, fire, volcano, strong winds, floods), weather for several cities, link to the live globe |
| **Map** ("Live View") | Satellite (true colour, infrared, clouds), rain radar with a 2-hour replay, terrain; disaster markers; 3D globe button |
| **SOS** ("Current Location") | Your address on a street map, SOS button (call 112 / 108, share your location, nearest hospital), nearby hospitals |
| **Hospital Rescue** | Driving route and time to the nearest hospital, directions, call 108 |
| **Alerts** ("Find Disasters") | Nearby / India / World lists with satellite thumbnails and severity |
| **Profile** | Saved places, history, tools, assistant, settings (Day / Night / Auto), help, data sources |
| **Place** | Live weather, rule-based alerts, nearby updates, analysis, 24-hour and 7-day forecast, save, share, text report |
| **Globe** | 3D globe with live disaster markers, hazard chips and a 7-day replay |
| **Ask RAPID-AI** | Answers from the live feeds plus safety guidance. No AI model is connected yet |

RAPID-AI does not dispatch responders: SOS connects you to 112 / 108 and helps you share where you are.

## Data (all free, no API keys)

- Earthquakes: [USGS](https://earthquake.usgs.gov/earthquakes/feed/) (M2.5+, last 7 days)
- Wildfires, storms, volcanoes, floods: [NASA EONET](https://eonet.gsfc.nasa.gov/) (open events)
- Weather, forecast, place search: [Open-Meteo](https://open-meteo.com/)
- Satellite: Esri World Imagery, [NASA GIBS](https://www.earthdata.nasa.gov/gibs) (MODIS, VIIRS)
- Rain radar: [RainViewer](https://www.rainviewer.com/api.html) · Terrain: OpenTopoMap · Reverse geocoding: BigDataCloud
- Hospitals: OpenStreetMap via the [Overpass API](https://overpass-api.de/) · Driving routes: [OSRM](https://project-osrm.org/) · Street map: Esri

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
