import { useEffect, useMemo, useState, type CSSProperties } from "react";
import ReactECharts from "echarts-for-react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Grid3X3, LayoutGrid, PieChart, ScatterChart, X } from "lucide-react";
import { kpis } from "../../data/dashboard";
import { useDashboardStore } from "../../store";
import { Button } from "../ui/button";

type ChartMode = "all" | "bar" | "pie" | "scatter" | "heatmap";
type MetricKey = "sst" | "chlorophyll" | "biodiversity" | "health" | "risks";

type MetricAnalysis = {
  title: string;
  subtitle: string;
  summary: string;
  barTitle: string;
  pieTitle: string;
  scatterTitle: string;
  heatTitle: string;
  barCategories: string[];
  barValues: number[];
  pieSegments: Array<{ name: string; value: number }>;
  scatterName: string;
  scatterData: number[][];
  heatX: string[];
  heatY: string[];
  heatData: number[][];
  insights: string[];
};

const metricAnalysis: Record<MetricKey, MetricAnalysis> = {
  sst: {
    title: "Sea Surface Temperature",
    subtitle: "NOAA OISST v2.1 / 2026-08-19",
    summary: "RAPID-AI is using the SST rows from your screenshot. The batch covers 13 grid points from 60.125E to 90.125E, with an average SST near 29.05 C and the hottest visible point at 6.375N, 67.625E.",
    barTitle: "SST by Uploaded Coordinate",
    pieTitle: "Temperature Band Share",
    scatterTitle: "Longitude vs SST",
    heatTitle: "Uploaded SST Grid",
    barCategories: ["0.125,60.125", "0.125,65.125", "0.125,70.125", "0.125,75.125", "0.125,80.125", "0.125,85.125", "0.125,90.125", "5.125,60.125", "5.125,70.125", "5.125,80.125", "6.375,67.625", "7.625,77.625", "8.875,65.125"],
    barValues: [29.4, 29.56, 29.52, 29.49, 29.1, 29.37, 29.35, 28.83, 29.78, 27.87, 29.89, 26.3, 29.19],
    pieSegments: [{ name: "Below 28 C", value: 2 }, { name: "28-29 C", value: 1 }, { name: "29-29.5 C", value: 6 }, { name: "Above 29.5 C", value: 4 }],
    scatterName: "Temperature",
    scatterData: [[60.125, 29.4], [65.125, 29.56], [70.125, 29.52], [75.125, 29.49], [80.125, 29.1], [85.125, 29.37], [90.125, 29.35], [60.125, 28.83], [70.125, 29.78], [80.125, 27.87], [67.625, 29.89], [77.625, 26.3], [65.125, 29.19]],
    heatX: ["60E", "65E", "70E", "75E", "80E", "85E", "90E"],
    heatY: ["0N", "5N", "6-9N"],
    heatData: [[0, 0, 29.4], [1, 0, 29.56], [2, 0, 29.52], [3, 0, 29.49], [4, 0, 29.1], [5, 0, 29.37], [6, 0, 29.35], [0, 1, 28.83], [2, 1, 29.78], [4, 1, 27.87], [1, 2, 29.89], [3, 2, 26.3], [1, 2, 29.19]],
    insights: ["Highest SST in the screenshot is 29.89 C at 6.375N, 67.625E.", "Lowest SST is 26.30 C near 7.625N, 77.625E.", "Most points sit in the warm 29-29.5 C band."],
  },
  chlorophyll: {
    title: "Chlorophyll Avg.",
    subtitle: "NOAA-20 VIIRS weekly chlorophyll / 2026-06-15",
    summary: "RAPID-AI is using the chlorophyll-a rows from your screenshot. The uploaded batch has 12 points across Arabian Sea and Bay of Bengal stations, averaging about 0.195 mg/m3.",
    barTitle: "Chlorophyll by Coordinate",
    pieTitle: "Concentration Band Share",
    scatterTitle: "Longitude vs Chlorophyll",
    heatTitle: "Uploaded Chlorophyll Grid",
    barCategories: ["20.006,66.769", "20.006,68.381", "20.006,68.419", "20.006,70.368", "20.006,70.406", "20.006,70.519", "15.019,88.556", "15.019,88.594", "15.019,88.631", "15.019,88.669", "15.019,88.706", "15.019,88.741"],
    barValues: [0.1997, 0.1769, 0.156, 0.1958, 0.192, 0.1888, 0.1455, 0.1971, 0.2045, 0.2214, 0.2314, 0.2308],
    pieSegments: [{ name: "Below 0.18", value: 3 }, { name: "0.18-0.20", value: 5 }, { name: "Above 0.20", value: 4 }],
    scatterName: "Chlorophyll",
    scatterData: [[66.769, 0.1997], [68.381, 0.1769], [68.419, 0.156], [70.368, 0.1958], [70.406, 0.192], [70.519, 0.1888], [88.556, 0.1455], [88.594, 0.1971], [88.631, 0.2045], [88.669, 0.2214], [88.706, 0.2314], [88.741, 0.2308]],
    heatX: ["66.8E", "68.4E", "70.4E", "88.6E", "88.7E"],
    heatY: ["20.006N", "15.019N"],
    heatData: [[0, 0, 0.1997], [1, 0, 0.1769], [1, 0, 0.156], [2, 0, 0.1958], [2, 0, 0.192], [2, 0, 0.1888], [3, 1, 0.1455], [3, 1, 0.1971], [3, 1, 0.2045], [4, 1, 0.2214], [4, 1, 0.2314], [4, 1, 0.2308]],
    insights: ["Highest chlorophyll is 0.2314 mg/m3 at 15.019N, 88.706E.", "Lowest chlorophyll is 0.1455 mg/m3 at 15.019N, 88.556E.", "The eastern Bay of Bengal cluster rises across the visible longitudes."],
  },
  biodiversity: {
    title: "Biodiversity Index",
    subtitle: "OBIS / IndOBIS occurrences with co-located SST/salinity",
    summary: "RAPID-AI is using the 15 occurrence rows visible in your OBIS/IndOBIS screenshot. The records include fish, reptiles, planktonic groups, jellyfish, shark, bird, and coastal plant occurrences across the Indian Ocean basin.",
    barTitle: "Occurrences by Region",
    pieTitle: "Observed Group Mix",
    scatterTitle: "Salinity vs SST",
    heatTitle: "Occurrence Heat Map",
    barCategories: ["Lakshadweep", "Arabian", "Central IO", "Western IO", "Equatorial IO", "Goa", "Chennai", "Sri Lanka"],
    barValues: [5, 3, 2, 1, 1, 1, 1, 1],
    pieSegments: [{ name: "Fish", value: 5 }, { name: "Reptile/Shark", value: 2 }, { name: "Plankton/Larva", value: 4 }, { name: "Jellyfish", value: 1 }, { name: "Bird/Plant", value: 2 }, { name: "Other", value: 1 }],
    scatterName: "Biodiversity",
    scatterData: [[34.5, 28.79], [34.82, 28.91], [34.72, 29.27], [35.18, 29.35], [34.85, 28.92], [34.52, 28.63], [34.95, 29.06], [36.08, 28.6], [34.85, 28.88], [35.1, 29.22], [34.9, 28.99]],
    heatX: ["Arabian", "Lakshadweep", "Central", "Bay", "Coasts"],
    heatY: ["Fish", "Reptile", "Plankton", "Other"],
    heatData: [[0, 0, 3], [1, 0, 2], [2, 0, 1], [1, 1, 1], [3, 2, 1], [2, 2, 2], [4, 3, 3]],
    insights: ["Lakshadweep Sea has the densest visible occurrence cluster.", "Eleven occurrence rows include co-located SST and salinity.", "The dataset contains both ecological species and physical context for map-based analysis."],
  },
  health: {
    title: "Ocean Health Score",
    subtitle: "Derived from co-located OBIS SST and salinity records",
    summary: "RAPID-AI estimates the displayed ocean-health score from the 11 biodiversity rows that also include SST and salinity. The score is a dashboard interpretation for this dataset, not a separately supplied field.",
    barTitle: "Co-located Physical Signals",
    pieTitle: "Available Signal Share",
    scatterTitle: "Salinity vs Derived Health",
    heatTitle: "Health by Co-located Region",
    barCategories: ["Avg SST", "Avg Salinity", "Occurrence Rows", "Co-located Rows", "Missing Physical"],
    barValues: [28.97, 34.95, 15, 11, 4],
    pieSegments: [{ name: "Species", value: 15 }, { name: "SST", value: 11 }, { name: "Salinity", value: 11 }, { name: "Depth", value: 3 }],
    scatterName: "Derived Health",
    scatterData: [[34.5, 84], [34.82, 83], [34.72, 82], [35.18, 79], [34.85, 83], [34.52, 84], [34.95, 82], [36.08, 76], [34.85, 83], [35.1, 80], [34.9, 82]],
    heatX: ["Lakshadweep", "Arabian", "Central", "Equatorial"],
    heatY: ["SST", "Salinity", "Derived Score"],
    heatData: [[0, 0, 28.9], [1, 0, 28.86], [2, 0, 29.14], [3, 0, 29.27], [0, 1, 34.78], [1, 1, 35.26], [2, 1, 35.03], [3, 1, 34.72], [0, 2, 83], [1, 2, 80], [2, 2, 81], [3, 2, 82]],
    insights: ["The derived score is strongest where salinity is close to the mid-34 PSU range.", "Decapterus punctatus has the saltiest co-located row at 36.08 PSU.", "Four species rows need physical values before this health estimate can be made fully data-complete."],
  },
  risks: {
    title: "Natural Disaster Risk Zones",
    subtitle: "Cyclone, earthquake, tsunami, storm-surge, and natural hazard analysis",
    summary: "RAPID-AI maps major natural-disaster risk zones against marine assets, fisheries activity, and coastal exposure.",
    barTitle: "Risk Exposure",
    pieTitle: "Hazard Mix",
    scatterTitle: "Exposure vs Confidence",
    heatTitle: "Disaster Risk Heat Map",
    barCategories: ["Cyclone", "Tsunami", "Quake", "Flood", "Volcano", "Surge"],
    barValues: [88, 76, 83, 69, 58, 72],
    pieSegments: [{ name: "Cyclone", value: 34 }, { name: "Earthquake", value: 22 }, { name: "Tsunami", value: 18 }, { name: "Flood", value: 16 }, { name: "Volcano", value: 10 }],
    scatterName: "Risk",
    scatterData: [[42, 71], [54, 76], [65, 83], [72, 88], [84, 91], [92, 94]],
    heatX: ["Arabian", "Bengal", "Sunda", "Pacific", "Delta"],
    heatY: ["Cyclone", "Quake", "Tsunami", "Flood"],
    heatData: [[0, 0, 78], [1, 0, 94], [2, 0, 70], [3, 0, 65], [4, 0, 86], [0, 1, 42], [1, 1, 55], [2, 1, 88], [3, 1, 92], [4, 1, 60], [0, 2, 50], [1, 2, 62], [2, 2, 90], [3, 2, 82], [4, 2, 72], [0, 3, 66], [1, 3, 74], [2, 3, 58], [3, 3, 54], [4, 3, 84]],
    insights: ["Bay of Bengal has the strongest cyclone corridor.", "Sunda and Pacific zones dominate earthquake and tsunami exposure.", "Delta regions carry elevated flood and storm-surge risk."],
  },
};

