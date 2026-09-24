import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Thermometer, Waves, Wind } from "lucide-react";
import { fetchLiveOceanRegions } from "../../api";
import { useDashboardStore } from "../../store";

type LiveOceanPanelProps = {
  variant?: "rail" | "stats";
};

function display(value: number | null | undefined, unit: string) {
  return value == null ? "N/A" : `${value} ${unit}`;
}

export function LiveOceanPanel({ variant = "rail" }: LiveOceanPanelProps) {
  const isStats = variant === "stats";
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const setMapFocus = useDashboardStore((state) => state.setMapFocus);
  const dataRefreshMinutes = useDashboardStore((state) => state.dataRefreshMinutes);
  const { data: regions = [], isFetching, error } = useQuery({
    queryKey: ["live-ocean-regions"],
    queryFn: fetchLiveOceanRegions,
    refetchInterval: dataRefreshMinutes * 60 * 1000,
    staleTime: Math.max(1, Math.floor(dataRefreshMinutes / 2)) * 60 * 1000,
  });
  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === selectedRegionId) ?? regions[0],
    [regions, selectedRegionId],
  );

  function selectRegion(region: NonNullable<typeof selectedRegion>) {
    setSelectedRegionId(region.id);
    setMapFocus({
      id: `live-${region.id}`,
      label: region.name,
      lat: region.lat,
      lng: region.lng,
      zoom: 5,
      metric: "health",
      message: `${region.name} live ocean stats selected.`,
    });
  }

  useEffect(() => {
    if (isStats && regions.length && !selectedRegionId) {
      selectRegion(regions[0]);
    }
  }, [isStats, regions, selectedRegionId]);

  if (isStats) {
    return (
      <motion.section
        className="live-ocean-panel live-ocean-stats-panel glass-panel"
        aria-label="Live ocean updates"
        initial={{ opacity: 0, x: 72 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.34, ease: "easeOut" }}
      >
        <header>
          <div>
            <h2>Live</h2>
            <p>Arabian Sea, Bay of Bengal, Lakshadweep</p>
          </div>
          <RefreshCw size={17} className={isFetching ? "spin" : ""} aria-hidden="true" />
        </header>

        {error && <p className="live-ocean-error">Live feed unavailable. Showing upload and map tools only.</p>}

        <div className="live-ocean-hex-layout">
          <div className="live-ocean-hex-grid" aria-label="Live ocean regions">
            {regions.map((region) => (
              <button
                key={region.id}
                type="button"
                className={`live-ocean-hex-card ${region.risk.toLowerCase()} ${selectedRegion?.id === region.id ? "active" : ""}`}
                onClick={() => selectRegion(region)}
              >
                <span><AlertTriangle size={14} />{region.risk}</span>
                <strong>{region.name}</strong>
                <small>{display(region.metrics.wave_height_m, "m")} waves</small>
              </button>
            ))}
          </div>

          {selectedRegion && (
            <article className={`live-ocean-detail-card ${selectedRegion.risk.toLowerCase()}`} aria-live="polite">
              <header>
                <div>
                  <h3>{selectedRegion.name}</h3>
                  <p>{selectedRegion.summary}</p>
                </div>
                <span><AlertTriangle size={14} />{selectedRegion.risk}</span>
              </header>
              <dl>
                <div><Waves size={16} /><dt>Wave Height</dt><dd>{display(selectedRegion.metrics.wave_height_m, "m")}</dd></div>
                <div><Wind size={16} /><dt>Wind Speed</dt><dd>{display(selectedRegion.metrics.wind_speed_kmh, "km/h")}</dd></div>
                <div><Thermometer size={16} /><dt>Sea Surface Temp</dt><dd>{display(selectedRegion.metrics.sea_surface_temperature_c, "C")}</dd></div>
              </dl>
              <small>{selectedRegion.observed_at} / {selectedRegion.source}</small>
            </article>
          )}
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      className="live-ocean-panel glass-panel"
      aria-label="Live ocean updates"
      initial={false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
    >
      <header>
        <div>
          <h2>Live</h2>
          <p>Arabian Sea, Bay of Bengal, Lakshadweep</p>
        </div>
        <RefreshCw size={17} className={isFetching ? "spin" : ""} aria-hidden="true" />
      </header>

      {error && <p className="live-ocean-error">Live feed unavailable. Showing upload and map tools only.</p>}

      <div className="live-ocean-list">
        {regions.map((region) => (
          <article key={region.id} className={`live-ocean-card ${region.risk.toLowerCase()}`}>
            <header>
              <strong>{region.name}</strong>
              <span><AlertTriangle size={13} />{region.risk}</span>
            </header>
            <p>{region.summary}</p>
            <dl>
              <div><Waves size={15} /><dt>Wave</dt><dd>{display(region.metrics.wave_height_m, "m")}</dd></div>
              <div><Wind size={15} /><dt>Wind</dt><dd>{display(region.metrics.wind_speed_kmh, "km/h")}</dd></div>
              <div><Thermometer size={15} /><dt>SST</dt><dd>{display(region.metrics.sea_surface_temperature_c, "C")}</dd></div>
            </dl>
            <small>{region.observed_at} / {region.source}</small>
          </article>
        ))}
      </div>
    </motion.section>
  );
}
