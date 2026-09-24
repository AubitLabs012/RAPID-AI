import type { HistoricalEvent } from './historyEvents';

export type HistoryLocation = { lat: number; lng: number; approximate: boolean };
type Place = [RegExp, number, number, boolean?];

// Reports often identify a state or coastline rather than an epicentre or landfall.
// In those cases the marker is a representative point, never a claimed exact site.
const places: Place[] = [
  [/Barren Island/i, 12.28, 93.86], [/Narcondam/i, 13.45, 94.27], [/Baratang/i, 12.19, 92.83],
  [/Sumatra|Indian Ocean tsunami/i, 9.35, 92.76, true],
  [/Mayurbhanj/i, 21.93, 86.73], [/Wayanad/i, 11.69, 76.13], [/Jalpaiguri/i, 26.54, 88.72],
  [/Lhonak/i, 27.92, 88.13], [/Joshimath/i, 30.56, 79.56], [/Chamoli/i, 30.40, 79.32],
  [/Chiplun|Konkan and Western Ghats/i, 17.53, 73.52, true], [/Hyderabad/i, 17.39, 78.49],
  [/Kedarnath/i, 30.73, 79.07], [/Sikkim earthquake/i, 27.53, 88.51, true],
  [/Kosi|Bihar.Nepal/i, 26.15, 87.36, true], [/Devpuri/i, 30.37, 79.21],
  [/Muzaffarabad/i, 34.37, 73.47], [/Varunavat|Uttarkashi/i, 30.73, 78.44],
  [/Budha Kedar|Balganga/i, 30.48, 78.67], [/Bhuj|Kutch|Kandla/i, 23.25, 69.66],
  [/Malpa/i, 30.14, 80.81], [/Jabalpur/i, 23.18, 79.95], [/Latur|Killari/i, 18.02, 76.60],
  [/Morbi/i, 22.82, 70.84], [/New Delhi/i, 28.61, 77.21], [/Divi Seema/i, 16.02, 81.03],
  [/Paradip/i, 20.32, 86.62], [/Lucknow/i, 26.85, 80.95], [/Bhola/i, 22.67, 90.65],
  [/Darjeeling/i, 27.04, 88.26], [/Koynanagar/i, 17.39, 73.75],
  [/Dhanushkodi|Rameswaram/i, 9.18, 79.42], [/Guwahati/i, 26.14, 91.74],
  [/Cachar|Kopili/i, 25.09, 92.52, true], [/Kangra/i, 32.10, 76.27],
  [/Coringa/i, 16.81, 82.23], [/Calcutta|Kolkata/i, 22.57, 88.36],
  [/Kathmandu/i, 27.72, 85.32], [/Bombay|Mumbai/i, 19.08, 72.88],
  [/Srinagar/i, 34.08, 74.84], [/Kumaon/i, 29.58, 79.53, true],
  [/Gorkha/i, 28.00, 84.63], [/Dolakha/i, 27.66, 86.05],
  [/Rohtang/i, 32.37, 77.25], [/Sonitpur/i, 26.71, 92.83],
  [/Jakhau/i, 23.23, 68.61], [/Puri/i, 19.81, 85.83],
  [/Nagapattinam/i, 10.77, 79.84], [/Alibag/i, 18.64, 72.87],
  [/Visakhapatnam/i, 17.69, 83.22], [/Gopalpur/i, 19.26, 84.91],
  [/Kakinada/i, 16.99, 82.25], [/Machilipatnam/i, 16.19, 81.14],
  [/Berhampore/i, 24.10, 88.25], [/Belda/i, 22.07, 87.30],
  [/Jalpaiguri/i, 26.54, 88.72], [/Mishmi Hills/i, 28.21, 95.95, true],
  [/Shillong/i, 25.57, 91.88], [/Garhwal/i, 30.73, 78.44, true],
  [/Fengal/i, 11.93, 79.83], [/Dana/i, 20.60, 86.80, true],
  [/Remal/i, 22.32, 89.13, true], [/Michaung/i, 13.08, 80.27, true],
  [/Mocha/i, 20.15, 92.88, true], [/Sitrang|Mandous|Asani/i, 15.40, 83.22, true],
  [/Yaas/i, 21.67, 87.43, true], [/Tauktae/i, 20.93, 70.93, true],
  [/Nivar|Burevi/i, 11.70, 79.80, true], [/Amphan/i, 21.99, 88.36, true],
  [/Bulbul/i, 21.80, 88.75, true], [/Vayu/i, 21.52, 70.45, true],
  [/Fani/i, 19.81, 85.83], [/Titli/i, 18.90, 84.61, true],
  [/Ockhi/i, 8.98, 76.67, true], [/Hudhud/i, 17.69, 83.22],
  [/Phailin/i, 19.26, 84.91], [/Nisarga/i, 18.64, 72.87],
  [/Montha/i, 16.50, 82.00, true],
  [/Chennai|Madras/i, 13.08, 80.27], [/Gomti/i, 26.85, 80.95],
  [/Himachal Pradesh/i, 31.10, 77.17, true], [/Uttarakhand/i, 30.30, 78.35, true],
  [/Jammu and Kashmir|Kashmir/i, 34.08, 74.84, true],
  [/Tamil Nadu and Puducherry/i, 11.92, 79.83, true],
  [/Odisha and West Bengal/i, 21.65, 87.05, true],
  [/Odisha and Andhra Pradesh/i, 18.95, 84.70, true],
  [/West Bengal and Bangladesh/i, 22.40, 88.90, true],
  [/West Bengal|Sundarbans/i, 22.25, 88.50, true],
  [/Odisha/i, 20.70, 85.90, true],
  [/Andhra Pradesh/i, 16.99, 82.25, true], [/Gujarat/i, 22.65, 71.10, true],
  [/Kerala/i, 10.43, 76.50, true], [/Bihar/i, 25.60, 85.14, true],
  [/Assam/i, 26.20, 92.94, true], [/Manipur/i, 24.81, 93.94, true],
  [/Maharashtra/i, 19.75, 75.71, true], [/Nepal/i, 27.72, 85.32, true],
  [/Seven to eight states|Multi-state/i, 22.50, 79.00, true],
  [/South-east coast/i, 15.30, 82.50, true],
];

export function locateHistoryEvent(event: HistoricalEvent): HistoryLocation {
  const text = `${event.title} | ${event.location}`;
  for (const [pattern, lat, lng, approximate = false] of places) {
    if (pattern.test(text)) return { lat, lng, approximate };
  }
  return { lat: 22.60, lng: 79.00, approximate: true };
}