const chartModes = [
  { id: "all", label: "All", icon: LayoutGrid },
  { id: "bar", label: "Bar", icon: BarChart3 },
  { id: "pie", label: "Pie", icon: PieChart },
  { id: "scatter", label: "Scatter", icon: ScatterChart },
  { id: "heatmap", label: "Heat Map", icon: Grid3X3 },
] as const;

const chartAccent: Record<MetricKey, string> = {
  sst: "#ff5b4f",
  chlorophyll: "#31f48f",
  biodiversity: "#8f67ff",
  health: "#38eaff",
  risks: "#ff7a1a",
};

const metricSections = ["sst", "chlorophyll", "biodiversity", "health"] as const;

export function InsightDrawer() {
  const drawerOpen = useDashboardStore((state) => state.drawerOpen);
  const selectedMetric = useDashboardStore((state) => state.selectedMetric);
  const selectedLocationId = useDashboardStore((state) => state.selectedLocationId);
  const setSelectedMetric = useDashboardStore((state) => state.setSelectedMetric);
  const setDrawerOpen = useDashboardStore((state) => state.setDrawerOpen);
  const [chartMode, setChartMode] = useState<ChartMode>("all");

  const activeKey = normalizeMetricKey(selectedMetric);
  const selectedKpi = kpis.find((kpi) => kpi.id === activeKey);
  const analysis = metricAnalysis[activeKey];
  const accent = chartAccent[activeKey];

  useEffect(() => {
    if (drawerOpen) {
      setChartMode("all");
    }
  }, [drawerOpen, activeKey]);

  const barOption = useMemo(() => ({
    backgroundColor: "transparent",
    color: [accent],
    tooltip: { trigger: "axis" },
    grid: { left: 42, right: 18, top: 24, bottom: 36 },
    xAxis: { type: "category", data: analysis.barCategories, axisLabel: { color: "#a9bed5", interval: 0, rotate: 20 } },
    yAxis: { type: "value", axisLabel: { color: "#a9bed5" }, splitLine: { lineStyle: { color: "rgba(160,200,230,.12)" } } },
    series: [{ type: "bar", data: analysis.barValues, barWidth: 16, itemStyle: { borderRadius: [4, 4, 0, 0] } }],
  }), [accent, analysis.barCategories, analysis.barValues]);

  const pieOption = useMemo(() => ({
    backgroundColor: "transparent",
    color: [accent, "#31f48f", "#2b98ff", "#8f67ff", "#ffb12f", "#38eaff"],
    tooltip: { trigger: "item" },
    series: [{ type: "pie", radius: ["42%", "72%"], label: { color: "#dceeff", formatter: "{b}" }, data: analysis.pieSegments }],
  }), [accent, analysis.pieSegments]);

  const scatterOption = useMemo(() => ({
    backgroundColor: "transparent",
    tooltip: { trigger: "item" },
    grid: { left: 42, right: 18, top: 24, bottom: 36 },
    xAxis: { type: "value", name: "Driver", nameTextStyle: { color: "#a9bed5" }, axisLabel: { color: "#a9bed5" }, splitLine: { lineStyle: { color: "rgba(160,200,230,.1)" } } },
    yAxis: { type: "value", name: analysis.scatterName, nameTextStyle: { color: "#a9bed5" }, axisLabel: { color: "#a9bed5" }, splitLine: { lineStyle: { color: "rgba(160,200,230,.1)" } } },
    series: [{ type: "scatter", symbolSize: 14, data: analysis.scatterData, itemStyle: { color: accent } }],
  }), [accent, analysis.scatterData, analysis.scatterName]);

  const heatOption = useMemo(() => {
    const heatValues = analysis.heatData.map((point) => point[2]);
    const heatMin = Math.min(...heatValues, 0);
    const heatMax = Math.max(...heatValues, 1);

    return {
      backgroundColor: "transparent",
      tooltip: { position: "top" },
      grid: { left: 54, right: 18, top: 20, bottom: 42 },
      xAxis: { type: "category", data: analysis.heatX, axisLabel: { color: "#a9bed5", interval: 0, rotate: 20 } },
      yAxis: { type: "category", data: analysis.heatY, axisLabel: { color: "#a9bed5" } },
      visualMap: { min: heatMin, max: heatMax, show: false, inRange: { color: ["#103c6a", "#18c8d8", "#ffcf49", "#ff5b4f"] } },
      series: [{ type: "heatmap", data: analysis.heatData }],
    };
  }, [analysis.heatData, analysis.heatX, analysis.heatY]);

  const visibleCharts = [
    { id: "bar", title: analysis.barTitle, icon: BarChart3, option: barOption },
    { id: "pie", title: analysis.pieTitle, icon: PieChart, option: pieOption },
    { id: "scatter", title: analysis.scatterTitle, icon: ScatterChart, option: scatterOption },
    { id: "heatmap", title: analysis.heatTitle, icon: Grid3X3, option: heatOption },
  ].filter((chart) => chartMode === "all" || chart.id === chartMode);

  return (
    <AnimatePresence>
      {drawerOpen && (
        <motion.aside
          className="insight-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="RAPID-AI data analysis panel"
          initial={{ opacity: 0, x: "100%" }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: "100%" }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          style={{ "--drawer-accent": accent } as CSSProperties}
        >
          <header>
            <div>
              <small>{analysis.subtitle}</small>
              <h2>{analysis.title}</h2>
              {selectedKpi && <p><strong>{selectedKpi.value}</strong> {selectedKpi.unit} <span>{selectedKpi.delta}</span></p>}
              {selectedLocationId && <em>{selectedLocationId.replaceAll("-", " ")}</em>}
            </div>
            <Button variant="icon" type="button" aria-label="Close detail panel" onClick={() => setDrawerOpen(false)}>
              <X size={20} />
            </Button>
          </header>

          <nav className="drawer-section-tabs" aria-label="Analysis sections">
            {metricSections.map((section) => (
              <button
                key={section}
                type="button"
                className={activeKey === section ? "active" : ""}
                onClick={() => setSelectedMetric(section)}
              >
                {metricAnalysis[section].title}
              </button>
            ))}
          </nav>

          <p className="drawer-summary">{analysis.summary}</p>

          <div className="chart-mode-tabs" aria-label="Chart type">
            {chartModes.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className={chartMode === id ? "active" : ""} onClick={() => setChartMode(id)}>
                <Icon size={15} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <section className={`drawer-chart-grid ${chartMode !== "all" ? "single" : ""}`}>
            {visibleCharts.map(({ id, title, icon: Icon, option }) => (
              <article key={id}>
                <h3><Icon size={16} />{title}</h3>
                <ReactECharts option={option} className="drawer-chart" />
              </article>
            ))}
          </section>

          <section className="drawer-insights" aria-label="Key findings">
            {analysis.insights.map((insight) => (
              <article key={insight}>
                <span />
                <p>{insight}</p>
              </article>
            ))}
          </section>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function normalizeMetricKey(metric: string): MetricKey {
  if (metric === "sst" || metric === "chlorophyll" || metric === "biodiversity" || metric === "health" || metric === "risks") {
    return metric;
  }
  return "health";
}
