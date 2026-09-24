import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dna, Fish, Globe2, MapPin, Search, ShieldCheck } from "lucide-react";
import { fetchLiveOceanRegions, fetchMarineMarkers } from "../../api";
import { useDashboardStore } from "../../store";
import type { BiodiversitySpecies, MarineMarker } from "../../types";

type BiodiversityArea = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  source: string;
  species: BiodiversitySpecies[];
};

const regionalSpecies: Record<string, BiodiversitySpecies[]> = {
  "arabian sea": [
    species("Indian oil sardine", "Sardinella longiceps", "Fish", "Common", 91, "Pelagic shelf waters", "RAPID-AI fisheries + OBIS baseline"),
    species("Indian mackerel", "Rastrelliger kanagurta", "Fish", "Common", 89, "Coastal and offshore schools", "RAPID-AI fisheries + OBIS baseline"),
    species("Yellowfin tuna", "Thunnus albacares", "Fish", "Near threatened", 82, "Open ocean pelagic zone", "RAPID-AI fisheries + OBIS baseline"),
    species("Skipjack tuna", "Katsuwonus pelamis", "Fish", "Least concern", 84, "Warm pelagic waters", "RAPID-AI fisheries + OBIS baseline"),
    species("Whale shark", "Rhincodon typus", "Shark", "Endangered", 74, "Productive offshore fronts", "RAPID-AI biodiversity baseline"),
    species("Green sea turtle", "Chelonia mydas", "Reptile", "Endangered", 71, "Coastal feeding corridors", "RAPID-AI biodiversity baseline"),
  ],
  "bay of bengal": [
    species("Hilsa shad", "Tenualosa ilisha", "Fish", "Least concern", 88, "Delta, estuary, and coastal waters", "RAPID-AI fisheries + OBIS baseline"),
    species("Indian mackerel", "Rastrelliger kanagurta", "Fish", "Common", 79, "Coastal pelagic schools", "RAPID-AI fisheries + OBIS baseline"),
    species("Yellowfin tuna", "Thunnus albacares", "Fish", "Near threatened", 76, "Offshore pelagic zone", "RAPID-AI fisheries + OBIS baseline"),
    species("Olive ridley turtle", "Lepidochelys olivacea", "Reptile", "Vulnerable", 83, "Nesting and nearshore migration corridor", "RAPID-AI biodiversity baseline"),
    species("Irrawaddy dolphin", "Orcaella brevirostris", "Mammal", "Endangered", 68, "Estuarine and shallow coastal habitat", "RAPID-AI biodiversity baseline"),
    species("Tiger prawn", "Penaeus monodon", "Crustacean", "Common", 81, "Deltaic and muddy coastal bottoms", "RAPID-AI biodiversity baseline"),
  ],
  lakshadweep: [
    species("Skipjack tuna", "Katsuwonus pelamis", "Fish", "Least concern", 88, "Atoll-adjacent pelagic waters", "RAPID-AI fisheries + OBIS baseline"),
    species("Yellowfin tuna", "Thunnus albacares", "Fish", "Near threatened", 85, "Deep reef slopes and pelagic fronts", "RAPID-AI fisheries + OBIS baseline"),
    species("Manta ray", "Mobula birostris", "Ray", "Endangered", 72, "Reef channels and plankton-rich waters", "RAPID-AI biodiversity baseline"),
    species("Green sea turtle", "Chelonia mydas", "Reptile", "Endangered", 79, "Seagrass and reef foraging areas", "RAPID-AI biodiversity baseline"),
    species("Table coral", "Acropora hyacinthus", "Coral", "Vulnerable", 83, "Shallow reef flats", "RAPID-AI reef baseline"),
    species("Dugong", "Dugong dugon", "Mammal", "Vulnerable", 57, "Seagrass-linked lagoon habitat", "RAPID-AI biodiversity baseline"),
  ],
  "andaman sea": [
    species("Reef manta ray", "Mobula alfredi", "Ray", "Vulnerable", 76, "Island channels and reef slopes", "RAPID-AI biodiversity baseline"),
    species("Napoleon wrasse", "Cheilinus undulatus", "Fish", "Endangered", 73, "Coral reef habitat", "RAPID-AI biodiversity baseline"),
    species("Hawksbill turtle", "Eretmochelys imbricata", "Reptile", "Critically endangered", 69, "Reef and lagoon systems", "RAPID-AI biodiversity baseline"),
    species("Staghorn coral", "Acropora cervicornis", "Coral", "Critically endangered", 72, "Shallow reef habitat", "RAPID-AI reef baseline"),
  ],
  "lakshadweep sea": [
    species("Skipjack tuna", "Katsuwonus pelamis", "Fish", "Least concern", 88, "Atoll-adjacent pelagic waters", "RAPID-AI fisheries + OBIS baseline"),
    species("Yellowfin tuna", "Thunnus albacares", "Fish", "Near threatened", 85, "Deep reef slopes and pelagic fronts", "RAPID-AI fisheries + OBIS baseline"),
    species("Manta ray", "Mobula birostris", "Ray", "Endangered", 72, "Reef channels and plankton-rich waters", "RAPID-AI biodiversity baseline"),
    species("Green sea turtle", "Chelonia mydas", "Reptile", "Endangered", 79, "Seagrass and reef foraging areas", "RAPID-AI biodiversity baseline"),
    species("Table coral", "Acropora hyacinthus", "Coral", "Vulnerable", 83, "Shallow reef flats", "RAPID-AI reef baseline"),
  ],
  "coral sea": [
    species("Staghorn coral", "Acropora cervicornis", "Coral", "Critically endangered", 82, "Shallow reef crest", "RAPID-AI reef baseline"),
    species("Table coral", "Acropora hyacinthus", "Coral", "Vulnerable", 81, "Reef flats and slopes", "RAPID-AI reef baseline"),
    species("Green sea turtle", "Chelonia mydas", "Reptile", "Endangered", 77, "Reef and seagrass areas", "RAPID-AI biodiversity baseline"),
  ],
};

