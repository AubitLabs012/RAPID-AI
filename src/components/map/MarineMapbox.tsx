import { type CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import L, { type LayerGroup, type Map as LeafletMap, type TileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";
import * as THREE from "three";
import { useQuery } from "@tanstack/react-query";
import { Crosshair, Globe2, Layers3, LocateFixed, Map, Maximize2, Minus, Plus, Radar, Search, Satellite } from "lucide-react";
import { fetchLiveOceanRegions, fetchMarineMarkers } from "../../api";
import { marineLayers } from "../../data/dashboard";
import { useDashboardStore } from "../../store";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import earthTextureUrl from "../../assets/earth-atmos-2048.jpg";
import cloudTextureUrl from "../../assets/earth-clouds-1024.png";

import { createBaseLayer, type MapMode } from "./mapLayers";

type RiskZone = {
  id: string;
  name: string;
  risk: string;
  severity: "High" | "Medium";
  color: string;
  coordinates: [number, number][];
};

const mapModes = [
  { id: "normal", icon: Map, label: "Normal" },
  { id: "satellite", icon: Satellite, label: "Satellite" },
  { id: "risks", icon: Radar, label: "Risks" },
] as const;

const markerColors: Record<string, string> = {
  sst: "#ff5b4f",
  chlorophyll: "#31f48f",
  fisheries: "#2b98ff",
  biodiversity: "#8f67ff",
  coral: "#f9c846",
  currents: "#44eaff",
  health: "#00b4d8",
};

function pinIcon(color: string) {
  return L.divIcon({
    className: "marine-pin-marker",
    iconSize: [34, 42],
    iconAnchor: [17, 38],
    popupAnchor: [0, -34],
    html: `<span style="--pin-color: ${color}"><i></i></span>`,
  });
}

const riskZones: RiskZone[] = [
  { id: "bay-bengal-cyclone", name: "Bay of Bengal Cyclone Corridor", risk: "Cyclone", severity: "High", color: "#ff7a1a", coordinates: [[6, 78], [8, 93], [20, 96], [23, 88], [18, 80]] },
  { id: "arabian-sea-cyclone", name: "Arabian Sea Cyclone Corridor", risk: "Cyclone", severity: "Medium", color: "#ffc72c", coordinates: [[7, 58], [8, 72], [21, 75], [24, 65], [18, 56]] },
  { id: "sunda-tsunami", name: "Sunda Trench Tsunami Watch", risk: "Tsunami", severity: "High", color: "#bd5cff", coordinates: [[-10, 92], [-12, 112], [4, 114], [8, 98], [0, 90]] },
  { id: "delta-flood", name: "Low-Lying Delta Flood Risk", risk: "Storm Surge", severity: "Medium", color: "#35d0ff", coordinates: [[18, 86], [18, 92], [23, 93], [24, 88], [21, 84]] },
  { id: "coral-thermal-stress", name: "Great Barrier Reef Thermal Stress", risk: "Bleaching", severity: "High", color: "#ff4e61", coordinates: [[-23, 145], [-21, 153], [-14, 153], [-12, 146], [-18, 142]] },
];

function popupHtml(title: string, detail: string) {
  return `<strong>${title}</strong><span>${detail}</span>`;
}

function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function createStarField() {
  const geometry = new THREE.BufferGeometry();
  const vertices: number[] = [];

  for (let i = 0; i < 900; i += 1) {
    const radius = 10 + Math.random() * 18;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    vertices.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
    );
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: "#d7edff", size: 0.025, sizeAttenuation: true, transparent: true, opacity: 0.82 }),
  );
}

