from __future__ import annotations


class MarineAnalyticsService:
    def build_marker_analytics(self, markers: list[dict]) -> dict:
        try:
            import pandas as pd
            import xarray as xr
            from sklearn.cluster import KMeans
            from sklearn.preprocessing import StandardScaler
        except ImportError as exc:
            raise RuntimeError(
                "Marine analytics requires pandas, xarray, and scikit-learn. "
                "Install backend dependencies with `pip install -r requirements.txt`."
            ) from exc

        frame = pd.DataFrame(markers)
        frame["confidence"] = frame["metrics"].map(self._extract_confidence)

        grid = xr.Dataset(
            data_vars={
                "confidence": (("marker",), frame["confidence"].to_numpy()),
                "latitude": (("marker",), frame["lat"].to_numpy()),
                "longitude": (("marker",), frame["lng"].to_numpy()),
            },
            coords={"marker": frame["id"].to_list()},
        )

        features = frame[["lat", "lng", "confidence"]]
        scaled_features = StandardScaler().fit_transform(features)
        cluster_count = min(3, len(frame))
        frame["cluster"] = KMeans(n_clusters=cluster_count, random_state=7, n_init=10).fit_predict(scaled_features)

        regions = (
            frame.groupby("region", as_index=False)
            .agg(marker_count=("id", "count"), average_confidence=("confidence", "mean"))
            .sort_values("average_confidence", ascending=False)
        )

        return {
            "engine": {
                "api": "FastAPI",
                "database": "PostgreSQL/PostGIS",
                "tabular": "Pandas",
                "gridded": "xarray",
                "ml": "Scikit-learn",
            },
            "summary": {
                "marker_count": int(len(frame)),
                "average_confidence": round(float(grid["confidence"].mean().item()), 2),
                "latitude_bounds": [
                    round(float(grid["latitude"].min().item()), 2),
                    round(float(grid["latitude"].max().item()), 2),
                ],
                "longitude_bounds": [
                    round(float(grid["longitude"].min().item()), 2),
                    round(float(grid["longitude"].max().item()), 2),
                ],
            },
            "regions": [
                {
                    "region": row["region"],
                    "marker_count": int(row["marker_count"]),
                    "average_confidence": round(float(row["average_confidence"]), 2),
                }
                for row in regions.to_dict(orient="records")
            ],
            "clusters": [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "region": row["region"],
                    "cluster": int(row["cluster"]),
                    "confidence": float(row["confidence"]),
                }
                for row in frame.sort_values(["cluster", "confidence"], ascending=[True, False]).to_dict(orient="records")
            ],
        }

    def _extract_confidence(self, metrics: dict[str, str]) -> float:
        raw_value = metrics.get("Confidence", "0%").strip().rstrip("%")
        try:
            return float(raw_value)
        except ValueError:
            return 0.0
