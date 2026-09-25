import { useQuery } from '@tanstack/react-query';
import { useDashboardStore } from '../store';

// Live weather from Open-Meteo (https://open-meteo.com): free, no API key, and CORS-enabled,
// so it works from the static GitHub Pages build. These are real observations/forecasts,
// unlike the illustrative scenario values in regions.ts.
const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

export type WeatherDay = {
  date: string; // YYYY-MM-DD, local (IST)
  code: number;
  tempMax: number;
  tempMin: number;
  rainSum: number; // mm
  rainChance: number | null; // %
  windMax: number; // km/h
  sunrise: string;
  sunset: string;
  daylightSeconds: number;
};

export type HourlyWeather = { time: string; label: string; code: number; temperature: number; rainChance: number | null; windSpeed: number };

export type LiveWeather = {
  observedAt: string; // local ISO time of the current reading
  temperature: number; // °C
  feelsLike: number; // °C
  humidity: number; // %
  precipitation: number; // mm in the last interval
  windSpeed: number; // km/h
  windGusts: number; // km/h
  pressure: number | null; // hPa
  visibility: number | null; // meters
  code: number; // WMO weather code
  isDay: boolean;
  days: WeatherDay[]; // today + next days
  hours: HourlyWeather[];
};

type OpenMeteoResponse = {
  current: {
    time: string; temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number;
    precipitation: number; weather_code: number; wind_speed_10m: number; wind_gusts_10m: number; is_day: number;
    pressure_msl?: number; visibility?: number;
  };
  daily: {
    time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[];
    precipitation_sum: number[]; precipitation_probability_max: (number | null)[]; wind_speed_10m_max: number[];
    sunrise: string[]; sunset: string[]; daylight_duration: number[];
  };
  hourly: { time: string[]; temperature_2m: number[]; precipitation_probability: (number | null)[]; weather_code: number[]; wind_speed_10m: number[] };
};

export async function fetchLiveWeather(lat: number, lng: number, signal?: AbortSignal): Promise<LiveWeather> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lng.toFixed(3),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day,pressure_msl,visibility',
    hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,daylight_duration',
    timezone: 'Asia/Kolkata',
    past_days: '0',
    forecast_days: '4',
  });
  const response = await fetch(`${ENDPOINT}?${params}`, { signal });
  if (!response.ok) throw new Error(`Weather service responded ${response.status}`);
  const data = (await response.json()) as OpenMeteoResponse;
  const c = data.current;
  const d = data.daily;
  // Around midnight the daily series can still start on the previous date; keep today onwards.
  const today = c.time.slice(0, 10);
  const days = d.time
    .map((date, i) => ({
      date,
      code: d.weather_code[i],
      tempMax: d.temperature_2m_max[i],
      tempMin: d.temperature_2m_min[i],
      rainSum: d.precipitation_sum[i],
      rainChance: d.precipitation_probability_max[i],
      windMax: d.wind_speed_10m_max[i],
      sunrise: d.sunrise?.[i] ?? '',
      sunset: d.sunset?.[i] ?? '',
      daylightSeconds: d.daylight_duration?.[i] ?? 0,
    }))
    .filter(day => day.date >= today)
    .slice(0, 3);
  const h = data.hourly;
  const firstHour = h.time.findIndex(time => time >= c.time.slice(0, 13));
  const hours = firstHour < 0 ? [] : [0, 3, 6, 9, 12, 15, 18].map(offset => firstHour + offset).filter(index => index < h.time.length).map((index, slot) => {
    const time = h.time[index];
    const [localDate, localHour] = time.split('T');
    const hour = Number(localHour?.slice(0, 2) ?? 0);
    const parsedTime = new Date(`${localDate}T${String(hour).padStart(2, '0')}:00:00+05:30`);
    const label = slot === 0 ? 'Now' : new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: true }).format(parsedTime);
    return { time, label, code: h.weather_code[index], temperature: h.temperature_2m[index], rainChance: h.precipitation_probability[index], windSpeed: h.wind_speed_10m[index] };
  });
  return {
    observedAt: c.time,
    temperature: c.temperature_2m,
    feelsLike: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    precipitation: c.precipitation,
    windSpeed: c.wind_speed_10m,
    windGusts: c.wind_gusts_10m,
    pressure: c.pressure_msl ?? null,
    visibility: c.visibility ?? null,
    code: c.weather_code,
    isDay: c.is_day === 1,
    days,
    hours,
  };
}

// Current weather for a location, cached per location and refreshed on the
// "data refresh" interval from settings (default 10 minutes).
export function useLiveWeather(lat: number, lng: number) {
  const refreshMinutes = useDashboardStore(s => s.dataRefreshMinutes);
  return useQuery({
    queryKey: ['live-weather', lat.toFixed(3), lng.toFixed(3)],
    queryFn: ({ signal }) => fetchLiveWeather(lat, lng, signal),
    staleTime: refreshMinutes * 60_000,
    refetchInterval: refreshMinutes * 60_000,
    retry: 1,
  });
}

// WMO weather interpretation codes -> short description.
// https://open-meteo.com/en/docs (section "WMO Weather interpretation codes")
const WMO: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Light showers', 81: 'Showers', 82: 'Violent showers', 85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Thunderstorm, hail',
};

export function describeWeather(code: number) {
  return WMO[code] ?? 'Unknown';
}

// Codes that are worth drawing attention to on a disaster dashboard.
export function isSevereWeather(code: number) {
  return code === 65 || code === 82 || code >= 95;
}
