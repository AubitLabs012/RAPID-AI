from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Iterator

from app.config import get_settings


logger = logging.getLogger(__name__)


class PostgresClientManager:
    _schema_initialized = False
    _disabled = False

    def __init__(self) -> None:
        self.settings = get_settings()

    def is_configured(self) -> bool:
        return bool(self.settings.database_url) and not self.__class__._disabled

    def _connection_url(self) -> str:
        return self.settings.database_url.replace("postgresql+psycopg://", "postgresql://", 1)

    @contextmanager
    def connection(self) -> Iterator:
        if not self.is_configured():
            yield None
            return

        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError:
            logger.warning("psycopg is not installed; using in-memory persistence")
            self.__class__._disabled = True
            yield None
            return

        try:
            with psycopg.connect(self._connection_url(), row_factory=dict_row) as conn:
                yield conn
        except Exception as exc:
            logger.warning("PostgreSQL is unavailable; using in-memory persistence: %s", exc)
            self.__class__._disabled = True
            yield None

    def ensure_schema(self) -> None:
        if self.__class__._schema_initialized or not self.is_configured():
            return

        with self.connection() as conn:
            if conn is None:
                return

            with conn.cursor() as cursor:
                postgis_enabled = False
                try:
                    cursor.execute("CREATE EXTENSION IF NOT EXISTS postgis")
                    postgis_enabled = True
                except Exception as exc:
                    conn.rollback()
                    logger.warning("PostGIS extension is not available yet: %s", exc)

                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        username TEXT NOT NULL,
                        username_lc TEXT NOT NULL UNIQUE,
                        role TEXT NOT NULL,
                        display_name TEXT NOT NULL DEFAULT '',
                        password_hash TEXT NOT NULL DEFAULT '',
                        coins INTEGER NOT NULL DEFAULT 0,
                        stars INTEGER NOT NULL DEFAULT 0,
                        games_played INTEGER NOT NULL DEFAULT 0,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS game_events (
                        id BIGSERIAL PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        game_type TEXT NOT NULL,
                        result TEXT NOT NULL,
                        score INTEGER NOT NULL,
                        rewards JSONB NOT NULL,
                        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS ai_responses (
                        request_id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        response TEXT NOT NULL,
                        voice_preview JSONB,
                        cached BOOLEAN NOT NULL DEFAULT FALSE,
                        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        payload JSONB NOT NULL
                    )
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS ocean_conditions (
                        id BIGSERIAL PRIMARY KEY,
                        latitude DOUBLE PRECISION NOT NULL,
                        longitude DOUBLE PRECISION NOT NULL,
                        timestamp TIMESTAMPTZ NOT NULL,
                        sea_surface_temperature DOUBLE PRECISION,
                        chlorophyll DOUBLE PRECISION,
                        salinity DOUBLE PRECISION,
                        dissolved_oxygen DOUBLE PRECISION,
                        depth DOUBLE PRECISION,
                        source TEXT NOT NULL,
                        features JSONB NOT NULL DEFAULT '{}'::jsonb,
                        raw JSONB NOT NULL DEFAULT '{}'::jsonb,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS species (
                        id BIGSERIAL PRIMARY KEY,
                        scientific_name TEXT NOT NULL UNIQUE,
                        common_name TEXT,
                        taxon_group TEXT,
                        conservation_status TEXT,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS fish_population (
                        id BIGSERIAL PRIMARY KEY,
                        species_id BIGINT REFERENCES species(id),
                        latitude DOUBLE PRECISION NOT NULL,
                        longitude DOUBLE PRECISION NOT NULL,
                        timestamp TIMESTAMPTZ NOT NULL,
                        fish_count INTEGER,
                        depth DOUBLE PRECISION,
                        source TEXT NOT NULL,
                        raw JSONB NOT NULL DEFAULT '{}'::jsonb,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS marine_protected_areas (
                        id BIGSERIAL PRIMARY KEY,
                        name TEXT NOT NULL,
                        designation TEXT,
                        country TEXT,
                        centroid_latitude DOUBLE PRECISION,
                        centroid_longitude DOUBLE PRECISION,
                        geometry_geojson JSONB NOT NULL DEFAULT '{}'::jsonb,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS satellite_observations (
                        id BIGSERIAL PRIMARY KEY,
                        ocean_condition_id BIGINT REFERENCES ocean_conditions(id),
                        latitude DOUBLE PRECISION NOT NULL,
                        longitude DOUBLE PRECISION NOT NULL,
                        timestamp TIMESTAMPTZ NOT NULL,
                        platform TEXT,
                        product TEXT,
                        source TEXT NOT NULL,
                        observation JSONB NOT NULL DEFAULT '{}'::jsonb,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS predictions (
                        id BIGSERIAL PRIMARY KEY,
                        latitude DOUBLE PRECISION NOT NULL,
                        longitude DOUBLE PRECISION NOT NULL,
                        timestamp TIMESTAMPTZ NOT NULL,
                        prediction_type TEXT NOT NULL,
                        value DOUBLE PRECISION NOT NULL,
                        confidence DOUBLE PRECISION NOT NULL,
                        source_observation_id BIGINT REFERENCES ocean_conditions(id),
                        model_version TEXT NOT NULL,
                        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS alerts (
                        id BIGSERIAL PRIMARY KEY,
                        latitude DOUBLE PRECISION NOT NULL,
                        longitude DOUBLE PRECISION NOT NULL,
                        timestamp TIMESTAMPTZ NOT NULL,
                        severity TEXT NOT NULL,
                        alert_type TEXT NOT NULL,
                        message TEXT NOT NULL,
                        active BOOLEAN NOT NULL DEFAULT TRUE,
                        prediction_id BIGINT REFERENCES predictions(id),
                        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """
                )
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_game_events_user_id ON game_events(user_id)")
                cursor.execute(
                    "CREATE INDEX IF NOT EXISTS idx_game_events_user_processed ON game_events(user_id, processed_at DESC)"
                )
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_ai_responses_user_id ON ai_responses(user_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_ocean_conditions_time ON ocean_conditions(timestamp DESC)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_ocean_conditions_source ON ocean_conditions(source)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_fish_population_species ON fish_population(species_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_predictions_type_time ON predictions(prediction_type, timestamp DESC)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_active_time ON alerts(active, timestamp DESC)")

                if postgis_enabled:
                    spatial_indexes = [
                        (
                            "idx_ocean_conditions_geom",
                            "ocean_conditions",
                            "longitude",
                            "latitude",
                        ),
                        ("idx_fish_population_geom", "fish_population", "longitude", "latitude"),
                        ("idx_satellite_observations_geom", "satellite_observations", "longitude", "latitude"),
                        ("idx_predictions_geom", "predictions", "longitude", "latitude"),
                        ("idx_alerts_geom", "alerts", "longitude", "latitude"),
                        ("idx_mpa_centroid_geom", "marine_protected_areas", "centroid_longitude", "centroid_latitude"),
                    ]
                    for index_name, table_name, lon_col, lat_col in spatial_indexes:
                        cursor.execute(
                            f"""
                            CREATE INDEX IF NOT EXISTS {index_name}
                            ON {table_name}
                            USING GIST (ST_SetSRID(ST_MakePoint({lon_col}, {lat_col}), 4326))
                            """
                        )

            conn.commit()

        self.__class__._schema_initialized = True
