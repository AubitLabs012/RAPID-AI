# RAPID-AI Backend Architecture

RAPID-AI is structured as an enterprise disaster intelligence backend built around FastAPI, PostgreSQL/PostGIS, Redis, SQLModel domain models, and Python data/AI pipelines.

## Runtime Stack

- API: FastAPI on Python 3.12
- Database: PostgreSQL with PostGIS spatial indexing
- Domain models: SQLModel
- Cache: Redis with in-memory fallback
- ETL/dataframes: Pandas and xarray
- AI/ML: Scikit-learn baseline predictors with room for trained model artifacts
- Deployment: Docker

## Backend Modules

```text
backend/app/
  api/              FastAPI routes, request validation, auth dependencies
  services/         Application orchestration and dashboard query services
  ingestion/        Source-specific marine data collectors
  transformations/  Cleaning, validation, normalization, feature generation
  db/               PostgreSQL connection and schema initialization
  database/         Compatibility exports for database infrastructure
  models/           SQLModel table definitions
  repositories/     Persistence/query interfaces
  ai/               Prediction and alert generation pipeline
  schedulers/       Daily refresh scheduler
  utils/            Shared utilities
```

## ETL Flow

```text
Copernicus / NOAA / INCOIS / OBIS / Fisheries
  -> fetch latest data
  -> standardize records
  -> clean and validate
  -> generate features with Pandas/xarray
  -> batch store in PostgreSQL/PostGIS
  -> run AI predictors
  -> save predictions
  -> generate active alerts
  -> serve dashboard APIs
```

## Canonical Observation Schema

All providers normalize into:

```text
Latitude
Longitude
Timestamp
Sea_Surface_Temperature
Chlorophyll
Salinity
Dissolved_Oxygen
Species_Name
Fish_Count
Depth
Source
```

## API Surface

- `GET /api/ocean`
- `GET /api/species`
- `GET /api/predictions`
- `GET /api/alerts`
- `GET /api/location/{lat}/{lon}`
- `POST /api/refresh` with an admin bearer token

## Dashboard Location Query

The map-click endpoint returns the latest nearby intelligence:

- Sea surface temperature
- Chlorophyll
- Salinity
- Fish abundance
- Biodiversity index
- Ocean health score
- Active alerts
- RAPID-AI summary

## Performance And Safety

- Async FastAPI endpoints
- Redis caching for location snapshots
- Batch inserts for observations, fish population, satellite observations, predictions, and alerts
- PostgreSQL connection reuse through a shared manager
- PostGIS spatial expression indexes where available
- Environment-variable driven source credentials
- JWT authentication and role checks for refresh operations
- Rate limiting and security headers
