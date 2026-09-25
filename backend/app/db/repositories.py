from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from typing import Optional

from app.db.postgres import PostgresClientManager


try:
    from psycopg.types.json import Jsonb
except ImportError:
    def Jsonb(value):
        return value


class InMemoryCollection:
    _stores: dict[str, dict[str, dict]] = {}

    def __init__(self, namespace: str) -> None:
        self.namespace = namespace
        self._stores.setdefault(namespace, {})

    def get(self, key: str) -> Optional[dict]:
        value = self._stores[self.namespace].get(key)
        return deepcopy(value) if value is not None else None

    def upsert(self, key: str, value: dict) -> dict:
        self._stores[self.namespace][key] = deepcopy(value)
        return deepcopy(value)

    def append_event(self, key: str, event: dict) -> list[dict]:
        existing = self._stores[self.namespace].setdefault(key, {"events": []})
        existing.setdefault("events", []).append(deepcopy(event))
        return deepcopy(existing["events"])


class UserRepository:
    def __init__(self) -> None:
        self.collection = InMemoryCollection("users")
        self.postgres = PostgresClientManager()
        self.postgres.ensure_schema()

    def create(self, user: dict) -> dict:
        profile = {
            "id": user["id"],
            "username": user["username"],
            "username_lc": user["username"].lower(),
            "role": user["role"],
            "display_name": user.get("display_name", ""),
            "password_hash": user.get("password_hash", ""),
            "coins": 0,
            "stars": 0,
            "games_played": 0,
        }
        with self.postgres.connection() as conn:
            if conn is not None:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO users (
                            id, username, username_lc, role, display_name, password_hash,
                            coins, stars, games_played
                        )
                        VALUES (
                            %(id)s, %(username)s, %(username_lc)s, %(role)s, %(display_name)s,
                            %(password_hash)s, %(coins)s, %(stars)s, %(games_played)s
                        )
                        ON CONFLICT (id) DO UPDATE SET
                            username = EXCLUDED.username,
                            username_lc = EXCLUDED.username_lc,
                            role = EXCLUDED.role,
                            display_name = EXCLUDED.display_name,
                            password_hash = EXCLUDED.password_hash,
                            updated_at = NOW()
                        """,
                        profile,
                    )
                conn.commit()
                return self.get_by_id(user["id"]) or deepcopy(profile)
        return self.collection.upsert(user["id"], profile)

    def get_or_create(self, user: dict) -> dict:
        existing = self.collection.get(user["id"])
        if self.postgres.is_configured():
            existing = self.get_by_id(user["id"])
        if existing is not None:
            return existing
        return self.create(user)

    def get_by_id(self, user_id: str) -> Optional[dict]:
        with self.postgres.connection() as conn:
            if conn is not None:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id, username, role, display_name, password_hash, coins, stars, games_played
                        FROM users
                        WHERE id = %s
                        """,
                        (user_id,),
                    )
                    user = cursor.fetchone()
                return deepcopy(dict(user)) if user is not None else None
        return self.collection.get(user_id)

    def get_by_username(self, username: str) -> Optional[dict]:
        normalized_username = username.lower()
        with self.postgres.connection() as conn:
            if conn is not None:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id, username, role, display_name, password_hash, coins, stars, games_played
                        FROM users
                        WHERE username_lc = %s
                        """,
                        (normalized_username,),
                    )
                    user = cursor.fetchone()
                return deepcopy(dict(user)) if user is not None else None
        for user in InMemoryCollection._stores.get("users", {}).values():
            if user.get("username", "").lower() == normalized_username:
                return deepcopy(user)
        return None

    def update_rewards(self, user_id: str, coins: int, stars: int) -> dict:
        user = self.collection.get(user_id) or {
            "id": user_id,
            "username": "",
            "role": "user",
            "display_name": "",
            "password_hash": "",
            "coins": 0,
            "stars": 0,
            "games_played": 0,
        }
        user["coins"] += coins
        user["stars"] += stars
        user["games_played"] += 1
        with self.postgres.connection() as conn:
            if conn is not None:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO users (id, username, username_lc, role, display_name, password_hash)
                        VALUES (%s, '', %s, 'user', '', '')
                        ON CONFLICT (id) DO NOTHING
                        """,
                        (user_id, user_id.lower()),
                    )
                    cursor.execute(
                        """
                        UPDATE users
                        SET coins = coins + %s,
                            stars = stars + %s,
                            games_played = games_played + 1,
                            updated_at = NOW()
                        WHERE id = %s
                        RETURNING id, username, role, display_name, password_hash, coins, stars, games_played
                        """,
                        (coins, stars, user_id),
                    )
                    updated = cursor.fetchone()
                conn.commit()
                return deepcopy(dict(updated)) if updated is not None else deepcopy(user)
        return self.collection.upsert(user_id, user)


class GameRepository:
    _events: dict[str, list[dict]] = defaultdict(list)

    def __init__(self) -> None:
        self.postgres = PostgresClientManager()
        self.postgres.ensure_schema()

    def create_event(self, user_id: str, event: dict) -> dict:
        with self.postgres.connection() as conn:
            if conn is not None:
                document = {"user_id": user_id, **deepcopy(event)}
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO game_events (user_id, game_type, result, score, rewards, processed_at)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (
                            user_id,
                            event["game_type"],
                            event["result"],
                            event["score"],
                            Jsonb(event["rewards"]),
                            event["processed_at"],
                        ),
                    )
                conn.commit()
                return document
        self._events[user_id].append(deepcopy(event))
        return deepcopy(event)

    def list_events(self, user_id: str) -> list[dict]:
        with self.postgres.connection() as conn:
            if conn is not None:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT user_id, game_type, result, score, rewards, processed_at
                        FROM game_events
                        WHERE user_id = %s
                        ORDER BY processed_at DESC
                        """,
                        (user_id,),
                    )
                    events = cursor.fetchall()
                return [dict(event) for event in events]
        return deepcopy(self._events[user_id])


class AIResponseRepository:
    def __init__(self) -> None:
        self.collection = InMemoryCollection("ai_responses")
        self.postgres = PostgresClientManager()
        self.postgres.ensure_schema()

    def save(self, request_id: str, payload: dict) -> dict:
        with self.postgres.connection() as conn:
            if conn is not None:
                document = {"request_id": request_id, **deepcopy(payload)}
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO ai_responses (
                            request_id, user_id, response, voice_preview, cached, generated_at, payload
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (request_id) DO UPDATE SET
                            user_id = EXCLUDED.user_id,
                            response = EXCLUDED.response,
                            voice_preview = EXCLUDED.voice_preview,
                            cached = EXCLUDED.cached,
                            generated_at = EXCLUDED.generated_at,
                            payload = EXCLUDED.payload
                        """,
                        (
                            request_id,
                            payload["user_id"],
                            payload["response"],
                            Jsonb(payload.get("voice_preview")),
                            payload.get("cached", False),
                            payload["generated_at"],
                            Jsonb(document),
                        ),
                    )
                conn.commit()
                return document
        return self.collection.upsert(request_id, payload)