export function BiodiversityExplorerPanel() {
  const selectedLocationId = useDashboardStore((state) => state.selectedLocationId);
  const uploadedMarkers = useDashboardStore((state) => state.uploadedMarkers);
  const setMapFocus = useDashboardStore((state) => state.setMapFocus);
  const { data: defaultMarkers = [] } = useQuery({ queryKey: ["marine-markers"], queryFn: fetchMarineMarkers });
  const { data: liveRegions = [] } = useQuery({
    queryKey: ["live-ocean-regions"],
    queryFn: fetchLiveOceanRegions,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);

  const areas = useMemo(() => {
    const markerAreas = markersToAreas(uploadedMarkers.length ? uploadedMarkers : defaultMarkers);
    const liveAreas = liveRegions.map((region) => ({
      id: `live-${region.id}`,
      name: region.name,
      region: region.name,
      lat: region.lat,
      lng: region.lng,
      source: region.source,
      species: speciesForRegion(region.name),
    }));
    return mergeAreas([...markerAreas, ...liveAreas]);
  }, [defaultMarkers, liveRegions, uploadedMarkers]);

  useEffect(() => {
    if (!areas.length) return;
    const selectedArea = findAreaFromSelection(areas, selectedLocationId);
    const nextArea = selectedArea ?? areas.find((area) => area.id === activeAreaId) ?? areas[0];
    setActiveAreaId(nextArea.id);
    setMapFocus({
      id: nextArea.id,
      label: nextArea.name,
      lat: nextArea.lat,
      lng: nextArea.lng,
      zoom: 6,
      metric: "biodiversity",
      message: `${nextArea.name} biodiversity area selected with ${nextArea.species.length} species.`,
    });
  }, [areas, selectedLocationId]);

  const activeArea = areas.find((area) => area.id === activeAreaId) ?? areas[0];
  const speciesList = activeArea?.species ?? [];
  const taxonSummary = countBy(speciesList, "taxon_group");

  function selectArea(area: BiodiversityArea) {
    setActiveAreaId(area.id);
    setMapFocus({
      id: area.id,
      label: area.name,
      lat: area.lat,
      lng: area.lng,
      zoom: 6,
      metric: "biodiversity",
      message: `${area.name} biodiversity area selected with ${area.species.length} species.`,
    });
  }

  return (
    <section className="biodiversity-explorer-panel glass-panel" aria-label="Biodiversity explorer">
      <header>
        <div>
          <span><Globe2 size={16} />Selected Area Species</span>
          <h2>Biodiversity Explorer</h2>
          <p>{activeArea ? `${activeArea.name} / ${activeArea.region}` : "Select a map area to inspect species."}</p>
        </div>
        <strong>{speciesList.length} species</strong>
      </header>

      <div className="biodiversity-area-row" aria-label="Available selected areas">
        {areas.map((area) => (
          <button
            key={area.id}
            type="button"
            className={activeArea?.id === area.id ? "active" : ""}
            onClick={() => selectArea(area)}
          >
            <MapPin size={14} />
            <span>{area.name}</span>
          </button>
        ))}
      </div>

      {activeArea && (
        <div className="biodiversity-selected-summary">
          <article>
            <Search size={18} />
            <div>
              <strong>{activeArea.name}</strong>
              <small>{activeArea.lat.toFixed(2)}, {activeArea.lng.toFixed(2)} / {activeArea.source}</small>
            </div>
          </article>
          <article>
            <Dna size={18} />
            <div>
              <strong>{Object.keys(taxonSummary).length} groups</strong>
              <small>{Object.entries(taxonSummary).map(([name, count]) => `${name} ${count}`).join(" / ")}</small>
            </div>
          </article>
          <article>
            <ShieldCheck size={18} />
            <div>
              <strong>{speciesList.filter((item) => item.status.toLowerCase().includes("endangered") || item.status.toLowerCase().includes("vulnerable")).length} sensitive</strong>
              <small>Conservation watch species in this area</small>
            </div>
          </article>
        </div>
      )}

      <div className="biodiversity-species-grid">
        {speciesList.map((item) => (
          <article key={`${activeArea?.id}-${item.scientific_name}`}>
            <span><Fish size={18} /></span>
            <div>
              <h3>{item.common_name}</h3>
              <p>{item.scientific_name}</p>
              <dl>
                <div><dt>Group</dt><dd>{item.taxon_group}</dd></div>
                <div><dt>Status</dt><dd>{item.status}</dd></div>
                <div><dt>Confidence</dt><dd>{item.confidence}%</dd></div>
                <div><dt>Habitat</dt><dd>{item.habitat}</dd></div>
              </dl>
              <small>{item.source}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function species(
  common_name: string,
  scientific_name: string,
  taxon_group: string,
  status: string,
  confidence: number,
  habitat: string,
  source: string,
): BiodiversitySpecies {
  return { common_name, scientific_name, taxon_group, status, confidence, habitat, source };
}

function markersToAreas(markers: MarineMarker[]): BiodiversityArea[] {
  return markers.filter((marker) => marker.type === "biodiversity" || Boolean(marker.metrics.Species)).map((marker) => {
    const uploadedSpecies = marker.metrics.Species;
    return {
      id: marker.id,
      name: marker.name,
      region: marker.region,
      lat: marker.lat,
      lng: marker.lng,
      source: marker.layer,
      species: uploadedSpecies
        ? [species(uploadedSpecies, uploadedSpecies, "Uploaded record", "Observed", 100, marker.region, "Uploaded dataset")]
        : speciesForRegion(marker.region),
    };
  });
}

function speciesForRegion(region: string) {
  const normalized = region.toLowerCase();
  const exact = regionalSpecies[normalized];
  if (exact) return exact;
  const matchedKey = Object.keys(regionalSpecies).find((key) => normalized.includes(key) || key.includes(normalized));
  return matchedKey ? regionalSpecies[matchedKey] : [
    species("Yellowfin tuna", "Thunnus albacares", "Fish", "Near threatened", 72, "Pelagic waters", "RAPID-AI regional baseline"),
    species("Green sea turtle", "Chelonia mydas", "Reptile", "Endangered", 68, "Coastal and reef-linked habitat", "RAPID-AI regional baseline"),
    species("Indian mackerel", "Rastrelliger kanagurta", "Fish", "Common", 70, "Coastal pelagic habitat", "RAPID-AI regional baseline"),
  ];
}

function mergeAreas(areas: BiodiversityArea[]) {
  const seen = new Set<string>();
  return areas.filter((area) => {
    if (seen.has(area.id)) return false;
    seen.add(area.id);
    return true;
  });
}

function findAreaFromSelection(areas: BiodiversityArea[], selectedLocationId: string | null) {
  if (!selectedLocationId) return null;
  const direct = areas.find((area) => area.id === selectedLocationId);
  if (direct) return direct;
  const coordinates = selectedLocationId.match(/location-(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)/);
  if (!coordinates) return null;
  const lat = Number(coordinates[1]);
  const lng = Number(coordinates[2]);
  return areas.reduce((closest, area) => {
    const distance = Math.hypot(area.lat - lat, area.lng - lng);
    if (!closest || distance < closest.distance) return { area, distance };
    return closest;
  }, null as { area: BiodiversityArea; distance: number } | null)?.area ?? null;
}

function countBy(items: BiodiversitySpecies[], key: keyof BiodiversitySpecies) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key]);
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}
