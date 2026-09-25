export type MarineLayerType = "sst" | "chlorophyll" | "fisheries" | "biodiversity" | "coral" | "currents";

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

export type KpiTone = "red" | "green" | "blue" | "violet" | "cyan" | "amber";

export type KpiMetric = {
  id: string;
  title: string;
  value: string;
  unit: string;
  delta: string;
  tone: KpiTone;
  sparkline: number[];
};

export type LayerConfig = {
  id: MarineLayerType | "protected";
  label: string;
  color: string;
  enabled: boolean;
};
