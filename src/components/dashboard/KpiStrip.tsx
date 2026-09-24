import { motion } from "framer-motion";
import { kpis } from "../../data/dashboard";
import { useDashboardStore } from "../../store";
import biodiversityLogo from "../../assets/biodiversity-logo.png";
import chlorophyllLogo from "../../assets/chlorophyll-logo.png";
import oceanHealthLogo from "../../assets/ocean-health-logo.png";
import seaSurfaceTempLogo from "../../assets/sea-surface-temp-logo.png";

const metricLogos: Partial<Record<string, string>> = {
  sst: seaSurfaceTempLogo,
  chlorophyll: chlorophyllLogo,
  biodiversity: biodiversityLogo,
  health: oceanHealthLogo,
};

export function KpiStrip() {
  const selectedMetric = useDashboardStore((state) => state.selectedMetric);
  const setSelectedMetric = useDashboardStore((state) => state.setSelectedMetric);
  const setDrawerOpen = useDashboardStore((state) => state.setDrawerOpen);

  return (
    <section className="metric-grid" aria-label="Ocean metrics">
      {kpis.map((metric, index) => {
        const metricLogo = metricLogos[metric.id];
        const isLogoOnly = Boolean(metricLogo);
        return (
          <motion.article
            key={metric.id}
            className={`metric-card ${metric.tone} ${isLogoOnly ? "metric-logo-only" : ""} ${selectedMetric === metric.id ? "selected" : ""}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            role="button"
            tabIndex={0}
            aria-label={metric.title}
            title={metric.title}
            onClick={() => {
              setSelectedMetric(metric.id);
              setDrawerOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedMetric(metric.id);
                setDrawerOpen(true);
              }
            }}
          >
            <span className="metric-icon">
              {metricLogo ? <img src={metricLogo} alt="" /> : null}
            </span>
            {!isLogoOnly && (
              <div className="metric-copy">
                <h3>{metric.title}</h3>
                <p>{metric.description}</p>
              </div>
            )}
          </motion.article>
        );
      })}
    </section>
  );
}
