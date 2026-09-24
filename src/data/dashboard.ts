import {
  Activity,
  FileText,
  Gauge,
  Home,
  Layers3,
  Map,
  Radio,
  Settings,
  Target,
  UploadCloud,
} from "lucide-react";
import type { KpiMetric, LayerConfig } from "../types";

export const navItems = [
  { label: "Home", icon: Home },
  { label: "Analytics", icon: Gauge },
  { label: "Live", icon: Map },
  { label: "Settings", icon: Settings },
  { label: "Predictions", icon: Target },
];

export const kpis: KpiMetric[] = [
  {
    id: "sst",
    title: "Sea Surface Temp.",
    description: "Average sea surface temperature from the uploaded NOAA OISST table.",
    value: "29.05",
    unit: "C",
    delta: "13 records / 2026-08-19",
    tone: "red",
    sparkline: [29.4, 29.56, 29.52, 29.49, 29.1, 29.37, 29.35, 28.83, 29.78, 27.87, 29.89, 26.3],
  },
  {
    id: "chlorophyll",
    title: "Chlorophyll Avg.",
    description: "Average chlorophyll-a concentration from the uploaded NOAA-20 VIIRS table.",
    value: "0.195",
    unit: "mg/m3",
    delta: "12 records / 2026-06-15",
    tone: "green",
    sparkline: [0.1997, 0.1769, 0.156, 0.1958, 0.192, 0.1888, 0.1455, 0.1971, 0.2045, 0.2214, 0.2314, 0.2308],
  },
  {
    id: "biodiversity",
    title: "Biodiversity Index",
    description: "Marine biodiversity occurrences transcribed from the uploaded OBIS/IndOBIS table.",
    value: "15",
    unit: "records",
    delta: "OBIS / IndOBIS",
    tone: "violet",
    sparkline: [7.43, 5.18, -0.43, 2.15, 5.14, 9.99, -3.5, 10, 9.03, -1.95, 3.87, -11.23],
  },
  {
    id: "health",
    title: "Ocean Health Score",
    description: "Derived from co-located biodiversity SST and salinity rows in the uploaded table.",
    value: "82",
    unit: "/100",
    delta: "11 co-located rows",
    tone: "cyan",
    sparkline: [79, 82, 81, 78, 83, 80, 82, 76, 83, 80, 82],
  },
];

export const marineLayers: LayerConfig[] = [
  { id: "sst", label: "Sea Surface Temp.", color: "#ff5b4f", enabled: true },
  { id: "chlorophyll", label: "Chlorophyll (Avg)", color: "#31f48f", enabled: true },
  { id: "coral", label: "Coral Reefs", color: "#f9c846", enabled: true },
  { id: "protected", label: "Marine Protected Areas", color: "#b78cff", enabled: false },
  { id: "biodiversity", label: "Biodiversity Signals", color: "#8f67ff", enabled: true },
];

export const alerts = [
  { tone: "red", title: "Coral Bleaching Risk - High", place: "Great Barrier Reef, Australia", time: "2h ago" },
  { tone: "orange", title: "Algal Bloom Detected", place: "Arabian Sea", time: "5h ago" },
  { tone: "yellow", title: "Unusual SST Increase", place: "Bay of Bengal", time: "6h ago" },
];

export const species = [
  { image: "shark-img", name: "Whale Shark", latin: "Rhincodon typus", risk: "high", label: "Endangered" },
  { image: "turtle-img", name: "Green Sea Turtle", latin: "Chelonia mydas", risk: "high", label: "Endangered" },
  { image: "whale-img", name: "Blue Whale", latin: "Balaenoptera musculus", risk: "high", label: "Endangered" },
  { image: "ray-img", name: "Manta Ray", latin: "Mobula birostris", risk: "medium", label: "Vulnerable" },
  { image: "clownfish-img", name: "Clownfish", latin: "Amphiprion ocellaris", risk: "low", label: "Least Concern" },
  { image: "dugong-img", name: "Dugong", latin: "Dugong dugon", risk: "medium", label: "Vulnerable" },
];

export const assistantReplies: Record<string, string> = {
  "Show biodiversity near Chennai":
    "Chennai coastal waters show elevated biodiversity confidence near reef-adjacent transects, with turtle and ray signals trending upward.",
  "Compare Arabian Sea vs Bay of Bengal":
    "The Arabian Sea has stronger bloom probability, while the Bay of Bengal shows sharper sea-surface temperature anomaly growth.",
};

export const commandItems = [
  { label: "Focus Bay of Bengal", icon: Map },
  { label: "Toggle satellite imagery", icon: Layers3 },
  { label: "Open AI Copilot", icon: Radio },
  { label: "Generate NOAA-style report", icon: FileText },
  { label: "Inspect active alerts", icon: Activity },
  { label: "Upload ocean raster", icon: UploadCloud },
];
