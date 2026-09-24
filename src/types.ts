export type MarineLayerType = "sst" | "chlorophyll" | "fisheries" | "biodiversity" | "coral" | "currents" | "health";

export type KpiMetric = {
  id: string;
  title: string;
  description: string;
  value: string;
  unit: string;
  delta: string;
  tone: string;
  sparkline: number[];
};

export type LayerConfig = {
  id: string;
  label: string;
  color: string;
  enabled: boolean;
};

export type MarineMarker = {
  id: string;
  name: string;
  region: string;
  layer: string;
  type: MarineLayerType;
  lat: number;
  lng: number;
  summary: string;
  metrics: Record<string, string>;
};

export type LiveOceanRegion = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  observed_at: string;
  source: string;
  risk: "Low" | "Moderate" | "High";
  summary: string;
  metrics: {
    air_temperature_c: number | null;
    wind_speed_kmh: number | null;
    wind_direction_deg: number | null;
    weather_code: number | null;
    wave_height_m: number | null;
    wave_period_s: number | null;
    wave_direction_deg: number | null;
    sea_surface_temperature_c: number | null;
    ocean_current_velocity_kmh: number | null;
    ocean_current_direction_deg: number | null;
  };
};

export type PredictionAgentId = "marine" | "analytics" | "reasoning" | "intelligence" | "synthesis";

export type PredictionAgent = {
  id: PredictionAgentId;
  letter: string;
  name: string;
  focus: string;
  goal: string;
  tools: string;
  formula?: string;
};

export type PredictionAgentResult = {
  request_id: string;
  agent_id: PredictionAgentId;
  agent: PredictionAgent;
  response: string;
  live_regions: LiveOceanRegion[];
  formula_evidence?: Record<string, unknown>;
  generated_at: string;
};

export type BiodiversitySpecies = {
  common_name: string;
  scientific_name: string;
  taxon_group: string;
  status: string;
  confidence: number;
  habitat: string;
  source: string;
};
