import { useQuery } from "@tanstack/react-query";
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Moon, Sun, type LucideIcon } from "lucide-react";
import type { Severity } from "../lib/hazards";
import { settings } from "../lib/storage";

// Live weather from Open-Meteo (free, no API key): https://open-meteo.com
export type Weather = {
  timezone: string;
  current: {
    time: string; // local time of the reading
    temperature: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    windGusts: number;
    rain1h: number; // mm, rain over the last hour
    code: number;
    isDay: boolean;
  };
  hourly: { time: string; temperature: number; rainChance: number; rain: number; code: number; gusts: number }[]; // next 24 h
  daily: { date: string; code: number; tempMax: number; tempMin: number; rainSum: number; rainChance: number; gustMax: number }[]; // 7 days
};

type Raw = {
  timezone: string;
  current: Record<string, number | string>;
  hourly: Record<string, (number | string)[]>;
  daily: Record<string, (number | string)[]>;
};

export async function fetchWeather(lat: number, lon: number, signal?: AbortSignal): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,is_day",
    hourly: "temperature_2m,precipitation_probability,precipitation,weather_code,wind_gusts_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max",
    timezone: "auto",
    past_hours: "1",
    forecast_hours: "24",
    forecast_days: "7",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!res.ok) throw new Error(`Weather ${res.status}`);
  const d = (await res.json()) as Raw;
  const c = d.current;
  const h = d.hourly;
  const nowIndex = Math.max(0, (h.time as string[]).findIndex((t) => t >= String(c.time).slice(0, 13)));
  const hourly = (h.time as string[]).map((time, i) => ({
    time,
    temperature: Number(h.temperature_2m[i]),
    rainChance: Number(h.precipitation_probability[i] ?? 0),
    rain: Number(h.precipitation[i] ?? 0),
    code: Number(h.weather_code[i]),
    gusts: Number(h.wind_gusts_10m[i]),
  }));
  return {
    timezone: d.timezone,
    current: {
      time: String(c.time),
      temperature: Number(c.temperature_2m),
      feelsLike: Number(c.apparent_temperature),
      humidity: Number(c.relative_humidity_2m),
      windSpeed: Number(c.wind_speed_10m),
      windGusts: Number(c.wind_gusts_10m),
      // Open-Meteo's hourly precipitation is the total for the preceding hour,
      // so the value at the current hour is "rain in the last hour".
      rain1h: hourly[nowIndex]?.rain ?? 0,
      code: Number(c.weather_code),
      isDay: Number(c.is_day) === 1,
    },
    hourly: hourly.slice(nowIndex, nowIndex + 24),
    daily: (d.daily.time as string[]).map((date, i) => ({
      date,
      code: Number(d.daily.weather_code[i]),
      tempMax: Number(d.daily.temperature_2m_max[i]),
      tempMin: Number(d.daily.temperature_2m_min[i]),
      rainSum: Number(d.daily.precipitation_sum[i] ?? 0),
      rainChance: Number(d.daily.precipitation_probability_max[i] ?? 0),
      gustMax: Number(d.daily.wind_gusts_10m_max[i]),
    })),
  };
}

export function useWeather(lat: number | undefined, lon: number | undefined) {
  const refreshMinutes = settings.use().refreshMinutes;
  return useQuery({
    queryKey: ["weather", lat?.toFixed(3), lon?.toFixed(3)],
    queryFn: ({ signal }) => fetchWeather(lat!, lon!, signal),
    enabled: lat != null && lon != null,
    staleTime: refreshMinutes * 60_000,
    refetchInterval: refreshMinutes * 60_000,
  });
}

// WMO weather codes -> words. https://open-meteo.com/en/docs
const WMO: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Light showers", 81: "Showers", 82: "Violent showers", 85: "Snow showers", 86: "Snow showers",
  95: "Thunderstorm", 96: "Thunderstorm, hail", 99: "Thunderstorm, hail",
};
export const describeWeather = (code: number) => WMO[code] ?? "Unknown";

export function weatherIcon(code: number, isDay = true): LucideIcon {
  if (code <= 1) return isDay ? Sun : Moon;
  if (code === 2) return isDay ? CloudSun : CloudMoon;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return CloudRain;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return Cloud;
}

export type WeatherAlert = { id: string; title: string; detail: string; severity: Severity; status: string; kind: "rain" | "storm" | "wind" | "heat" };

// Rule-based alerts from the forecast. Thresholds follow IMD's daily rainfall categories
// (moderate 15.6–64.4 mm, heavy 64.5–115.5 mm, very heavy 115.6+ mm) and common wind/heat cut-offs.
// These are NOT official warnings; the UI says so.
export function weatherAlerts(w: Weather): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const rain24 = w.hourly.reduce((sum, h) => sum + h.rain, 0);
  const maxGust = Math.max(w.current.windGusts, ...w.hourly.map((h) => h.gusts));
  const maxTemp = Math.max(w.current.temperature, ...w.hourly.map((h) => h.temperature));
  const thunder = w.current.code >= 95 || w.hourly.some((h) => h.code >= 95);

  if (rain24 >= 115.6) alerts.push({ id: "rain", kind: "rain", title: "Very Heavy Rain Alert", detail: `${rain24.toFixed(0)} mm expected in 24 h`, severity: "High", status: "Active" });
  else if (rain24 >= 64.5) alerts.push({ id: "rain", kind: "rain", title: "Heavy Rain Alert", detail: `${rain24.toFixed(0)} mm expected in 24 h`, severity: "High", status: "Active" });
  else if (rain24 >= 15.6) alerts.push({ id: "rain", kind: "rain", title: "Rain Watch", detail: `${rain24.toFixed(0)} mm expected in 24 h`, severity: "Moderate", status: "Moderate" });

  if (thunder) alerts.push({ id: "storm", kind: "storm", title: "Thunderstorm Watch", detail: "Thunderstorms in the next 24 h", severity: "Moderate", status: "Moderate" });

  // 62 km/h is the Beaufort "gale" threshold; 40 km/h makes loose objects move.
  if (maxGust >= 62) alerts.push({ id: "wind", kind: "wind", title: "Strong Wind Alert", detail: `Gusts up to ${Math.round(maxGust)} km/h`, severity: "High", status: "Active" });
  else if (maxGust >= 40) alerts.push({ id: "wind", kind: "wind", title: "Wind Watch", detail: `Gusts up to ${Math.round(maxGust)} km/h`, severity: "Moderate", status: "Moderate" });

  // IMD declares a heatwave from 40 °C in the plains; 45 °C is a severe heatwave.
  if (maxTemp >= 45) alerts.push({ id: "heat", kind: "heat", title: "Severe Heat Alert", detail: `Up to ${Math.round(maxTemp)}°C`, severity: "High", status: "Active" });
  else if (maxTemp >= 40) alerts.push({ id: "heat", kind: "heat", title: "Heat Watch", detail: `Up to ${Math.round(maxTemp)}°C`, severity: "Moderate", status: "Moderate" });

  return alerts;
}

// One overall label for the weather card, the highest of the alerts above.
export function weatherRisk(w: Weather): Severity {
  const alerts = weatherAlerts(w);
  if (alerts.some((a) => a.severity === "High")) return "High";
  if (alerts.length) return "Moderate";
  return "Low";
}
