from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
import json
from typing import Any
from urllib import parse, request


REGIONS = [
    {"id": "arabian-sea", "name": "Arabian Sea", "lat": 16.5, "lng": 67.5},
    {"id": "bay-of-bengal", "name": "Bay of Bengal", "lat": 15.0, "lng": 88.5},
    {"id": "lakshadweep", "name": "Lakshadweep", "lat": 10.6, "lng": 72.6},
]


class LiveOceanService:
    _cache: tuple[datetime, list[dict[str, Any]]] | None = None

    def regions(self) -> list[dict[str, Any]]:
        cache = type(self)._cache
        if cache and datetime.utcnow() - cache[0] < timedelta(minutes=10):
            return cache[1]

        with ThreadPoolExecutor(max_workers=3) as executor:
            regions = list(executor.map(self._safe_region_snapshot, REGIONS))
        type(self)._cache = (datetime.utcnow(), regions)
        return regions

    def _safe_region_snapshot(self, region: dict[str, Any]) -> dict[str, Any]:
        try:
            return self._region_snapshot(region)
        except Exception:
            return self._fallback_region(region)

    def _region_snapshot(self, region: dict[str, Any]) -> dict[str, Any]:
        marine = self._fetch_json(
            "https://marine-api.open-meteo.com/v1/marine",
            {
                "latitude": region["lat"],
                "longitude": region["lng"],
                "hourly": ",".join(
                    [
                        "wave_height",
                        "wave_period",
                        "wave_direction",
                        "sea_surface_temperature",
                        "ocean_current_velocity",
                        "ocean_current_direction",
                    ]
                ),
                "forecast_days": 1,
                "timezone": "auto",
            },
        )
        weather = self._fetch_json(
            "https://api.open-meteo.com/v1/forecast",
            {
                "latitude": region["lat"],
                "longitude": region["lng"],
                "current": "temperature_2m,wind_speed_10m,wind_direction_10m,weather_code",
                "timezone": "auto",
            },
        )

        marine_now = self._latest_hour(marine.get("hourly", {}))
        weather_now = weather.get("current", {})
        wave_height = self._number(marine_now.get("wave_height"))
        wind_speed = self._number(weather_now.get("wind_speed_10m"))
        sea_temp = self._number(marine_now.get("sea_surface_temperature"))
        current_velocity = self._number(marine_now.get("ocean_current_velocity"))

        risk = self._risk_level(wave_height, wind_speed, sea_temp)
        return {
            **region,
            "observed_at": marine_now.get("time") or weather_now.get("time") or datetime.utcnow().isoformat(),
            "source": "Open-Meteo marine + weather",
            "risk": risk,
            "summary": self._summary(region["name"], wave_height, wind_speed, sea_temp, current_velocity, risk),
            "metrics": {
                "air_temperature_c": self._number(weather_now.get("temperature_2m")),
                "wind_speed_kmh": wind_speed,
                "wind_direction_deg": self._number(weather_now.get("wind_direction_10m")),
                "weather_code": weather_now.get("weather_code"),
                "wave_height_m": wave_height,
                "wave_period_s": self._number(marine_now.get("wave_period")),
                "wave_direction_deg": self._number(marine_now.get("wave_direction")),
                "sea_surface_temperature_c": sea_temp,
                "ocean_current_velocity_kmh": current_velocity,
                "ocean_current_direction_deg": self._number(marine_now.get("ocean_current_direction")),
            },
        }

    def _fetch_json(self, endpoint: str, params: dict[str, Any]) -> dict[str, Any]:
        url = f"{endpoint}?{parse.urlencode(params)}"
        req = request.Request(url, headers={"User-Agent": "RAPID-AI/1.0"})
        with request.urlopen(req, timeout=8) as response:
            return json.loads(response.read().decode("utf-8"))

    def _fallback_region(self, region: dict[str, Any]) -> dict[str, Any]:
        return {
            **region,
            "observed_at": datetime.utcnow().isoformat(),
            "source": "Open-Meteo fallback",
            "risk": "Moderate",
            "summary": f"{region['name']} live feed is temporarily delayed. Showing regional fallback until the next refresh.",
            "metrics": {
                "air_temperature_c": None,
                "wind_speed_kmh": None,
                "wind_direction_deg": None,
                "weather_code": None,
                "wave_height_m": None,
                "wave_period_s": None,
                "wave_direction_deg": None,
                "sea_surface_temperature_c": None,
                "ocean_current_velocity_kmh": None,
                "ocean_current_direction_deg": None,
            },
        }

    def _latest_hour(self, hourly: dict[str, list[Any]]) -> dict[str, Any]:
        times = hourly.get("time") or []
        if not times:
            return {}
        now = datetime.now().replace(minute=0, second=0, microsecond=0)
        index = 0
        for position, value in enumerate(times):
            try:
                if datetime.fromisoformat(value) <= now:
                    index = position
            except ValueError:
                index = position
        return {key: values[index] for key, values in hourly.items() if isinstance(values, list) and len(values) > index}

    def _risk_level(self, wave_height: float | None, wind_speed: float | None, sea_temp: float | None) -> str:
        if (wave_height is not None and wave_height >= 3.0) or (wind_speed is not None and wind_speed >= 40):
            return "High"
        if (wave_height is not None and wave_height >= 1.8) or (wind_speed is not None and wind_speed >= 25) or (sea_temp is not None and sea_temp >= 30):
            return "Moderate"
        return "Low"

    def _summary(
        self,
        name: str,
        wave_height: float | None,
        wind_speed: float | None,
        sea_temp: float | None,
        current_velocity: float | None,
        risk: str,
    ) -> str:
        return (
            f"{name} live ocean update: {risk.lower()} operational risk. "
            f"Waves {self._display(wave_height, 'm')}, wind {self._display(wind_speed, 'km/h')}, "
            f"SST {self._display(sea_temp, 'C')}, current {self._display(current_velocity, 'km/h')}."
        )

    def _number(self, value: Any) -> float | None:
        if value is None:
            return None
        try:
            return round(float(value), 2)
        except (TypeError, ValueError):
            return None

    def _display(self, value: float | None, unit: str) -> str:
        return f"{value} {unit}" if value is not None else "unavailable"
