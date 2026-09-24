import type { CSSProperties } from 'react';
import atlas from '../../assets/history-hazard-atlas.png';
import landslide from '../../assets/history-landslide.png';

export const historyTypes = [
  { hazard: 'Cyclone', label: 'Cyclones', color: '#b5a5ff', position: '0%' },
  { hazard: 'Tsunami', label: 'Tsunamis', color: '#53baff', position: '25%' },
  { hazard: 'Flood', label: 'Floods', color: '#5ee4ff', position: '50%' },
  { hazard: 'Volcanic', label: 'Volcanic eruptions', color: '#ff694d', position: '75%' },
  { hazard: 'Earthquake', label: 'Earthquakes', color: '#ff996c', position: '100%' },
  { hazard: 'Landslide', label: 'Landslides', color: '#c99b64', position: 'center' },
] as const;

export type HistoryType = typeof historyTypes[number];

export function historyArtStyle(type: HistoryType): CSSProperties {
  return type.hazard === 'Landslide'
    ? { backgroundImage: `url(${landslide})`, backgroundPosition: 'center', backgroundSize: 'contain' }
    : { backgroundImage: `url(${atlas})`, backgroundPosition: `${type.position} center`, backgroundSize: '500% auto' };
}

export function historyArtMarkup(type: HistoryType) {
  const image = type.hazard === 'Landslide' ? landslide : atlas;
  const position = type.hazard === 'Landslide' ? 'center' : `${type.position} center`;
  const size = type.hazard === 'Landslide' ? 'contain' : '500% auto';
  return `<span class="rapid-history-map-art" style="background-image:url('${image}');background-position:${position};background-size:${size}"></span>`;
}
