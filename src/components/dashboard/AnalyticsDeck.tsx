import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { Activity, HeartPulse } from "lucide-react";
import { useDashboardStore } from "../../store";

type AnalyticsView = "biodiversity" | "health";

const sections = [
  {
    id: "biodiversity",
    title: "Biodiversity Distribution",
    icon: Activity,
    value: "2,132",
    summary: "tracked species",
  },
  {
    id: "health",
    title: "Ocean Health Score",
    icon: HeartPulse,
    value: "75/100",
    summary: "regional average",
  },
] as const;

const analyticsLocations: Record<AnalyticsView, { label: string; lat: number; lng: number; zoom: number; metric: string }> = {
  biodiversity: { label: "Andaman biodiversity distribution", lat: 11.74, lng: 92.65, zoom: 6, metric: "biodiversity" },
  health: { label: "Lakshadweep ocean health score", lat: 10.57, lng: 72.64, zoom: 6, metric: "health" },
};

export function AnalyticsDeck() {
  const [activeView, setActiveView] = useState<AnalyticsView>("biodiversity");
  const setMapFocus = useDashboardStore((state) => state.setMapFocus);

  function selectAnalyticsView(id: AnalyticsView) {
    const location = analyticsLocations[id];
    setActiveView(id);
    setMapFocus({
      id: `analytics-${id}`,
      ...location,
      message: `${location.label} selected from Analytics.`,
    });
  }

  useEffect(() => {
    selectAnalyticsView("biodiversity");
  }, []);

  const biodiversityOption = useMemo(() => ({
    backgroundColor: "transparent",
    color: ["#f9c846", "#2b98ff", "#8f67ff", "#31f48f"],
    grid: { left: 34, right: 20, top: 22, bottom: 28 },
    xAxis: { type: "category", data: ["Coral", "Fish", "Mammals", "Mollusks"], axisLabel: { color: "#89a7c4", fontSize: 10 }, axisLine: { lineStyle: { color: "rgba(140,190,230,.18)" } } },
    yAxis: { type: "value", axisLabel: { color: "#89a7c4", fontSize: 10 }, splitLine: { lineStyle: { color: "rgba(140,190,230,.1)" } } },
    series: [{ type: "bar", barWidth: 28, data: [412, 1248, 125, 347], itemStyle: { borderRadius: [5, 5, 0, 0] } }],
  }), []);

  const healthOption = useMemo(() => ({
    backgroundColor: "transparent",
    grid: { left: 34, right: 20, top: 22, bottom: 28 },
    xAxis: { type: "category", data: ["Dec", "Jan", "Feb", "Mar", "Apr", "May"], axisLabel: { color: "#89a7c4", fontSize: 10 }, axisLine: { lineStyle: { color: "rgba(140,190,230,.18)" } } },
    yAxis: { type: "value", min: 0, max: 100, axisLabel: { color: "#89a7c4", fontSize: 10 }, splitLine: { lineStyle: { color: "rgba(140,190,230,.1)" } } },
    series: [{ type: "line", smooth: true, symbolSize: 7, data: [58, 72, 64, 81, 69, 86], lineStyle: { color: "#57f08c", width: 3 }, itemStyle: { color: "#57f08c" }, areaStyle: { color: "rgba(49, 244, 143, .14)" } }],
  }), []);

  const detail = {
    biodiversity: {
      title: "Biodiversity Distribution",
      chart: biodiversityOption,
      facts: [["Coral Species", "412"], ["Fish Species", "1,248"], ["Mammals", "125"], ["Mollusks", "347"]],
    },
    health: {
      title: "Ocean Health Score",
      chart: healthOption,
      facts: [["Average Score", "75/100"], ["Change", "+7.2%"], ["Status", "Improving"]],
    },
  }[activeView];

  return (
    <section className="analytics-deck interactive-analytics">
      <div className="analytics-section-grid" aria-label="Analytics sections">
        {sections.map(({ id, title, icon: Icon, value, summary }) => (
          <button
            key={id}
            type="button"
            className={activeView === id ? "active" : ""}
            onClick={() => selectAnalyticsView(id)}
          >
            <span><Icon size={20} /></span>
            <strong>{title}</strong>
            <b>{value}</b>
            <small>{summary}</small>
          </button>
        ))}
      </div>

      <article className="analytics-detail-panel">
        <header>
          <h2>{detail.title}</h2>
        </header>
        <ReactECharts option={detail.chart} className="analytics-detail-chart" />
        <footer>
          {detail.facts.map(([label, value]) => (
            <span key={label}>{label} <b>{value}</b></span>
          ))}
        </footer>
      </article>
    </section>
  );
}
