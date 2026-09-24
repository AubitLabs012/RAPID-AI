import { Clock3, Droplets, Leaf, MapPin, RefreshCw, Wind } from 'lucide-react';
import { describeWeather, type LiveWeather } from '../../services/weather';
import type { Region } from './regions';
import { iconFor } from './LiveWeather';

type Props = {
  now: Date;
  region: Region;
  season: string;
  weather?: LiveWeather;
  loading: boolean;
  error: boolean;
  onRefresh: () => void;
};

function clockParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).formatToParts(now);
  const part = (name: string) => parts.find(item => item.type === name)?.value ?? '';
  return { time: `${part('hour')}:${part('minute')}`, period: part('dayPeriod') };
}

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(now));
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

export function CompactLiveStatus({ now, region, season, weather, loading, error }: Props) {
  const { time, period } = clockParts(now);
  const WeatherIcon = iconFor(weather?.code ?? 2, weather?.isDay ?? true);
  return <div className="rapid-live-compact" aria-label={`Live India time, weather in ${region.name}, and season`} title={`Weather in ${region.name}, India`}>
    <span><Clock3 size={12} aria-hidden="true" /><strong>{time} {period}</strong><small>IST</small></span>
    <span><WeatherIcon size={12} aria-hidden="true" /><strong>{weather ? `${Math.round(weather.temperature)}°C` : '—'}</strong><small>{weather ? describeWeather(weather.code) : loading ? 'Loading weather' : error ? 'Weather unavailable' : 'Weather'}</small></span>
    <span><Leaf size={12} aria-hidden="true" /><strong>{season}</strong></span>
  </div>;
}

export function CommandWeatherClock({ now, region, season, weather, loading, error, onRefresh }: Props) {
  const { time, period } = clockParts(now);
  const date = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const WeatherIcon = iconFor(weather?.code ?? 2, weather?.isDay ?? true);
  return <section className={`rapid-live-clock ${weather?.isDay ? 'is-day' : 'is-night'}`} aria-label={`Live time, weather and season for ${region.name}`}>
    <div className="rapid-live-clock-sky">
      <div className="rapid-live-clock-head"><span><MapPin size={15} aria-hidden="true" /> {region.name}, India</span><button type="button" onClick={onRefresh} aria-label="Refresh live weather" title="Refresh live weather"><RefreshCw size={16} /></button></div>
      <span className="rapid-live-clock-kicker"><i /> LIVE CLOCK · INDIA STANDARD TIME</span>
      <div className="rapid-live-clock-time"><strong>{time}</strong><span>{period}</span></div>
      <time className="rapid-live-clock-date">{date}</time>
      <div className="rapid-live-clock-greeting"><Clock3 size={15} aria-hidden="true" /><span>{greeting(now)}</span></div>
    </div>
    <div className="rapid-live-clock-weather">
      <div className="rapid-live-clock-current"><WeatherIcon size={41} strokeWidth={1.5} aria-hidden="true" /><div><strong>{weather ? Math.round(weather.temperature) : '—'}<small>°C</small></strong><span>{weather ? describeWeather(weather.code) : loading ? 'Loading live weather…' : error ? 'Weather unavailable' : 'Weather unavailable'}</span></div></div>
      <p>{weather ? `Feels like ${Math.round(weather.feelsLike)}°C · observed ${weather.observedAt.slice(11, 16)} IST` : 'Live weather from Open-Meteo for the selected region.'}</p>
      <div className="rapid-live-clock-metrics"><span><Droplets size={15} /> HUMIDITY <strong>{weather ? `${weather.humidity}%` : '—'}</strong></span><span><Wind size={15} /> WIND <strong>{weather ? `${Math.round(weather.windSpeed)} km/h` : '—'}</strong></span></div>
    </div>
    <div className="rapid-live-clock-season"><Leaf size={23} aria-hidden="true" /><div><small>SEASON IN INDIA</small><strong>{season}</strong></div></div>
    <div className="rapid-live-clock-forecast"><h3>NEXT DAYS <span>LOCAL FORECAST</span></h3>{weather?.days.length ? weather.days.map((day, index) => {
      const DayIcon = iconFor(day.code);
      return <div key={day.date}><span>{index === 0 ? 'Today' : new Date(`${day.date}T12:00:00+05:30`).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short' })}</span><DayIcon size={15} aria-hidden="true" /><span>{describeWeather(day.code)}</span><strong>{Math.round(day.tempMin)}–{Math.round(day.tempMax)}°</strong></div>;
    }) : <p>{loading ? 'Loading forecast…' : 'Forecast unavailable'}</p>}</div>
    <footer>WEATHER: OPEN-METEO · LOCATION: {region.name.toUpperCase()}</footer>
  </section>;
}
