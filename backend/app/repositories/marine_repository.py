from __future__ import annotations

import math
from copy import deepcopy
from datetime import datetime
from typing import Any

from app.db.postgres import PostgresClientManager
from app.transformations.normalize import MarineObservation


try:
    from psycopg.types.json import Jsonb
except ImportError:
    def Jsonb(value):
        return value


class MarineRepository:
    _ocean_conditions: list[dict[str, Any]] = []
    _species: dict[str, dict[str, Any]] = {}
    _fish_population: list[dict[str, Any]] = []
    _satellite_observations: list[dict[str, Any]] = []
    _predictions: list[dict[str, Any]] = []
    _alerts: list[dict[str, Any]] = []

    def __init__(self) -> None:
        self.postgres = PostgresClientManager()
        self.postgres.ensure_schema()

    async def save_observations(self, observations: list[MarineObservation]) -> dict[str, int]:
        with self.postgres.connection() as conn:
            if conn is not None:
                return self._save_observations_postgres(conn, observations)
        return self._save_observations_memory(observations)

    async def save_predictions(self, predictions: list[dict[str, Any]]) -> int:
        with self.postgres.connection() as conn:
            if conn is not None:
                with conn.cursor() as cursor:
                    cursor.executemany(
                        """
                        INSERT INTO predictions (
                            latitude, longitude, timestamp, prediction_type, value, confidence,
                            source_observation_id, model_version, metadata
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        [
                            (
                                item["latitude"],
                                item["longitude"],
                                item["timestamp"],
                                item["prediction_type"],
                                item["value"],
                                item["confidence"],
                                item.get("source_observation_id"),
                                item["model_version"],
                                Jsonb(item.get("metadata", {})),
                            )
                            for item in predictions
                        ],
                    )
                conn.commit()
                return len(predictions)

        self._predictions.extend(deepcopy(predictions))
        return len(predictions)

    async def save_alerts(self, alerts: list[dict[str, Any]]) -> int:
        with self.postgres.connection() as conn:
            if conn is not None:
                with conn.cursor() as cursor:
                    cursor.executemany(
                        """
                        INSERT INTO alerts (
                            latitude, longitude, timestamp, severity, alert_type, message,
                            active, prediction_id, metadata
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        [
                            (
                                item["latitude"],
                                item["longitude"],
                                item["timestamp"],
                                item["severity"],
                                item["alert_type"],
                                item["message"],
                                item.get("active", True),
                                item.get("prediction_id"),
                                Jsonb(item.get("metadata", {})),
                            )
                            for item in alerts
                        ],
                    )
                conn.commit()
                return len(alerts)

        self._alerts.extend(deepcopy(alerts))
        return len(alerts)

    async def list_ocean_conditions(self, limit: int = 250) -> list[dict[str, Any]]:
        return await self._list_table(
            """
            SELECT latitude, longitude, timestamp, sea_surface_temperature, chlorophyll,
                   salinity, dissolved_oxygen, depth, source, features
            FROM ocean_conditions
            ORDER BY timestamp DESC
            LIMIT %s
            """,
            (limit,),
            self._ocean_conditions,
            limit,
        )

    async def list_species(self, limit: int = 250) -> list[dict[str, Any]]:
        with self.postgres.connection() as conn:
            if conn is not None:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT s.id, s.scientific_name, COUNT(fp.id) AS observations,
                               COALESCE(SUM(fp.fish_count), 0) AS fish_count
                        FROM species s
                        LEFT JOIN fish_population fp ON fp.species_id = s.id
                        GROUP BY s.id, s.scientific_name
                        ORDER BY observations DESC, s.scientific_name
                        LIMIT %s
                        """,
                        (limit,),
                    )
                    return [dict(row) for row in cursor.fetchall()]

        species = []
        for scientific_name, item in self._species.items():
            fish_count = sum(
                record.get("fish_count") or 0
                for record in self._fish_population
                if record.get("species_name") == scientific_name
            )
            observations = sum(1 for record in self._fish_population if record.get("species_name") == scientific_name)
            species.append({**item, "observations": observations, "fish_count": fish_count})
        return species[:limit]

    async def list_predictions(self, limit: int = 250) -> list[dict[str, Any]]:
        return await self._list_table(
            """
            SELECT latitude, longitude, timestamp, prediction_type, value, confidence, model_version, metadata
            FROM predictions
            ORDER BY timestamp DESC
            LIMIT %s
            """,
            (limit,),
            self._predictions,
            limit,
        )

    async def list_alerts(self, limit: int = 250, active_only: bool = True) -> list[dict[str, Any]]:
        with self.postgres.connection() as conn:
            if conn is not None:
                where_clause = "WHERE active = TRUE" if active_only else ""
                with conn.cursor() as cursor:
                    cursor.execute(
                        f"""
                        SELECT latitude, longitude, timestamp, severity, alert_type, message, active, metadata
                        FROM alerts
                        {where_clause}
                        ORDER BY timestamp DESC
                        LIMIT %s
                        """,
                        (limit,),
                    )
                    return [dict(row) for row in cursor.fetchall()]

        alerts = [alert for alert in self._alerts if alert.get("active", True) or not active_only]
        return deepcopy(alerts[-limit:])[::-1]

    async def get_location_context(self, latitude: float, longitude: float, radius_km: float = 50) -> dict[str, Any]:
        with self.postgres.connection() as conn:
            if conn is not None:
                return self._get_location_context_postgres(conn, latitude, longitude, radius_km)

        nearby_ocean = self._nearby(self._ocean_conditions, latitude, longitude, radius_km)
        nearby_predictions = self._nearby(self._predictions, latitude, longitude, radius_km)
        nearby_alerts = self._nearby(self._alerts, latitude, longitude, radius_km)
        nearby_fish = self._nearby(self._fish_population, latitude, longitude, radius_km)
        return {
            "ocean": nearby_ocean[0] if nearby_ocean else {},
            "predictions": nearby_predictions[:10],
            "alerts": nearby_alerts[:10],
            "fish_population": nearby_fish[:10],
        }

    def _save_observations_postgres(self, conn, observations: list[MarineObservation]) -> dict[str, int]:
        ocean_rows = []
        satellite_rows = []
        fish_rows = []

        with conn.cursor() as cursor:
            for observation in observations:
                if observation.species_name:
                    cursor.execute(
                        """
                        INSERT INTO species (scientific_name)
                        VALUES (%s)
                        ON CONFLICT (scientific_name) DO UPDATE SET updated_at = NOW()
                        RETURNING id
                        """,
                        (observation.species_name,),
                    )
                    species_id = cursor.fetchone()["id"]
                    fish_rows.append(
                        (
                            species_id,
                            observation.latitude,
                            observation.longitude,
                            observation.timestamp,
                            observation.fish_count,
                            observation.depth,
                            observation.source,
                            Jsonb(observation.raw),
                        )
                    )

                if any(
                    value is not None
                    for value in (
                        observation.sea_surface_temperature,
                        observation.chlorophyll,
                        observation.salinity,
                        observation.dissolved_oxygen,
                    )
                ):
                    ocean_rows.append(
                        (
                            observation.latitude,
                            observation.longitude,
                            observation.timestamp,
                            observation.sea_surface_temperature,
                            observation.chlorophyll,
                            observation.salinity,
                            observation.dissolved_oxygen,
                            observation.depth,
                            observation.source,
                            Jsonb(observation.features),
                            Jsonb(observation.raw),
                        )
                    )
                    satellite_rows.append(
                        (
                            observation.latitude,
                            observation.longitude,
                            observation.timestamp,
                            observation.source,
                            "marine_observation",
                            Jsonb(observation.raw),
                        )
                    )

            cursor.executemany(
                """
                INSERT INTO ocean_conditions (
                    latitude, longitude, timestamp, sea_surface_temperature, chlorophyll,
                    salinity, dissolved_oxygen, depth, source, features, raw
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                ocean_rows,
            )
            cursor.executemany(
                """
                INSERT INTO fish_population (
                    species_id, latitude, longitude, timestamp, fish_count, depth, source, raw
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                fish_rows,
            )
            cursor.executemany(
                """
                INSERT INTO satellite_observations (
                    latitude, longitude, timestamp, source, product, observation
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                satellite_rows,
            )
        conn.commit()
        return {
            "ocean_conditions": len(ocean_rows),
            "species_observations": len(fish_rows),
            "satellite_observations": len(satellite_rows),
        }

    def _save_observations_memory(self, observations: list[MarineObservation]) -> dict[str, int]:
        ocean_count = 0
        fish_count = 0
        satellite_count = 0

        for observation in observations:
            item = observation.model_dump()
            if observation.species_name:
                self._species.setdefault(
                    observation.species_name,
                    {"scientific_name": observation.species_name, "common_name": None, "taxon_group": None},
                )
                self._fish_population.append(item)
                fish_count += 1

            if any(
                value is not None
                for value in (
                    observation.sea_surface_temperature,
                    observation.chlorophyll,
                    observation.salinity,
                    observation.dissolved_oxygen,
                )
            ):
                self._ocean_conditions.append(item)
                self._satellite_observations.append(
                    {
                        "latitude": observation.latitude,
                        "longitude": observation.longitude,
                        "timestamp": observation.timestamp,
                        "source": observation.source,
                        "product": "marine_observation",
                        "observation": observation.raw,
                    }
                )
                ocean_count += 1
                satellite_count += 1

        return {
            "ocean_conditions": ocean_count,
            "species_observations": fish_count,
            "satellite_observations": satellite_count,
        }

    async def _list_table(self, query: str, params: tuple, fallback: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
        with self.postgres.connection() as conn:
            if conn is not None:
                with conn.cursor() as cursor:
                    cursor.execute(query, params)
                    return [dict(row) for row in cursor.fetchall()]
        return deepcopy(fallback[-limit:])[::-1]

    def _get_location_context_postgres(self, conn, latitude: float, longitude: float, radius_km: float) -> dict[str, Any]:
        meters = radius_km * 1000
        point = "ST_SetSRID(ST_MakePoint(%s, %s), 4326)"
        with conn.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT latitude, longitude, timestamp, sea_surface_temperature, chlorophyll,
                       salinity, dissolved_oxygen, depth, source, features
                FROM ocean_conditions
                WHERE ST_DWithin(
                    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
                    {point}::geography,
                    %s
                )
                ORDER BY timestamp DESC
                LIMIT 1
                """,
                (longitude, latitude, meters),
            )
            ocean = cursor.fetchone()
            cursor.execute(
                f"""
                SELECT latitude, longitude, timestamp, prediction_type, value, confidence, model_version, metadata
                FROM predictions
                WHERE ST_DWithin(
                    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
                    {point}::geography,
                    %s
                )
                ORDER BY timestamp DESC
                LIMIT 10
                """,
                (longitude, latitude, meters),
            )
            predictions = cursor.fetchall()
            cursor.execute(
                f"""
                SELECT latitude, longitude, timestamp, severity, alert_type, message, active, metadata
                FROM alerts
                WHERE active = TRUE
                  AND ST_DWithin(
                    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
                    {point}::geography,
                    %s
                  )
                ORDER BY timestamp DESC
                LIMIT 10
                """,
                (longitude, latitude, meters),
            )
            alerts = cursor.fetchall()
            cursor.execute(
                f"""
                SELECT fp.latitude, fp.longitude, fp.timestamp, fp.fish_count, fp.depth, fp.source,
                       s.scientific_name AS species_name
                FROM fish_population fp
                LEFT JOIN species s ON s.id = fp.species_id
                WHERE ST_DWithin(
                    ST_SetSRID(ST_MakePoint(fp.longitude, fp.latitude), 4326)::geography,
                    {point}::geography,
                    %s
                )
                ORDER BY fp.timestamp DESC
                LIMIT 10
                """,
                (longitude, latitude, meters),
            )
            fish_population = cursor.fetchall()

        return {
            "ocean": dict(ocean) if ocean is not None else {},
            "predictions": [dict(item) for item in predictions],
            "alerts": [dict(item) for item in alerts],
            "fish_population": [dict(item) for item in fish_population],
        }

    def _nearby(self, records: list[dict[str, Any]], latitude: float, longitude: float, radius_km: float) -> list[dict[str, Any]]:
        nearby = []
        for record in records:
            distance = self._distance_km(latitude, longitude, record["latitude"], record["longitude"])
            if distance <= radius_km:
                nearby.append({**deepcopy(record), "distance_km": round(distance, 2)})
        return sorted(nearby, key=lambda item: item.get("timestamp", datetime.min), reverse=True)

    def _distance_km(self, lat_a: float, lon_a: float, lat_b: float, lon_b: float) -> float:
        radius = 6371.0
        phi_a = math.radians(lat_a)
        phi_b = math.radians(lat_b)
        delta_phi = math.radians(lat_b - lat_a)
        delta_lambda = math.radians(lon_b - lon_a)
        haversine = math.sin(delta_phi / 2) ** 2 + math.cos(phi_a) * math.cos(phi_b) * math.sin(delta_lambda / 2) ** 2
        return radius * 2 * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine))
