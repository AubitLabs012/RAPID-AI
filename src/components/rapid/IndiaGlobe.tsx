import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Crosshair, Minus, Plus } from 'lucide-react';
import earthUrl from '../../assets/earth-atmos-2048.jpg';
import { regions, type Region } from './regions';

function position(lat: number, lng: number, radius = 1) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}

export function IndiaGlobe({ selected, onSelect, markers, grid, reducedMotion, hazard }: { selected: string; onSelect: (region: Region) => void; markers: boolean; grid: boolean; reducedMotion: boolean; hazard: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  const state = useRef({ selected, markers, grid, reducedMotion, hazard });
  const actions = useRef<{ zoom: (amount: number) => void; reset: () => void } | null>(null);
  const [notice, setNotice] = useState('Select a marker to explore its regional analysis');
  const [failed, setFailed] = useState(false);
  select.current = onSelect;
  state.current = { selected, markers, grid, reducedMotion, hazard };

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
    catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
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
    controls.enableZoom = false;
    const earthGroup = new THREE.Group();
    // Face India toward the camera while keeping geographic north upright.
    earthGroup.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(22)))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(-170)));
    scene.add(earthGroup);
    const texture = new THREE.TextureLoader().load(earthUrl, undefined, undefined, () => setNotice('Earth texture unavailable. Regional markers remain selectable.'));
    texture.colorSpace = THREE.SRGBColorSpace;
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshPhongMaterial({ map: texture, color: '#82c2dc', shininess: 8, specular: '#091819' }));
    earthGroup.add(sphere);
    scene.add(new THREE.AmbientLight('#b2e9ff', 1.6));
    const sun = new THREE.DirectionalLight('#d3f5ff', 2.4);
    sun.position.set(-3, 4, 5); scene.add(sun);
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.025, 64, 48), new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: 'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p;}',
      fragmentShader: 'varying vec3 n; varying vec3 v; void main(){float a=pow(1.0-max(dot(normalize(n),normalize(v)),0.0),3.0);gl_FragColor=vec4(0.12,0.78,1.0,a*0.7);}',
    }));
    earthGroup.add(atmosphere);
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
      const color = region.level === 'High' ? '#ff5968' : '#edb85e';
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.013, 16, 12), new THREE.MeshBasicMaterial({ color }));
      dot.position.copy(point); dot.userData.region = region;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.024, 0.028, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      ring.position.copy(point.clone().multiplyScalar(1.003)); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), point.clone().normalize());
      pinGroup.add(dot, ring);
      return { dot, ring, region };
    });
    earthGroup.add(pinGroup);
    const raycaster = new THREE.Raycaster();
    let pointerStart = { x: 0, y: 0 };
    const down = (e: PointerEvent) => { pointerStart = { x: e.clientX, y: e.clientY }; };
    const up = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), camera);
      const hit = raycaster.intersectObject(sphere)[0];
      if (!hit) return;
      const local = earthGroup.worldToLocal(hit.point.clone()).normalize();
      const nearest = regions.filter(region => state.current.hazard === 'All hazards' || region.hazard === state.current.hazard).map(region => ({ region, distance: local.angleTo(position(region.lat, region.lng)) })).sort((a, b) => a.distance - b.distance)[0];
      if (nearest && nearest.distance < THREE.MathUtils.degToRad(5)) {
        select.current(nearest.region);
        setNotice(`${nearest.region.name}, ${nearest.region.state} · Regional scenario selected`);
      } else setNotice('India coverage only · Choose a highlighted location or use Regional Scan');
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', up);
    actions.current = {
      zoom: amount => { camera.position.setLength(THREE.MathUtils.clamp(camera.position.length() + amount, 2.5, 5.2)); controls.update(); },
      reset: () => { camera.position.set(0, 0, 3.8); camera.up.set(0, 1, 0); controls.target.set(0, 0, 0); controls.update(); setNotice('India centered · Select a location to analyze'); },
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
    const draw = (time: number) => {
      gridGroup.visible = state.current.grid; pinGroup.visible = state.current.markers;
      for (const pin of pins) {
        pin.dot.visible = pin.ring.visible = state.current.hazard === 'All hazards' || pin.region.hazard === state.current.hazard;
        const active = pin.region.id === state.current.selected;
        pin.dot.scale.setScalar(active ? 1.5 : 1);
        pin.ring.scale.setScalar(state.current.reducedMotion ? (active ? 1.7 : 1) : 1 + ((time / 2200 + regions.indexOf(pin.region) / 8) % 1) * (active ? 1.5 : 0.9));
      }
      controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); controls.dispose(); texture.dispose();
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up);
      scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()); } });
      renderer.dispose(); renderer.domElement.remove(); actions.current = null;
    };
  }, []);

  return <div className="rapid-globe-interactive">
    <div className="rapid-earth-canvas" ref={mount} role="img" aria-label="Interactive Earth centered on India. Drag to rotate. Select a location on the globe or use the regional buttons below." />
    {failed && <p className="rapid-globe-fallback">3D is unavailable in this browser. Select an Indian region below to explore its analysis.</p>}
    <div className="rapid-globe-tools"><button onClick={() => actions.current?.zoom(-0.3)} aria-label="Zoom in"><Plus size={15} /></button><button onClick={() => actions.current?.reset()} aria-label="Recenter India"><Crosshair size={16} /></button><button onClick={() => actions.current?.zoom(0.3)} aria-label="Zoom out"><Minus size={15} /></button></div>
    <p className="rapid-globe-notice" aria-live="polite">{notice}</p>
  </div>;
}
