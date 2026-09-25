# RAPID-AI

RAPID is a disaster-intelligence dashboard for India. The current frontend combines an interactive globe, a MapLibre disaster map, report-sourced historical events, live Open-Meteo weather, and a local assistant. Scenario risk scores and alert counts are illustrative; they are not live warnings or forecasts.

## Run the dashboard

```bash
npm ci
npm run dev
```

Open `http://localhost:4175/RAPID-AI/`. `npm run build` produces the static GitHub Pages site. GitHub Pages serves the frontend only; it cannot run the Python API, database, Redis, or object storage.

## Assistant and analysis pipeline

The floating robot below Settings opens an assistant that can answer from the sample regional scenarios and the three supplied historical disaster reports. It does not upload attachments or claim to run a model. `backend/app/api/routes/rapid_assistant.py` exposes `/api/assistant/capabilities` and a validated `/api/assistant/intake` contract. Intake returns `configuration_pending` until the data providers, vision-capable model, evidence storage, and incident processing are connected.

The intended pipeline is: multi-source data → multimodal AI analysis → evidence verification → damage and risk assessment → geographic intelligence → incident clustering → priority engine → situation forecast → response recommendation → responder dashboard and alerts. The assistant panel shows these ten stages and their current status.

## Stack

| Layer | Current state |
| --- | --- |
| Frontend | React, TypeScript, Tailwind CSS |
| Disaster map | MapLibre GL JS; satellite, normal, and illustrative risk layers |
| API | Python, FastAPI; intake contract and existing backend services |
| Weather | Open-Meteo frontend feed |
| Vision/OCR/video | PyTorch, Ultralytics YOLO, Tesseract, OpenCV, FFmpeg installed/configured for later integration; no detector is running in the dashboard |
| Spatial/ML | GeoPandas, Shapely, Rasterio, scikit-learn, XGBoost installed for later analysis |
| Data services | PostgreSQL + PostGIS + pgvector, Redis, and S3-compatible MinIO defined in `compose.yaml` |
| External feeds | Copernicus, Earthdata/GIBS, USGS, and NASA FIRMS are planned; no feed is represented as live until connected |

## Local backend

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`. Copy `backend/.env.example` to `backend/.env` and fill in credentials when available. Do not commit `.env`. Docker users can run `docker compose up --build` from the repository root to start the API and local data services. Change the local-only default passwords before exposing any service outside a development machine.

On Windows, Docker Desktop needs its Linux backend. If WSL is missing, run `wsl --install` from an Administrator terminal, restart Windows, and then open Docker Desktop before running Compose.

When the model/provider API details are supplied, connect the assistant to the deployed backend and enable each stage only after its evidence and source checks are implemented. Configure the deployed backend URL and allowed origin for the GitHub Pages frontend separately.
