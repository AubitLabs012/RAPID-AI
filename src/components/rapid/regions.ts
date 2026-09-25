export type Region = {
  id: string; name: string; state: string; lat: number; lng: number;
  hazard: string; level: 'High' | 'Moderate'; score: number;
  rain: number; wind: number; exposure: string; summary: string; trend: number[];
};

// Illustrative scenarios for the interface. These are not observations or forecasts.
// Coordinates are the mapped city-center points (WGS84), so the pin tip has a
// stable geographic location at every map zoom level.
export const regions: Region[] = [
  { id: 'odisha', name: 'Bhubaneswar', state: 'Odisha', lat: 20.2961, lng: 85.8245, hazard: 'Cyclone', level: 'High', score: 78, rain: 124, wind: 86, exposure: 'Coastal districts', summary: 'This sample scenario combines strong coastal winds and sustained rainfall. The analysis highlights the Odisha coastal corridor and low-lying urban areas.', trend: [18, 24, 21, 35, 31, 49, 40, 62, 58, 72, 78] },
  { id: 'assam', name: 'Guwahati', state: 'Assam', lat: 26.1445, lng: 91.7362, hazard: 'Flood', level: 'High', score: 84, rain: 168, wind: 24, exposure: 'River-adjacent areas', summary: 'This sample flood scenario models prolonged rainfall in the Brahmaputra valley. River-adjacent settlements and low-lying transport corridors are the focus of this regional view.', trend: [30, 28, 39, 42, 50, 48, 66, 71, 68, 80, 84] },
  { id: 'chennai', name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, hazard: 'Flood', level: 'Moderate', score: 56, rain: 72, wind: 32, exposure: 'Urban catchments', summary: 'This sample urban flood scenario shows rainfall accumulation around Chennai. The interface groups drainage, rainfall, and coastal exposure into a single regional view.', trend: [20, 25, 23, 28, 35, 32, 44, 40, 46, 52, 56] },
  { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777, hazard: 'Flood', level: 'High', score: 73, rain: 142, wind: 38, exposure: 'Urban coastal belt', summary: 'This sample scenario combines intense rainfall with coastal exposure in Mumbai. The displayed indicators illustrate how an urban flood analysis would be presented.', trend: [26, 32, 29, 42, 50, 44, 60, 55, 66, 70, 73] },
  { id: 'delhi', name: 'New Delhi', state: 'Delhi', lat: 28.6139, lng: 77.2090, hazard: 'Heatwave', level: 'Moderate', score: 61, rain: 2, wind: 14, exposure: 'Dense urban areas', summary: 'This sample heat scenario represents prolonged high temperatures in dense urban districts. The regional score is illustrative and is not a current weather assessment.', trend: [33, 38, 36, 41, 45, 43, 52, 49, 56, 58, 61] },
  { id: 'kutch', name: 'Bhuj', state: 'Gujarat', lat: 23.2419, lng: 69.6669, hazard: 'Earthquake', level: 'Moderate', score: 48, rain: 0, wind: 18, exposure: 'Built infrastructure', summary: 'This sample seismic exposure scenario illustrates infrastructure analysis around Kutch. The score is a demonstration value, not an earthquake prediction.', trend: [40, 43, 41, 42, 44, 43, 46, 45, 47, 46, 48] },
  { id: 'kerala', name: 'Kochi', state: 'Kerala', lat: 9.9312, lng: 76.2673, hazard: 'Flood', level: 'Moderate', score: 58, rain: 96, wind: 28, exposure: 'Low-lying coastal areas', summary: 'This sample monsoon scenario models rainfall accumulation along the Kerala coast. It demonstrates a regional view of low-lying catchments and coastal exposure.', trend: [20, 27, 24, 36, 31, 42, 38, 46, 50, 54, 58] },
  { id: 'uttarakhand', name: 'Dehradun', state: 'Uttarakhand', lat: 30.3165, lng: 78.0322, hazard: 'Landslide', level: 'High', score: 76, rain: 118, wind: 21, exposure: 'Hill transport corridors', summary: 'This sample hillside scenario combines sustained rainfall and terrain exposure. It demonstrates analysis of transport corridors and slope-adjacent communities.', trend: [24, 31, 28, 40, 38, 51, 48, 64, 61, 73, 76] },
];
