import asyncio
from datetime import date
import unittest

import httpx
from fastapi import HTTPException

from app.api.routes import live_imagery as live


def capabilities(identifier="MODIS_Terra_CorrectedReflectance_TrueColor", mime="image/jpeg"):
    return f'''<Capabilities xmlns="http://www.opengis.net/wmts/1.0" xmlns:ows="http://www.opengis.net/ows/1.1">
      <Contents><Layer><ows:Identifier>{identifier}</ows:Identifier><ows:Title>NASA image</ows:Title>
      <Dimension><ows:Identifier>Time</ows:Identifier><Default>2026-09-30</Default>
      <Value>2026-09-01/2026-09-10/P1D</Value><Value>2026-09-15/2026-09-30/P1D</Value></Dimension>
      <TileMatrixSetLink><TileMatrixSet>GoogleMapsCompatible_Level9</TileMatrixSet></TileMatrixSetLink>
      <ResourceURL resourceType="tile" format="{mime}" template="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{identifier}/default/{{Time}}/{{TileMatrixSet}}/{{TileMatrix}}/{{TileRow}}/{{TileCol}}.jpeg"/>
      </Layer><TileMatrixSet><ows:Identifier>GoogleMapsCompatible_Level9</ows:Identifier>
      <TileMatrix><ows:Identifier>0</ows:Identifier><TileWidth>256</TileWidth></TileMatrix>
      <TileMatrix><ows:Identifier>9</ows:Identifier><TileWidth>256</TileWidth></TileMatrix>
      </TileMatrixSet></Contents></Capabilities>'''.encode()


class ImageryParserTests(unittest.TestCase):
    def test_dates_preserve_gaps_and_never_offer_future_observations(self):
        layer = live.parse_capabilities(capabilities(), {}, date(2026, 9, 25))[0]
        self.assertEqual(layer["default_date"], "2026-09-25")
        self.assertEqual(layer["date_max"], "2026-09-25")
        self.assertEqual(len(layer["date_intervals"]), 2)
        self.assertEqual(layer["date_intervals"][0]["end"], "2026-09-10")
        self.assertEqual(layer["maxzoom"], 9)
        self.assertIn("/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}", layer["tiles"])

    def test_untrusted_tile_hosts_are_rejected(self):
        with self.assertRaises(ValueError):
            live.parse_capabilities(capabilities().replace(b"gibs.earthdata.nasa.gov", b"example.com"), {}, date(2026, 9, 25))

    def test_events_use_latest_observed_point_and_reject_invalid_coordinates(self):
        event = {"id": "example", "title": "Storm", "geometry": [
            {"type": "Point", "date": "2026-09-25T00:00:00Z", "coordinates": [80, 20]},
            {"type": "Point", "date": "2026-09-24T00:00:00Z", "coordinates": [79, 20]},
        ]}
        result = live.parse_events({"events": [event]})
        self.assertEqual(result[0]["longitude"], 80)
        event["geometry"][0]["coordinates"] = [float("nan"), 20]
        self.assertEqual(live.parse_events({"events": [event]}), [])


class CacheTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        live._cache.clear()
        live._retry_after.clear()
        live._locks.clear()

    async def test_upstream_failure_is_never_reported_as_live(self):
        async def failed():
            raise httpx.ConnectError("unavailable")
        with self.assertRaises(HTTPException) as error:
            await live._cached("test", failed)
        self.assertEqual(error.exception.status_code, 503)
        fetched = "2026-09-24T01:00:00Z"
        live._cache["test"] = (live.time.monotonic() - 1000, {"fetched_at": fetched})
        result = await live._cached("test", failed)
        self.assertTrue(result["stale"])
        self.assertEqual(result["status"], "stale")
        self.assertEqual(result["fetched_at"], fetched)


if __name__ == "__main__":
    unittest.main()
