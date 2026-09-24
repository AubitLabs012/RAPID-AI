import { AlertTriangle, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Droplets, Moon, RefreshCw, Sun, Thermometer, Wind, type LucideIcon } from 'lucide-react';
import { describeWeather, isSevereWeather, useLiveWeather } from '../../services/weather';
import type { Region } from './regions';
import './rapid-weather.css';

function iconFor(code: number, isDay = true): LucideIcon {
  if (code === 0 || code === 1) return isDay ? Sun : Moon;
  if (code === 2) return isDay ? CloudSun : CloudMoon;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

const round = (n: number) => Math.round(n);

function formatTime(localIso: string) {
  // Open-Meteo returns local IST time without an offset, e.g. "2026-09-25T14:15".
  return localIso.slice(11, 16);
}

function dayLabel(date: string, index: number) {
  if (index === 0) return 'Today';
  return new Date(`${date}T12:00:00+05:30`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Asia/Kolkata' });
}

// One-line live reading for the Regional Analysis card.
export function LiveWeatherLine({ region }: { region: Region }) {
  const { data, isPending, isError } = useLiveWeather(region.lat, region.lng);
  if (isPending) return <div className="rapid-weather-line"><b>LIVE</b><span>Loading weather…</span></div>;
  if (isError || !data) return <div className="rapid-weather-line muted"><b>LIVE</b><span>Weather unavailable</span></div>;
  const Icon = iconFor(data.code, data.isDay);
  return <div className="rapid-weather-line" title={`Live weather in ${region.name} at ${formatTime(data.observedAt)} IST · Open-Meteo`}>
    <b>LIVE</b>
    <Icon size={14} aria-hidden="true" />
    <strong>{round(data.temperature)}°C</strong>
    <span>{describeWeather(data.code)}</span>
    <span className="rapid-weather-wind"><Wind size={12} aria-hidden="true" /> {round(data.windSpeed)} km/h</span>
  </div>;
}

// Full live weather block for the area analysis drawer.
export function LiveWeatherSection({ region }: { region: Region }) {
  const { data, isPending, isError, refetch, isFetching } = useLiveWeather(region.lat, region.lng);

  return <section className="rapid-weather" aria-labelledby="rapid-weather-title">
    <h3 id="rapid-weather-title">LIVE WEATHER <span>OPEN-METEO</span></h3>
    {isPending && <p className="rapid-weather-status">Loading live weather for {region.name}…</p>}
    {isError && <p className="rapid-weather-status">
      Live weather is unavailable right now. Check the connection and try again.
      <button type="button" onClick={() => refetch()} className="rapid-weather-retry"><RefreshCw size={12} /> Retry</button>
    </p>}
    {data && (() => {
      const Icon = iconFor(data.code, data.isDay);
      return <>
        <div className="rapid-weather-now">
          <Icon size={34} aria-hidden="true" />
          <div>
            <strong>{round(data.temperature)}<small>°C</small></strong>
            <span>{describeWeather(data.code)} · feels like {round(data.feelsLike)}°C</span>
          </div>
        </div>
        {isSevereWeather(data.code) && <p className="rapid-weather-alert"><AlertTriangle size={14} aria-hidden="true" /> {describeWeather(data.code)} reported now. Check official IMD warnings.</p>}
        <div className="rapid-detail-metrics">
          <div><Wind size={18} /><strong>{round(data.windSpeed)}<small>km/h</small></strong><span>Wind · gusts {round(data.windGusts)}</span></div>
          <div><Droplets size={18} /><strong>{data.precipitation}<small>mm</small></strong><span>Rain, last 15 min</span></div>
          <div><Thermometer size={18} /><strong>{data.humidity}<small>%</small></strong><span>Humidity</span></div>
        </div>
        <ul className="rapid-weather-days" aria-label="3-day forecast">
          {data.days.map((day, i) => {
            const DayIcon = iconFor(day.code);
            return <li key={day.date}>
              <span className="rapid-weather-day">{dayLabel(day.date, i)}</span>
              <DayIcon size={15} aria-hidden="true" />
              <span className="rapid-weather-desc">{describeWeather(day.code)}</span>
              <span>{round(day.tempMin)}–{round(day.tempMax)}°C</span>
              <span>{day.rainSum.toFixed(1)} mm{day.rainChance != null ? ` · ${day.rainChance}%` : ''}</span>
            </li>;
          })}
        </ul>
        <p className="rapid-weather-source">
          Observed {formatTime(data.observedAt)} IST near {region.lat.toFixed(2)}° N, {region.lng.toFixed(2)}° E · Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a>
          {isFetching && ' · updating…'}
        </p>
      </>;
    })()}
  </section>;
}
