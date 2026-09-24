import { create } from "zustand";
import type { MarineMarker } from "./types";

type HomeStyle = "glass" | "compact" | "focus";
type ColorMode = "day" | "night";

type MapFocus = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  zoom?: number;
  metric?: string;
  message?: string;
};

type DashboardState = {
  activeNav: string;
  uploadedMarkers: MarineMarker[];
  uploadAnalysis: string;
  mapFocus: MapFocus | null;
  selectedMetric: string;
  expandedMap: boolean;
  assistantMessage: string;
  satelliteEnabled: boolean;
  selectedLocationId: string | null;
  drawerOpen: boolean;
  commandPaletteOpen: boolean;
  timelineValue: number;
  homeStyle: HomeStyle;
  colorMode: ColorMode;
  reducedMotion: boolean;
  mapLabels: boolean;
  alertNotifications: boolean;
  dataRefreshMinutes: number;
  setActiveNav: (activeNav: string) => void;
  setUploadedMarkers: (uploadedMarkers: MarineMarker[], uploadAnalysis?: string) => void;
  setMapFocus: (mapFocus: MapFocus) => void;
  setSelectedMetric: (selectedMetric: string) => void;
  setExpandedMap: (expandedMap: boolean) => void;
  setAssistantMessage: (assistantMessage: string) => void;
  setSatelliteEnabled: (satelliteEnabled: boolean) => void;
  setSelectedLocationId: (selectedLocationId: string | null) => void;
  setDrawerOpen: (drawerOpen: boolean) => void;
  setCommandPaletteOpen: (commandPaletteOpen: boolean) => void;
  setTimelineValue: (timelineValue: number) => void;
  setHomeStyle: (homeStyle: HomeStyle) => void;
  setColorMode: (colorMode: ColorMode) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  setMapLabels: (mapLabels: boolean) => void;
  setAlertNotifications: (alertNotifications: boolean) => void;
  setDataRefreshMinutes: (dataRefreshMinutes: number) => void;
};

function readStoredBoolean(key: string, fallback: boolean) {
  const stored = localStorage.getItem(key);
  return stored == null ? fallback : stored === "true";
}

function readStoredNumber(key: string, fallback: number) {
  const stored = Number(localStorage.getItem(key));
  return Number.isFinite(stored) && stored > 0 ? stored : fallback;
}

function readStoredHomeStyle() {
  const stored = localStorage.getItem("maris_home_style");
  return stored === "compact" || stored === "focus" || stored === "glass" ? stored : "glass";
}

function readStoredColorMode() {
  const stored = localStorage.getItem("maris_color_mode");
  return stored === "day" || stored === "night" ? stored : "night";
}

export const useDashboardStore = create<DashboardState>((set) => ({
  activeNav: "Home",
  uploadedMarkers: [],
  uploadAnalysis: "",
  mapFocus: null,
  selectedMetric: "",
  expandedMap: false,
  assistantMessage: "Hello! I'm RAPID-AI. How can I help you explore our oceans today?",
  satelliteEnabled: true,
  selectedLocationId: null,
  drawerOpen: false,
  commandPaletteOpen: false,
  timelineValue: 6,
  homeStyle: readStoredHomeStyle(),
  colorMode: readStoredColorMode(),
  reducedMotion: readStoredBoolean("maris_reduced_motion", false),
  mapLabels: readStoredBoolean("maris_map_labels", true),
  alertNotifications: readStoredBoolean("maris_alert_notifications", true),
  dataRefreshMinutes: readStoredNumber("maris_data_refresh_minutes", 10),
  setActiveNav: (activeNav) => set({ activeNav }),
  setUploadedMarkers: (uploadedMarkers, uploadAnalysis = "") => set({ uploadedMarkers, uploadAnalysis }),
  setMapFocus: (mapFocus) => set({ mapFocus }),
  setSelectedMetric: (selectedMetric) => set({ selectedMetric }),
  setExpandedMap: (expandedMap) => set({ expandedMap }),
  setAssistantMessage: (assistantMessage) => set({ assistantMessage }),
  setSatelliteEnabled: (satelliteEnabled) => set({ satelliteEnabled }),
  setSelectedLocationId: (selectedLocationId) => set({ selectedLocationId }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setTimelineValue: (timelineValue) => set({ timelineValue }),
  setHomeStyle: (homeStyle) => {
    localStorage.setItem("maris_home_style", homeStyle);
    set({ homeStyle });
  },
  setColorMode: (colorMode) => {
    localStorage.setItem("maris_color_mode", colorMode);
    set({ colorMode });
  },
  setReducedMotion: (reducedMotion) => {
    localStorage.setItem("maris_reduced_motion", String(reducedMotion));
    set({ reducedMotion });
  },
  setMapLabels: (mapLabels) => {
    localStorage.setItem("maris_map_labels", String(mapLabels));
    set({ mapLabels });
  },
  setAlertNotifications: (alertNotifications) => {
    localStorage.setItem("maris_alert_notifications", String(alertNotifications));
    set({ alertNotifications });
  },
  setDataRefreshMinutes: (dataRefreshMinutes) => {
    localStorage.setItem("maris_data_refresh_minutes", String(dataRefreshMinutes));
    set({ dataRefreshMinutes });
  },
}));
