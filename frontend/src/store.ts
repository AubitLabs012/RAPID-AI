import { create } from "zustand";

type DashboardState = {
  activeNav: string;
  selectedMetric: string;
  selectedLocationId: string | null;
  drawerOpen: boolean;
  commandPaletteOpen: boolean;
  timelineValue: number;
  satelliteEnabled: boolean;
  assistantMessage: string;
  setActiveNav: (activeNav: string) => void;
  setSelectedMetric: (selectedMetric: string) => void;
  setSelectedLocationId: (selectedLocationId: string | null) => void;
  setDrawerOpen: (drawerOpen: boolean) => void;
  setCommandPaletteOpen: (commandPaletteOpen: boolean) => void;
  setTimelineValue: (timelineValue: number) => void;
  setSatelliteEnabled: (satelliteEnabled: boolean) => void;
  setAssistantMessage: (assistantMessage: string) => void;
};

export const useDashboardStore = create<DashboardState>((set) => ({
  activeNav: "Dashboard",
  selectedMetric: "",
  selectedLocationId: null,
  drawerOpen: false,
  commandPaletteOpen: false,
  timelineValue: 5,
  satelliteEnabled: true,
  assistantMessage: "Hello! I'm RAPID-AI. How can I help you explore our oceans today?",
  setActiveNav: (activeNav) => set({ activeNav }),
  setSelectedMetric: (selectedMetric) => set({ selectedMetric }),
  setSelectedLocationId: (selectedLocationId) => set({ selectedLocationId }),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setTimelineValue: (timelineValue) => set({ timelineValue }),
  setSatelliteEnabled: (satelliteEnabled) => set({ satelliteEnabled }),
  setAssistantMessage: (assistantMessage) => set({ assistantMessage }),
}));