function createOceanWaveMaterial(earthTexture: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      earthMap: { value: earthTexture },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;

      void main() {
        vUv = uv;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D earthMap;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormalView;

      void main() {
        vec3 tex = texture2D(earthMap, vUv).rgb;
        float blueDominance = tex.b - max(tex.r, tex.g) * 0.72;
        float oceanMask = smoothstep(0.015, 0.18, blueDominance);
        float lightWater = smoothstep(0.36, 0.68, tex.b) * smoothstep(-0.08, 0.12, tex.b - tex.r);
        oceanMask = clamp(oceanMask + lightWater * 0.45, 0.0, 1.0);

        vec2 flow = vUv + vec2(uTime * 0.018, sin(vUv.y * 12.0 + uTime * 0.55) * 0.012);
        float waveA = sin((flow.x * 76.0) + (flow.y * 28.0) + uTime * 2.15);
        float waveB = sin((flow.x * -38.0) + (flow.y * 58.0) - uTime * 1.55);
        float waveC = sin((flow.x * 120.0) + uTime * 3.2);
        float crest = smoothstep(1.18, 1.86, waveA + waveB * 0.72 + waveC * 0.22);
        float fresnel = pow(1.0 - clamp(dot(vNormalView, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 2.0);
        float alpha = oceanMask * crest * (0.18 + fresnel * 0.52);

        vec3 deepBlue = vec3(0.02, 0.30, 0.52);
        vec3 foam = vec3(0.78, 0.96, 1.0);
        vec3 color = mix(deepBlue, foam, crest);
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function MarineMapbox() {
  const globeNode = useRef<HTMLDivElement | null>(null);
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const baseLayerRef = useRef<TileLayer | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const signalLayerRef = useRef<LayerGroup | null>(null);
  const riskLayerRef = useRef<LayerGroup | null>(null);
  const mapModeRef = useRef<MapMode>("normal");
  const lastMapFocusRef = useRef<string | null>(null);
  const globeZoomRef = useRef(1);
  const [query, setQuery] = useState("");
  const [coordinates, setCoordinates] = useState("LAT 12.85 N  LON 80.27 E");
  const [mapMode, setMapMode] = useState<MapMode>("normal");
  const [mapOpen, setMapOpen] = useState(false);
  const [globeZoom, setGlobeZoom] = useState(1);
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(marineLayers.map((layer) => [layer.id, layer.enabled])),
  );
  const setSatelliteEnabled = useDashboardStore((state) => state.setSatelliteEnabled);
  const setSelectedMetric = useDashboardStore((state) => state.setSelectedMetric);
  const setSelectedLocationId = useDashboardStore((state) => state.setSelectedLocationId);
  const setDrawerOpen = useDashboardStore((state) => state.setDrawerOpen);
  const setAssistantMessage = useDashboardStore((state) => state.setAssistantMessage);
  const dataRefreshMinutes = useDashboardStore((state) => state.dataRefreshMinutes);
  const mapLabels = useDashboardStore((state) => state.mapLabels);
  const uploadedMarkers = useDashboardStore((state) => state.uploadedMarkers);
  const uploadAnalysis = useDashboardStore((state) => state.uploadAnalysis);
  const mapFocus = useDashboardStore((state) => state.mapFocus);
  const { data: defaultMarkers = [] } = useQuery({ queryKey: ["marine-markers"], queryFn: fetchMarineMarkers });
  const { data: liveRegions = [] } = useQuery({
    queryKey: ["live-ocean-regions"],
    queryFn: fetchLiveOceanRegions,
    refetchInterval: dataRefreshMinutes * 60 * 1000,
    staleTime: Math.max(1, Math.floor(dataRefreshMinutes / 2)) * 60 * 1000,
  });
  const liveMarkers = useMemo(
    () =>
      liveRegions.map((region) => ({
        id: `live-${region.id}`,
        name: region.name,
        region: "Live Ocean",
        layer: "Ocean Health",
        type: "health" as const,
        lat: region.lat,
        lng: region.lng,
        summary: region.summary,
        metrics: {
          Risk: region.risk,
          Wave: region.metrics.wave_height_m == null ? "N/A" : `${region.metrics.wave_height_m} m`,
          Wind: region.metrics.wind_speed_kmh == null ? "N/A" : `${region.metrics.wind_speed_kmh} km/h`,
          SST: region.metrics.sea_surface_temperature_c == null ? "N/A" : `${region.metrics.sea_surface_temperature_c} C`,
          Current: region.metrics.ocean_current_velocity_kmh == null ? "N/A" : `${region.metrics.ocean_current_velocity_kmh} km/h`,
        },
      })),
    [liveRegions],
  );
  const markers = uploadedMarkers.length ? uploadedMarkers : defaultMarkers.length ? defaultMarkers : liveMarkers;

  const visibleMarkers = useMemo(
    () =>
      markers.filter((marker) => {
        if (marker.type === "fisheries") return false;
        const visibleByDefault = marker.type === "health" || marker.type === "currents";
        return activeLayers[marker.type] ?? visibleByDefault;
      }),
    [activeLayers, markers],
  );

  useEffect(() => {
    mapModeRef.current = mapMode;
  }, [mapMode]);

  useEffect(() => {
    globeZoomRef.current = globeZoom;
  }, [globeZoom]);

  function updateGlobeZoom(direction: "in" | "out") {
    setGlobeZoom((current) => {
      const next = direction === "in" ? current + 0.16 : current - 0.16;
      return Math.min(1.72, Math.max(0.78, Number(next.toFixed(2))));
    });
  }

  function openInteractiveMap() {
    setMapOpen(true);
  }

  useEffect(() => {
    if (mapFocus) {
      setMapOpen(true);
    }
  }, [mapFocus]);

  useEffect(() => {
    if (mapOpen || !globeNode.current) return;

    const container = globeNode.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 4.25 / globeZoomRef.current);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);
    scene.add(createStarField());

    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load(earthTextureUrl);
    const cloudTexture = textureLoader.load(cloudTextureUrl);
    earthTexture.colorSpace = THREE.SRGBColorSpace;
    cloudTexture.colorSpace = THREE.SRGBColorSpace;
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    earthTexture.anisotropy = maxAnisotropy;
    cloudTexture.anisotropy = maxAnisotropy;
    earthTexture.minFilter = THREE.LinearMipmapLinearFilter;
    earthTexture.magFilter = THREE.LinearFilter;
    cloudTexture.minFilter = THREE.LinearMipmapLinearFilter;
    cloudTexture.magFilter = THREE.LinearFilter;
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1.32, 160, 160),
      new THREE.MeshStandardMaterial({
        color: mapMode === "risks" ? "#fff0f0" : "#ffffff",
        map: earthTexture,
        roughness: 0.72,
        metalness: 0.01,
        emissive: mapMode === "risks" ? "#19060a" : "#001322",
        emissiveIntensity: mapMode === "risks" ? 0.08 : 0.025,
      }),
    );
    group.add(earth);

    const oceanWaveMaterial = createOceanWaveMaterial(earthTexture);
    const oceanWaves = new THREE.Mesh(new THREE.SphereGeometry(1.326, 160, 160), oceanWaveMaterial);
    group.add(oceanWaves);

    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.345, 128, 128),
      new THREE.MeshStandardMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: mapMode === "normal" ? 0.34 : 0.24,
        depthWrite: false,
      }),
    );
    group.add(clouds);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.38, 128, 128),
      new THREE.MeshBasicMaterial({ color: "#6ee7ff", transparent: true, opacity: 0.13, side: THREE.BackSide }),
    );
    group.add(atmosphere);

    const markerGeometry = new THREE.SphereGeometry(0.025, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: mapMode === "risks" ? "#ff9f2d" : "#f7fbff" });
    visibleMarkers.forEach((marker) => {
      const dot = new THREE.Mesh(markerGeometry, markerMaterial);
      dot.position.copy(latLngToVector3(marker.lat, marker.lng, 1.38));
      group.add(dot);
    });

    if (mapMode === "risks") {
      riskZones.forEach((zone) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.07, 0.008, 8, 28),
          new THREE.MeshBasicMaterial({ color: zone.color, transparent: true, opacity: 0.9 }),
        );
        const center = zone.coordinates.reduce(
          (acc, [lat, lng]) => ({ lat: acc.lat + lat / zone.coordinates.length, lng: acc.lng + lng / zone.coordinates.length }),
          { lat: 0, lng: 0 },
        );
        ring.position.copy(latLngToVector3(center.lat, center.lng, 1.4));
        ring.lookAt(0, 0, 0);
        group.add(ring);
      });
    }

    const light = new THREE.DirectionalLight("#ffffff", 2.35);
    light.position.set(-2, 2.4, 4);
    scene.add(light);
    scene.add(new THREE.AmbientLight("#8bdcff", 0.82));

    let frameId = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      oceanWaveMaterial.uniforms.uTime.value = elapsed;
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, 4.25 / globeZoomRef.current, 0.08);
      group.rotation.y += 0.0028;
      group.rotation.x = -0.12;
      clouds.rotation.y += 0.0011;
      oceanWaves.rotation.y -= 0.0009;
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };
    const resize = () => {
      if (!container.clientWidth || !container.clientHeight) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", resize);
    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      markerGeometry.dispose();
      markerMaterial.dispose();
      earth.geometry.dispose();
      oceanWaves.geometry.dispose();
      oceanWaveMaterial.dispose();
      clouds.geometry.dispose();
      atmosphere.geometry.dispose();
      earthTexture.dispose();
      cloudTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [mapMode, mapOpen, visibleMarkers]);

  useEffect(() => {
    if (!mapOpen || !mapNode.current || mapRef.current) return;

    const map = L.map(mapNode.current, {
      center: [8, 86],
      zoom: 4,
      minZoom: 2,
      maxZoom: 12,
      zoomControl: false,
      worldCopyJump: true,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    signalLayerRef.current = L.layerGroup().addTo(map);
    riskLayerRef.current = L.layerGroup().addTo(map);

    map.on("mousemove", (event) => {
      setCoordinates(
        `LAT ${Math.abs(event.latlng.lat).toFixed(2)} ${event.latlng.lat >= 0 ? "N" : "S"}  LON ${Math.abs(event.latlng.lng).toFixed(2)} ${event.latlng.lng >= 0 ? "E" : "W"}`,
      );
    });

    map.on("click", (event) => {
      setSelectedMetric(mapModeRef.current === "risks" ? "risks" : "health");
      setSelectedLocationId(`location-${event.latlng.lat.toFixed(3)}-${event.latlng.lng.toFixed(3)}`);
      setDrawerOpen(true);
      setAssistantMessage(
        `RAPID-AI selected ${event.latlng.lat.toFixed(2)}, ${event.latlng.lng.toFixed(2)} for ocean intelligence analysis.`,
      );
    });

    mapRef.current = map;
    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapOpen, setAssistantMessage, setDrawerOpen, setSelectedLocationId, setSelectedMetric]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapOpen || !map) return;

    baseLayerRef.current?.remove();
    baseLayerRef.current = createBaseLayer(mapMode).addTo(map);

    setSatelliteEnabled(mapMode === "satellite");
  }, [mapMode, mapOpen, setSatelliteEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapOpen || !map || !mapFocus || lastMapFocusRef.current === mapFocus.id) return;

    lastMapFocusRef.current = mapFocus.id;
    const zoom = mapFocus.zoom ?? 6;
    map.flyTo([mapFocus.lat, mapFocus.lng], zoom, { duration: 0.85 });
    setCoordinates(
      `LAT ${Math.abs(mapFocus.lat).toFixed(2)} ${mapFocus.lat >= 0 ? "N" : "S"}  LON ${Math.abs(mapFocus.lng).toFixed(2)} ${mapFocus.lng >= 0 ? "E" : "W"}`,
    );
    setSelectedLocationId(mapFocus.id);
    if (mapFocus.metric) setSelectedMetric(mapFocus.metric);
    if (mapFocus.message) setAssistantMessage(mapFocus.message);
  }, [mapFocus, mapOpen, setAssistantMessage, setSelectedLocationId, setSelectedMetric]);

  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    const signalLayer = signalLayerRef.current;
    if (!mapOpen || !markerLayer || !signalLayer) return;

    markerLayer.clearLayers();
    signalLayer.clearLayers();

    visibleMarkers.forEach((marker) => {
      const color = markerColors[marker.type] ?? "#7edcff";
      L.circle([marker.lat, marker.lng], {
        radius: marker.type === "currents" ? 120000 : 180000,
        color,
        fillColor: color,
        fillOpacity: mapMode === "risks" ? 0.08 : 0.16,
        opacity: 0.28,
        weight: 1,
      }).addTo(signalLayer);

      L.marker([marker.lat, marker.lng], { icon: pinIcon(color) })
        .bindPopup(popupHtml(marker.name, `${marker.layer} / ${marker.region}`), { className: "mission-popup" })
        .on("click", (event) => {
          event.originalEvent.stopPropagation();
          setSelectedMetric(marker.type === "currents" ? "health" : marker.type);
          setSelectedLocationId(marker.id);
          setDrawerOpen(true);
        })
        .addTo(markerLayer);
    });

    if (uploadedMarkers.length && visibleMarkers.length) {
      mapRef.current?.fitBounds(L.latLngBounds(visibleMarkers.map((marker) => [marker.lat, marker.lng])), { padding: [70, 70] });
      if (uploadAnalysis) setAssistantMessage(uploadAnalysis);
    }
  }, [mapMode, mapOpen, setAssistantMessage, setDrawerOpen, setSelectedLocationId, setSelectedMetric, uploadAnalysis, uploadedMarkers.length, visibleMarkers]);

  useEffect(() => {
    const riskLayer = riskLayerRef.current;
    if (!mapOpen || !riskLayer) return;

    riskLayer.clearLayers();
    if (mapMode !== "risks") return;

    riskZones.forEach((zone) => {
      L.polygon(zone.coordinates, {
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: 0.28,
        opacity: 0.95,
        weight: 2,
      })
        .bindPopup(popupHtml(zone.name, `${zone.severity} ${zone.risk} risk`), { className: "mission-popup" })
        .on("click", (event) => {
          event.originalEvent.stopPropagation();
          setSelectedMetric("risks");
          setSelectedLocationId(zone.id);
          setDrawerOpen(true);
          setAssistantMessage(`${zone.name}: ${zone.severity} ${zone.risk} risk zone selected.`);
        })
        .addTo(riskLayer);
    });
  }, [mapMode, mapOpen, setAssistantMessage, setDrawerOpen, setSelectedLocationId, setSelectedMetric]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim().toLowerCase();
    if (!normalized) return;

    const marker = markers.find((item) =>
      [item.name, item.region, item.layer, item.summary].join(" ").toLowerCase().includes(normalized),
    );
    if (!marker) {
      setAssistantMessage(`No active marine marker found for "${query}". Try Chennai, Arabian Sea, reef, bloom, SST, or biodiversity.`);
      return;
    }

    mapRef.current?.flyTo([marker.lat, marker.lng], 6, { duration: 0.8 });
    setSelectedMetric(marker.type === "currents" ? "health" : marker.type);
    setSelectedLocationId(marker.id);
    setDrawerOpen(true);
  }

  return (
    <section className={`mission-map-card ${mapOpen ? "map-open-card" : "globe-card"} ${mapMode === "risks" ? "risk-mode" : ""}`} aria-label="Ocean intelligence map">
      {!mapOpen && (
        <div
          className="globe-stage"
          onWheel={(event) => {
            event.preventDefault();
            updateGlobeZoom(event.deltaY < 0 ? "in" : "out");
          }}
        >
          <button className="globe-view-button" type="button" onClick={openInteractiveMap} aria-label="Open interactive map">
            <div ref={globeNode} className="globe-canvas" />
            <div className="globe-shade" />
          </button>
          <button className="globe-launch glass-panel" type="button" onClick={openInteractiveMap}>
            <Maximize2 size={18} />
            <span>Open Map</span>
          </button>
          <div className="globe-zoom-tools glass-panel" aria-label="Globe zoom controls">
            <button type="button" aria-label="Zoom globe in" onClick={() => updateGlobeZoom("in")}>
              <Plus size={17} />
            </button>
            <strong>{Math.round(globeZoom * 100)}%</strong>
            <button type="button" aria-label="Zoom globe out" onClick={() => updateGlobeZoom("out")}>
              <Minus size={17} />
            </button>
          </div>
        </div>
      )}

      {mapOpen && <div ref={mapNode} className="marine-leaflet-map" />}

      {mapOpen && (
        <form className="map-command-bar glass-panel" onSubmit={handleSearch}>
          <Search size={18} />
          <Input
            aria-label="Search map"
            placeholder="Search ocean layer..."
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <Button type="submit" variant="ghost"><Crosshair size={17} />Locate</Button>
        </form>
      )}

      {mapOpen && (
        <div className="map-tools glass-panel" aria-label="Map tools">
          <Button variant="icon" type="button" aria-label="Recenter map" onClick={() => mapRef.current?.flyTo([8, 86], 4, { duration: 0.8 })}>
            <LocateFixed size={18} />
          </Button>
          <Button variant="icon" type="button" aria-label="Return to globe" onClick={() => setMapOpen(false)}>
            <Globe2 size={18} />
          </Button>
          <Button variant="icon" type="button" aria-label="Satellite map" onClick={() => setMapMode("satellite")}>
            <Satellite size={18} />
          </Button>
          <Button variant="icon" type="button" aria-label="Risk map" onClick={() => setMapMode("risks")}>
            <Radar size={18} />
          </Button>
        </div>
      )}

      <div className="map-mode-control glass-panel" aria-label="Map display mode">
        {mapModes.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            className={mapMode === id ? "active" : ""}
            onClick={() => {
              setMapMode(id);
              setMapOpen(true);
            }}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {mapOpen && mapLabels && (
        <aside className="layer-control glass-panel" aria-label="Layer controls">
          <header><strong>Layers</strong><Layers3 size={18} /></header>
          {marineLayers.map((layer) => (
            <label key={layer.id}>
              <input
                type="checkbox"
                checked={Boolean(activeLayers[layer.id])}
                onChange={(event) => setActiveLayers((current) => ({ ...current, [layer.id]: event.target.checked }))}
              />
              <span style={{ "--layer-color": layer.color } as CSSProperties} />
              <em>{layer.label}</em>
            </label>
          ))}
        </aside>
      )}

      {mapOpen && mapMode === "risks" && mapLabels && (
        <aside className="risk-legend glass-panel" aria-label="Risk legend">
          <strong>Risk Layers</strong>
          {riskZones.slice(0, 4).map((zone) => (
            <span key={zone.id}><i style={{ background: zone.color }} />{zone.risk}</span>
          ))}
        </aside>
      )}

      {mapOpen && mapLabels && <div className="coordinate glass-panel">{coordinates}<br />MODE {mapMode.toUpperCase()}</div>}
    </section>
  );
}
