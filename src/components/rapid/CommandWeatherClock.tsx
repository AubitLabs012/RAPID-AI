import { Clock3, Droplets, Eye, Gauge, Leaf, MapPin, MoonStar, RefreshCw, Settings, Sunrise, Sunset, Wind } from 'lucide-react';
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
  onSettings?: () => void;
};

function clockParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).formatToParts(now);
  const part = (name: string) => parts.find(item => item.type === name)?.value ?? '';
  return { time: `${part('hour')}:${part('minute')}`, period: part('dayPeriod') };
}

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(now));
  if (hour < 5) return 'Good Night';
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  if (hour < 21) return 'Good Evening';
  return 'Good Night';
}

function seasonDescription(season: string) {
  if (season === 'AUTUMN') return 'Clear skies, cooler evenings, and the turn after monsoon.';
  if (season === 'MONSOON') return 'Seasonal rain, fresh air, and changing river conditions.';
  if (season === 'WINTER') return 'Cool mornings, clear skies, and shorter daylight.';
  return 'Warmer days, fresh blooms, and longer daylight.';
}

function shortTime(value?: string) {
  if (!value) return '—';
  const datePart = value.split('T')[0];
  const time = value.split('T')[1]?.slice(0, 5);
  if (!time) return '—';
  const date = new Date(`${datePart}T${time}:00+05:30`);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
}

function dayLength(seconds: number) {
  if (!seconds) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function isDayHour(time: string) {
  const hour = Number(time.split('T')[1]?.slice(0, 2) ?? 12);
  return hour >= 6 && hour < 18;
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

export function CommandWeatherClock({ now, region, season, weather, loading, error, onRefresh, onSettings }: Props) {
  const { time, period } = clockParts(now);
  const date = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const WeatherIcon = iconFor(weather?.code ?? 2, weather?.isDay ?? true);
  const today = weather?.days[0];
  const visibility = weather?.visibility == null ? '—' : `${Math.round(weather.visibility / 1000)} km`;
  const observedTime = weather?.observedAt.split('T')[1]?.slice(0, 5);
  return <section className={`rapid-live-clock ${weather?.isDay ? 'is-day' : 'is-night'}`} aria-label={`Live clock, weather and season for ${region.name}`}>
    <div className="rapid-live-clock-scene">
      <div className="rapid-live-clock-head">
        <span><MapPin size={19} aria-hidden="true" /><span>{region.name}, India</span></span>
        <div><button type="button" onClick={onSettings} aria-label="Open settings" title="Settings"><Settings size={17} /></button><button type="button" onClick={onRefresh} aria-label="Refresh live weather" title="Refresh live weather"><RefreshCw size={17} /></button></div>
      </div>
      <span className="rapid-live-clock-kicker"><i /> LIVE CLOCK · INDIA STANDARD TIME</span>
      <div className="rapid-live-clock-time"><strong>{time}</strong><span>{period}</span></div>
      <time className="rapid-live-clock-date">{date}</time>
      <div className="rapid-live-clock-greeting"><MoonStar size={20} aria-hidden="true" /><span><strong>{greeting(now)}</strong><small>A new day, new progress.</small></span></div>
    </div>

    <section className="rapid-live-clock-weather" aria-label="Current weather">
      <div className="rapid-weather-sun" aria-hidden="true" />
      <div className="rapid-live-clock-current"><WeatherIcon size={51} strokeWidth={1.5} aria-hidden="true" /><div><strong>{weather ? Math.round(weather.temperature) : '—'}<small>°</small></strong><span>{weather ? describeWeather(weather.code) : loading ? 'Loading live weather…' : error ? 'Weather unavailable' : 'Weather unavailable'}</span></div></div>
      <p>{weather ? `Feels like ${Math.round(weather.feelsLike)}° · updated ${observedTime ?? '—'} IST` : 'Live weather for the selected region.'}</p>
      <div className="rapid-live-clock-metrics">
        <span><Droplets size={17} /><small>Humidity</small><strong>{weather ? `${weather.humidity}%` : '—'}</strong></span>
        <span><Wind size={17} /><small>Wind</small><strong>{weather ? `${Math.round(weather.windSpeed)} km/h` : '—'}</strong></span>
        <span><Gauge size={17} /><small>Pressure</small><strong>{weather?.pressure == null ? '—' : `${Math.round(weather.pressure)} hPa`}</strong></span>
        <span><Eye size={17} /><small>Visibility</small><strong>{visibility}</strong></span>
      </div>
    </section>

    <section className="rapid-live-clock-season" aria-label={`Season: ${season}`}>
      <Leaf size={43} aria-hidden="true" /><div><small>SEASON</small><strong>{season[0] + season.slice(1).toLowerCase()}</strong><p>{seasonDescription(season)}</p></div>
    </section>

    <section className="rapid-live-clock-forecast" aria-label="Hourly weather forecast">
      <h3>HOURLY FORECAST <span>LOCAL TIME</span></h3>
      {weather?.hours.length ? <div className="rapid-live-clock-hours">{weather.hours.slice(0, 7).map((hour, index) => {
        const HourIcon = iconFor(hour.code, isDayHour(hour.time));
        return <div key={hour.time}><span>{index === 0 ? 'Now' : hour.label}</span><HourIcon size={22} aria-hidden="true" /><strong>{Math.round(hour.temperature)}°</strong><small>{hour.rainChance == null ? '—' : `${hour.rainChance}%`}</small></div>;
      })}</div> : <p>{loading ? 'Loading hourly forecast…' : 'Hourly forecast unavailable'}</p>}
    </section>

    <section className="rapid-live-clock-daylight" aria-label="Sunrise, sunset and daylight">
      <div><Sunrise size={26} aria-hidden="true" /><span>Sunrise<strong>{shortTime(today?.sunrise)}</strong></span></div>
      <div><Sunset size={26} aria-hidden="true" /><span>Sunset<strong>{shortTime(today?.sunset)}</strong></span></div>
      <div><Clock3 size={27} aria-hidden="true" /><span>Day length<strong>{today ? dayLength(today.daylightSeconds) : '—'}</strong></span></div>
    </section>
    <footer>WEATHER: OPEN-METEO · LOCATION: {region.name.toUpperCase()}, {region.state.toUpperCase()}</footer>
  </section>;
}
