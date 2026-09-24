import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Crosshair, Map, Minus, Plus } from 'lucide-react';
import earthUrl from '../../assets/earth-atmos-2048.jpg';
import { regions } from './regions';
import { loadDisasterMarkerImages } from './markerArt';
import cloudUrl from '../../assets/earth-clouds-1024.png';
import type { MapFocus } from './RapidMap';

function position(lat: number, lng: number, radius = 1) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}

function disasterColor(hazard: string) {
  if (hazard === 'Cyclone') return '#cf48ff';
  if (hazard === 'Flood') return '#4fe5ff';
  if (hazard === 'Tsunami') return '#1976d2';
  if (hazard === 'Volcanic') return '#ff263a';
  if (hazard === 'Earthquake') return '#a8754f';
  if (hazard === 'Landslide') return '#55d483';
  if (hazard === 'Heatwave') return '#ffc928';
  return '#61d7ff';
}

export function IndiaGlobe({ selected, onOpenMap, markers, grid, reducedMotion, hazard, dayMode = false }: { selected: string; onOpenMap: (focus: MapFocus) => void; markers: boolean; grid: boolean; reducedMotion: boolean; hazard: string; dayMode?: boolean }) {
  const mount = useRef<HTMLDivElement>(null);
  const openMap = useRef(onOpenMap);
  const state = useRef({ selected, markers, grid, reducedMotion, hazard, dayMode });
  const actions = useRef<{ zoom: (amount: number) => void; reset: () => void } | null>(null);
  const [notice, setNotice] = useState('Click Earth to open the map. Drag to rotate; scroll or pinch to zoom.');
  const [failed, setFailed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  openMap.current = onOpenMap;
  state.current = { selected, markers, grid, reducedMotion, hazard, dayMode };

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
    catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0, 3.8);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = 2.5;
    controls.maxDistance = 5.2;
    controls.rotateSpeed = 0.45;
    controls.enableZoom = true;
    controls.zoomSpeed = 0.7;
    controls.addEventListener('change', () => setZoomLevel(Number((3.8 / camera.position.length()).toFixed(1))));
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    const earthGroup = new THREE.Group();
    // Face India toward the camera while keeping geographic north upright.
    earthGroup.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(22)))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(-170)));
    scene.add(earthGroup);
    const texture = new THREE.TextureLoader().load(earthUrl, undefined, undefined, () => setNotice('Earth texture unavailable. Regional markers remain selectable.'));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshStandardMaterial({ map: texture, color: '#ffffff', roughness: 0.72, metalness: 0.01 }));
    earthGroup.add(sphere);
    const ambient = new THREE.AmbientLight('#dce9ff', 0.65);
    scene.add(ambient);
    // Natural surface colours in both themes, with a softer night-side fill.
    const look = {
      night: { tint: new THREE.Color('#ffffff'), grid: new THREE.Color('#8bb3c5'), ambient: 0.65 },
      day: { tint: new THREE.Color('#ffffff'), grid: new THREE.Color('#ffffff'), ambient: 0.95 },
    };
    const startLook = state.current.dayMode ? look.day : look.night;
    sphere.material.color.copy(startLook.tint); ambient.intensity = startLook.ambient;
    const sun = new THREE.DirectionalLight('#fff5e8', 2.7);
    sun.position.set(-3, 3, 4); scene.add(sun);
    // Reuse the MARIS cloud asset as a separate, slowly moving atmospheric layer.
    const cloudTexture = new THREE.TextureLoader().load(cloudUrl);
    cloudTexture.colorSpace = THREE.SRGBColorSpace;
    cloudTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.009, 96, 64), new THREE.MeshStandardMaterial({
      map: cloudTexture, transparent: true, opacity: 0.3, depthWrite: false, roughness: 1,
    }));
    earthGroup.add(clouds);
    const markerTextures = new globalThis.Map<string, THREE.Texture>();
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.018, 64, 48), new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: 'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p;}',
      fragmentShader: 'varying vec3 n; varying vec3 v; void main(){float a=pow(1.0-max(dot(normalize(n),normalize(v)),0.0),3.0);gl_FragColor=vec4(0.24,0.51,0.95,a*0.28);}',
    }));
    earthGroup.add(atmosphere);
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 128;
    const glowContext = glowCanvas.getContext('2d');
    const glowGradient = glowContext?.createRadialGradient(64, 64, 2, 64, 64, 64);
    glowGradient?.addColorStop(0, 'rgba(255,255,255,0.9)');
    glowGradient?.addColorStop(0.24, 'rgba(255,255,255,0.48)');
    glowGradient?.addColorStop(1, 'rgba(255,255,255,0)');
    if (glowContext && glowGradient) { glowContext.fillStyle = glowGradient; glowContext.fillRect(0, 0, 128, 128); }
    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    const gridGroup = new THREE.Group();
    const lineMaterial = new THREE.LineBasicMaterial({ color: '#39c6d6', transparent: true, opacity: 0.12 });
    for (let lat = -60; lat <= 60; lat += 20) {
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 181 }, (_, i) => position(lat, i * 2 - 180, 1.004))), lineMaterial));
    }
    for (let lng = -180; lng < 180; lng += 20) {
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 91 }, (_, i) => position(i * 2 - 90, lng, 1.004))), lineMaterial));
    }
    earthGroup.add(gridGroup);
    const pinGroup = new THREE.Group();
    const pins = regions.map(region => {
      const point = position(region.lat, region.lng, 1.014);
      const color = disasterColor(region.hazard);
      const dot = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      dot.scale.setScalar(0.1);
      dot.position.copy(point); dot.userData.region = region;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.setScalar(0.23);
      glow.position.copy(point.clone().multiplyScalar(1.002));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.024, 0.028, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      ring.position.copy(point.clone().multiplyScalar(1.003)); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), point.clone().normalize());
      pinGroup.add(glow, dot, ring);
      return { dot, glow, ring, region };
    });
    earthGroup.add(pinGroup);
    let disposed = false;
    void loadDisasterMarkerImages().then(images => {
      if (disposed) return;
      const loader = new THREE.TextureLoader();
      for (const hazard of new globalThis.Set(regions.map(region => region.hazard))) {
        const marker = loader.load(images[hazard as keyof typeof images]);
        marker.colorSpace = THREE.SRGBColorSpace;
        markerTextures.set(hazard, marker);
        for (const pin of pins.filter(item => item.region.hazard === hazard)) {
          pin.dot.material.map = marker;
          pin.dot.material.opacity = 1;
          pin.dot.material.needsUpdate = true;
        }
      }
    }).catch(() => setNotice('Marker artwork unavailable. Colored regional glows remain active.'));
    const raycaster = new THREE.Raycaster();
    let pointerStart = { x: 0, y: 0 };
    let pointerMoved = false;
    const pointers = new Set<number>();
    const down = (e: PointerEvent) => {
      pointers.add(e.pointerId);
      if (pointers.size === 1) { pointerStart = { x: e.clientX, y: e.clientY }; pointerMoved = false; }
      else pointerMoved = true;
    };
    const move = (e: PointerEvent) => {
      if (pointers.size && Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 6) pointerMoved = true;
    };
    const cancel = (e: PointerEvent) => { pointers.delete(e.pointerId); pointerMoved = true; };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (e.button !== 0 || pointerMoved || pointers.size || Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
      const hit = raycaster.intersectObject(sphere)[0];
      if (!hit) return;
      const local = earthGroup.worldToLocal(hit.point.clone()).normalize();
      const nearest = regions.filter(region => state.current.hazard === 'All hazards' || region.hazard === state.current.hazard).map(region => ({ region, distance: local.angleTo(position(region.lat, region.lng)) })).sort((a, b) => a.distance - b.distance)[0];
      const lat = THREE.MathUtils.radToDeg(Math.asin(local.y));
      const lng = ((THREE.MathUtils.radToDeg(Math.atan2(local.z, -local.x)) + 360) % 360) - 180;
      if (state.current.markers && nearest && nearest.distance < THREE.MathUtils.degToRad(5)) {
        openMap.current({ lat: nearest.region.lat, lng: nearest.region.lng, region: nearest.region });
      } else openMap.current({ lat: Math.max(-80, Math.min(80, lat)), lng });
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointercancel', cancel);
    actions.current = {
      zoom: amount => { camera.position.setLength(THREE.MathUtils.clamp(camera.position.length() + amount, 2.5, 5.2)); controls.update(); },
      reset: () => { camera.position.set(0, 0, 3.8); camera.up.set(0, 1, 0); controls.target.set(0, 0, 0); controls.update(); setNotice('India centered. Click Earth to open the map'); },
    };
    const resize = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height); camera.aspect = width / height;
      camera.fov = camera.aspect < 1 ? 42 : 36;
      camera.updateProjectionMatrix();
    });
    resize.observe(host);
    let frame = 0;
    let lastTime = 0;
    const draw = (time: number) => {
      const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
      lastTime = time;
      if (!state.current.reducedMotion) clouds.rotation.y += delta * 0.008;
      gridGroup.visible = state.current.grid; pinGroup.visible = state.current.markers;
      // Ease toward the current mode's look so switching Day/Night fades instead of snapping.
      const target = state.current.dayMode ? look.day : look.night;
      const ease = state.current.reducedMotion ? 1 : 0.08;
      sphere.material.color.lerp(target.tint, ease);
      lineMaterial.color.lerp(target.grid, ease);
      ambient.intensity += (target.ambient - ambient.intensity) * ease;
      for (const pin of pins) {
        pin.dot.visible = pin.glow.visible = pin.ring.visible = state.current.hazard === 'All hazards' || pin.region.hazard === state.current.hazard;
        const active = pin.region.id === state.current.selected;
        pin.dot.scale.setScalar(active ? 0.14 : 0.1);
        pin.glow.material.opacity = active ? 0.82 : 0.55;
        pin.glow.scale.setScalar(active ? 0.3 : 0.23);
        pin.ring.scale.setScalar(state.current.reducedMotion ? (active ? 1.7 : 1) : 1 + ((time / 2200 + regions.indexOf(pin.region) / 8) % 1) * (active ? 1.5 : 0.9));
      }
      controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame); resize.disconnect(); controls.dispose(); texture.dispose(); cloudTexture.dispose(); glowTexture.dispose(); markerTextures.forEach(item => item.dispose());
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointermove', move); renderer.domElement.removeEventListener('pointercancel', cancel);
      scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()); } else if (object instanceof THREE.Sprite) { object.material.dispose(); } });
      renderer.dispose(); renderer.domElement.remove(); actions.current = null;
    };
  }, []);

  return <div className="rapid-globe-interactive">
    <div className="rapid-earth-canvas" ref={mount} role="button" tabIndex={0} aria-label="Interactive Earth. Click or press Enter to open the map. Drag to rotate; scroll to zoom."
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMap.current({ lat: 22, lng: 79 }); } }} />
    {failed && <div className="rapid-globe-fallback">3D is unavailable in this browser. <button onClick={() => openMap.current({ lat: 22, lng: 79 })}>Open the map</button></div>}
    <div className="rapid-globe-tools"><output aria-label="Globe zoom level">{zoomLevel.toFixed(1)}x</output><button onClick={() => actions.current?.zoom(-0.3)} aria-label="Zoom in globe"><Plus size={15} /></button><button onClick={() => actions.current?.reset()} aria-label="Recenter India"><Crosshair size={16} /></button><button onClick={() => actions.current?.zoom(0.3)} aria-label="Zoom out globe"><Minus size={15} /></button><button onClick={() => openMap.current({ lat: 22, lng: 79 })} aria-label="Open map"><Map size={16} /></button></div>
    <p className="rapid-globe-notice" aria-live="polite">{notice}</p>
  </div>;
}
