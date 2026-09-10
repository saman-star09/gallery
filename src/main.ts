import * as THREE from 'three';
import './style.css';
import { createRenderers } from './scene/renderers';
import { createStarfield } from './scene/Starfield';
import { FlightControls } from './scene/FlightControls';
import { GalleryFrame } from './frames/Frame';
import { buildFrameConfigs, SPAWN_POINT } from './frames/frameConfigs';
import { Hud } from './ui/Hud';

const container = document.querySelector<HTMLDivElement>('#scene-container')!;
const { webgl, css3d, camera } = createRenderers(container);
camera.position.copy(SPAWN_POINT);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03040a);
scene.fog = new THREE.FogExp2(0x03040a, 0.012);

scene.add(createStarfield());
scene.add(new THREE.HemisphereLight(0x3a5aff, 0x0a0a12, 0.6));
const key = new THREE.PointLight(0xffffff, 1.2, 60);
key.position.set(4, 6, 10);
scene.add(key);

const frames = buildFrameConfigs().map((opts) => new GalleryFrame(opts));
for (const frame of frames) scene.add(frame.group);

const controls = new FlightControls(camera, webgl.domElement);
const hud = new Hud(document.querySelector<HTMLDivElement>('#app')!, () => {
  webgl.domElement.requestPointerLock()?.catch(() => {});
});
controls.onLockChange = (locked) => hud.setLocked(locked);

let statusAnnounced = false;
function updateConnectionStatus(): void {
  const live = frames.filter((f) => f.status === 'live').length;
  const errored = frames.filter((f) => f.status === 'error').length;
  if (live === 0 && errored === 0) {
    hud.setConnectionStatus('Connecting to Earth-observation feeds…');
    return;
  }
  statusAnnounced = true;
  if (errored === 0) {
    hud.setConnectionStatus(`${live}/${frames.length} feeds live`);
  } else if (live === 0) {
    hud.setConnectionStatus(`Feeds unreachable — this sandbox may block outbound internet`);
  } else {
    hud.setConnectionStatus(`${live}/${frames.length} feeds live · ${errored} interrupted`);
  }
}

function updateFocus(): void {
  const nearest = frames.reduce<GalleryFrame | null>((best, f) => (best === null || f.currentProximity > best.currentProximity ? f : best), null);

  if (!nearest || nearest.currentProximity < 0.15) {
    hud.hideFocus();
    return;
  }
  const result = nearest.lastResult;
  if (result) {
    hud.showFocus(`${nearest.title}`, `${result.sourceLabel} — ${result.caption}`);
  } else {
    hud.showFocus(nearest.title, 'Establishing uplink…');
  }
}

const timer = new THREE.Timer();
timer.connect(document);
function animate(timestamp: number): void {
  requestAnimationFrame(animate);
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), 0.1);
  const now = performance.now();

  controls.update(dt);
  for (const frame of frames) frame.update(camera.position, now);

  updateFocus();
  if (!statusAnnounced || frames.some((f) => f.status !== 'loading')) updateConnectionStatus();

  webgl.render(scene, camera);
  css3d.render(scene, camera);
}

requestAnimationFrame(animate);

if (import.meta.env.DEV) {
  (window as unknown as { __gallery: unknown }).__gallery = { camera, controls, frames, scene };
}
