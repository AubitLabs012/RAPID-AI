import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { hazard } from "../lib/hazards";
import type { DisasterEvent } from "../services/events";

export type GlobeHandle = { focus: (lat: number, lon: number) => void };

type Props = {
  events: DisasterEvent[];
  selectedId?: string;
  onSelect: (e: DisasterEvent) => void;
  showClouds: boolean;
  showGrid: boolean;
  me?: { lat: number; lon: number } | null;
};

const DEG = Math.PI / 180;
const BASE = import.meta.env.BASE_URL;

// Equirectangular lat/lon -> point on a sphere (matches THREE.SphereGeometry UVs).
function toVector(lat: number, lon: number, r: number) {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 180) * DEG;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

// Spin (Y) then tilt (X) that brings lat/lon to face the camera.
function facing(lat: number, lon: number) {
  const theta = (lon + 180) * DEG;
  return { spin: -Math.atan2(-Math.cos(theta), Math.sin(theta)), tilt: lat * DEG };
}

// Nearest equivalent angle, so the globe turns the short way round.
function nearest(from: number, to: number) {
  const full = Math.PI * 2;
  return from + ((((to - from) % full) + full * 1.5) % full) - Math.PI;
}

export const Globe = forwardRef<GlobeHandle, Props>(function Globe({ events, selectedId, onSelect, showClouds, showGrid, me }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef(new Map<string, HTMLButtonElement>());
  const meRef = useRef<HTMLDivElement>(null);
  const live = useRef({ events, showClouds, showGrid, me });
  live.current = { events, showClouds, showGrid, me };
  const target = useRef({ spin: 0, tilt: 0, distance: 3.3 });

  useImperativeHandle(ref, () => ({
    focus: (lat, lon) => {
      const f = facing(lat, lon);
      target.current.spin = nearest(target.current.spin, f.spin);
      target.current.tilt = f.tilt;
    },
  }));

  useEffect(() => {
    const host = hostRef.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      host.dataset.failed = "true";
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.style.touchAction = "none";
    canvas.style.display = "block";
    host.prepend(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    const tilt = new THREE.Group();
    const spin = new THREE.Group();
    tilt.add(spin);
    scene.add(tilt);

    const loader = new THREE.TextureLoader();
    const earthTex = loader.load(`${BASE}textures/earth.jpg`);
    earthTex.colorSpace = THREE.SRGBColorSpace;
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 96),
      new THREE.MeshPhongMaterial({ map: earthTex, color: "#ffffff", shininess: 14, specular: new THREE.Color("#1a2a3a") }),
    );
    spin.add(earth);

    const cloudTex = loader.load(`${BASE}textures/clouds.png`);
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.012, 64, 64),
      new THREE.MeshPhongMaterial({ map: cloudTex, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    spin.add(clouds);

    // Blue rim glow: strongest at the earth's edge, fading outwards.
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 64, 64),
      new THREE.ShaderMaterial({
        vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vN; void main(){ float f = clamp(-vN.z * 2.6, 0.0, 1.0); gl_FragColor = vec4(0.35, 0.65, 1.0, pow(f, 2.0) * 0.75); }`,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      }),
    ));

    const grid: THREE.Vector3[] = [];
    for (let lat = -60; lat <= 60; lat += 30) for (let lon = -180; lon < 180; lon += 4) grid.push(toVector(lat, lon, 1.004), toVector(lat, lon + 4, 1.004));
    for (let lon = -180; lon < 180; lon += 30) for (let lat = -88; lat < 88; lat += 4) grid.push(toVector(lat, lon, 1.004), toVector(lat + 4, lon, 1.004));
    const gridLines = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(grid),
      new THREE.LineBasicMaterial({ color: "#9cc7ff", transparent: true, opacity: 0.18 }),
    );
    spin.add(gridLines);

    scene.add(new THREE.AmbientLight("#ffffff", 1.25));
    const sun = new THREE.DirectionalLight("#ffffff", 1.6);
    sun.position.set(-3, 2, 4);
    scene.add(sun);

    // Start over India, like the mockup.
    const start = facing(22, 80);
    target.current.spin = spin.rotation.y = start.spin;
    target.current.tilt = tilt.rotation.x = start.tilt;
    camera.position.z = target.current.distance;

    let width = 1;
    let height = 1;
    const resize = () => {
      width = host.clientWidth || 1;
      height = host.clientHeight || 1;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      // Pick the field of view so the globe (radius 1, seen from 3.3 away) spans ~90% of the
      // narrower side. Portrait phones are width-limited, so divide by the aspect ratio there.
      const halfExtent = 1 / 0.9 / 3.3;
      camera.fov = (2 * Math.atan(halfExtent / Math.min(camera.aspect, 1)) * 180) / Math.PI;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    // Touch: one finger rotates, two fingers pinch-zoom.
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;
    let distanceStart = 0;
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        distanceStart = target.current.distance;
      }
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        target.current.distance = THREE.MathUtils.clamp((distanceStart * pinchStart) / d, 1.7, 4.5);
      } else {
        const speed = 0.005 * (target.current.distance / 3.3);
        target.current.spin += (e.clientX - prev.x) * speed;
        target.current.tilt = THREE.MathUtils.clamp(target.current.tilt + (e.clientY - prev.y) * speed, -1.3, 1.3);
      }
    };
    const onUp = (e: PointerEvent) => pointers.delete(e.pointerId);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      target.current.distance = THREE.MathUtils.clamp(target.current.distance + e.deltaY * 0.002, 1.7, 4.5);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // Each frame: ease the rotation, then place every HTML marker over its point on the globe.
    const world = new THREE.Vector3();
    const toCamera = new THREE.Vector3();
    let frame = 0;
    const place = (el: HTMLElement, lat: number, lon: number) => {
      world.copy(toVector(lat, lon, 1.01)).applyMatrix4(spin.matrixWorld);
      toCamera.copy(camera.position).sub(world).normalize();
      const facingCamera = world.clone().normalize().dot(toCamera);
      world.project(camera);
      const x = ((world.x + 1) / 2) * width;
      const y = ((1 - world.y) / 2) * height;
      const visible = facingCamera > 0.12;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${0.75 + 0.25 * Math.min(1, facingCamera * 2)})`;
      el.style.opacity = visible ? String(Math.min(1, facingCamera * 3)) : "0";
      el.style.pointerEvents = visible ? "auto" : "none";
    };
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const t = target.current;
      spin.rotation.y += (t.spin - spin.rotation.y) * 0.1;
      tilt.rotation.x += (t.tilt - tilt.rotation.x) * 0.1;
      camera.position.z += (t.distance - camera.position.z) * 0.12;
      clouds.rotation.y += 0.0003;
      clouds.visible = live.current.showClouds;
      gridLines.visible = live.current.showGrid;
      scene.updateMatrixWorld();
      renderer.render(scene, camera);
      for (const ev of live.current.events) {
        const el = markerRefs.current.get(ev.id);
        if (el) place(el, ev.lat, ev.lon);
      }
      if (meRef.current && live.current.me) place(meRef.current, live.current.me.lat, live.current.me.lon);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      earthTex.dispose();
      cloudTex.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  return (
    <div ref={hostRef} className="absolute inset-0 overflow-hidden">
      {events.map((ev) => {
        const h = hazard(ev.type);
        const selected = ev.id === selectedId;
        return (
          <button
            key={ev.id}
            ref={(el) => {
              if (el) markerRefs.current.set(ev.id, el);
              else markerRefs.current.delete(ev.id);
            }}
            type="button"
            onClick={() => onSelect(ev)}
            aria-label={`${ev.title}, ${ev.place}, ${ev.severity}`}
            className="absolute top-0 left-0 grid place-items-center opacity-0"
            style={{ width: 44, height: 44 }}
          >
            {(ev.severity === "High" || selected) && (
              <span className="marker-pulse absolute size-7 rounded-full" style={{ background: h.color }} aria-hidden />
            )}
            <span
              className="relative grid place-items-center rounded-full border-2 border-white/90"
              style={{
                width: selected ? 34 : 26,
                height: selected ? 34 : 26,
                background: h.color,
                boxShadow: `0 0 12px ${h.color}, 0 2px 6px rgb(0 0 0 / 0.4)`,
              }}
            >
              <h.Icon size={selected ? 18 : 14} color="#fff" strokeWidth={2.4} aria-hidden />
            </span>
          </button>
        );
      })}
      {me && (
        <div ref={meRef} className="pointer-events-none absolute top-0 left-0 opacity-0" aria-label="Your location">
          <span className="block size-4 rounded-full border-[3px] border-white bg-blue-500 shadow-[0_0_0_6px_rgb(59_130_246/0.3)]" />
        </div>
      )}
    </div>
  );
});
