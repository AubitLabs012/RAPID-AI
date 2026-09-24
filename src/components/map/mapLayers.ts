import L from 'leaflet';

export type MapMode = 'normal' | 'satellite' | 'risks';

// Shared by the original MARIS explorer and the RAPID regional map.
export function createBaseLayer(mode: MapMode) {
  return mode === 'satellite'
    ? L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      maxNativeZoom: 18, maxZoom: 19,
    })
    : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    });
}
