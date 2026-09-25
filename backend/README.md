# Aubit Backend

This backend adds the missing server-side architecture for the frontend prototype.

## Included Layers

- API layer with FastAPI routes for `/api/login`, `/api/signup`, `/api/game`, `/api/ai-response`, `/api/assets/upload-url`, `/api/health`, and marine analytics
- Business logic layer for game rewards and AI response orchestration
- Database layer with repository abstractions and PostgreSQL/PostGIS-ready wiring
- Authentication and authorization with JWT plus a Firebase verification hook
- Cache layer with Redis support and an in-memory fallback
- Marine analytics powered by Pandas, xarray, and Scikit-learn
- Production ETL pipeline for Copernicus Marine, NOAA, INCOIS, OBIS, and public fisheries feeds
- Daily scheduler plus admin-triggered refresh endpoint
- External services layer with Groq wired as the default AI brain plus Gemini, OpenAI, ElevenLabs, and Stripe integration points
- File storage layer with GCP Storage configuration hook and local fallback
- Logging and monitoring via standard logging and optional Sentry
- Security middleware for validation, headers, and rate limiting
- Docker runtime for deployment

## Run Locally

1. Create a virtual environment.
2. Install dependencies.
3. Copy `.env.example` to `.env` and fill the values you need.
4. Start the API.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.

## Example Requests

Login:

```bash
curl -X POST http://127.0.0.1:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123","role":"user"}'
```

Process game result:

```bash
curl -X POST http://127.0.0.1:8000/api/game \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"demo-user","game_type":"sudoku","result":"win","score":980}'
```

Generate AI response:

```bash
curl -X POST http://127.0.0.1:8000/api/ai-response \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Explain gravity simply","use_voice":true,"context":{"topic":"physics"}}'
```

Refresh marine datasets:

```bash
curl -X POST http://127.0.0.1:8000/api/refresh \
  -H "Authorization: Bearer <admin-token>"
```

Dashboard APIs:

```bash
curl http://127.0.0.1:8000/api/ocean
curl http://127.0.0.1:8000/api/species
curl http://127.0.0.1:8000/api/predictions
curl http://127.0.0.1:8000/api/alerts
curl http://127.0.0.1:8000/api/location/12.85/80.27
```

## ETL Architecture

The backend Python package is under `backend/app` and follows the production modules requested for RAPID-AI:

```text
app/
  api/
  services/
  ingestion/
  transformations/
  db/
  database/
  models/
  repositories/
  ai/
  schedulers/
  utils/
```

Pipeline flow:

```text
Fetch -> Clean -> Validate -> Generate Features -> Store -> Run AI Models -> Save Predictions -> Generate Alerts
```

Each ingestion service returns the shared schema:

```text
Latitude, Longitude, Timestamp, Sea_Surface_Temperature, Chlorophyll,
Salinity, Dissolved_Oxygen, Species_Name, Fish_Count, Depth, Source
```

## Notes

- The current implementation is runnable without cloud credentials because each major integration has a local fallback.
- When `DATABASE_URL` is configured, users, AI responses, and game events are persisted in PostgreSQL. The schema initializer also enables PostGIS when the extension is available. If PostgreSQL is unavailable, the backend falls back to in-memory storage for local development.
- Groq is the default AI provider. Set `GROQ_API_KEY` in `backend/.env` to enable live AI responses. The default model is `llama-3.3-70b-versatile`.
- To use PostgreSQL/PostGIS, Redis, Firebase, GCP Storage, OpenAI, ElevenLabs, Stripe, or Sentry, populate the corresponding environment variables and replace the fallback stubs with live request logic where noted.
