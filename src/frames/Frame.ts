import * as THREE from 'three';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import type { FrameFetchContext, FrameImageResult, FrameStatus } from '../data/types';

export interface FrameOptions {
  id: string;
  title: string;
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  width: number;
  height: number;
  accentColor: number;
  /** Minimum time between background refreshes, ms. */
  refreshMs: number;
  fetcher: (ctx: FrameFetchContext) => Promise<FrameImageResult>;
}

const CONTENT_PX = { w: 480, h: 360 };
const NEAR_DISTANCE = 2.2; // world units at which proximity == 1
const FAR_DISTANCE = 9; // world units at which proximity == 0
const APPROACH_THRESHOLD = 0.55;
const BASE_RETRY_MS = 5000;
const MAX_RETRY_MS = 30000;

export class GalleryFrame {
  readonly id: string;
  readonly title: string;
  readonly group = new THREE.Group();
  readonly hitPlane: THREE.Mesh;

  private readonly opts: FrameOptions;
  private readonly rootEl: HTMLDivElement;
  private readonly imgEl: HTMLImageElement;
  private readonly statusEl: HTMLDivElement;
  private readonly captionEl: HTMLDivElement;
  private readonly dotEl: HTMLSpanElement;
  private readonly borderMaterial: THREE.MeshStandardMaterial;

  private _status: FrameStatus = 'loading';
  private proximity = 0;
  private lastProximity = 0;
  private lastFetchAt = -Infinity;
  private fetching = false;
  private retryDelay = BASE_RETRY_MS;
  private fallbackQueue: string[] = [];
  private latestResult: FrameImageResult | null = null;

  constructor(opts: FrameOptions) {
    this.opts = opts;
    this.id = opts.id;
    this.title = opts.title;

    this.group.position.copy(opts.position);
    this.group.lookAt(opts.lookAt);

    const border = buildBorderMesh(opts.width, opts.height, opts.accentColor);
    this.borderMaterial = border.material as THREE.MeshStandardMaterial;
    this.group.add(border);

    this.hitPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(opts.width, opts.height),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    this.group.add(this.hitPlane);

    const built = buildContentElement(opts.title, opts.accentColor);
    this.rootEl = built.root;
    this.imgEl = built.img;
    this.statusEl = built.status;
    this.captionEl = built.caption;
    this.dotEl = built.dot;

    const cssObject = new CSS3DObject(this.rootEl);
    cssObject.position.set(0, 0, 0.05);
    cssObject.scale.set(opts.width / CONTENT_PX.w, opts.height / CONTENT_PX.h, 1);
    this.group.add(cssObject);

    this.setStatus('loading', 'Establishing uplink…');
  }

  /** Called every frame with the camera's world position. */
  update(cameraPosition: THREE.Vector3, now: number): void {
    const worldPos = new THREE.Vector3();
    this.group.getWorldPosition(worldPos);
    const dist = cameraPosition.distanceTo(worldPos);
    this.lastProximity = this.proximity;
    this.proximity = THREE.MathUtils.clamp(1 - (dist - NEAR_DISTANCE) / (FAR_DISTANCE - NEAR_DISTANCE), 0, 1);

    const dueForRefresh = now - this.lastFetchAt > this.opts.refreshMs;
    const justApproached = this.proximity > APPROACH_THRESHOLD && this.lastProximity <= APPROACH_THRESHOLD;
    const dueForRetry = this.status === 'error' && now - this.lastFetchAt > this.retryDelay;

    if (!this.fetching && (dueForRefresh || justApproached || dueForRetry)) {
      void this.refresh();
    }

    this.borderMaterial.emissiveIntensity = 0.35 + this.proximity * 0.9;
  }

  get currentProximity(): number {
    return this.proximity;
  }

  get lastResult(): FrameImageResult | null {
    return this.latestResult;
  }

  get status(): FrameStatus {
    return this._status;
  }

  private async refresh(): Promise<void> {
    this.fetching = true;
    this.lastFetchAt = performance.now();
    try {
      const result = await this.opts.fetcher({ proximity: this.proximity });
      this.latestResult = result;
      if (result.status === 'live' && result.imageUrl) {
        this.fallbackQueue = result.imageUrlFallbacks ? [...result.imageUrlFallbacks] : [];
        this.loadImage(result.imageUrl, result);
      } else {
        this.setStatus('error', result.error ?? 'Signal unavailable');
        this.scheduleRetryBackoff();
      }
    } catch (err) {
      this.setStatus('error', err instanceof Error ? err.message : 'Unknown error');
      this.scheduleRetryBackoff();
    } finally {
      this.fetching = false;
    }
  }

  private loadImage(url: string, result: FrameImageResult): void {
    const probe = new Image();
    probe.onload = () => {
      this.imgEl.src = url;
      this.imgEl.hidden = false;
      this.setStatus('live');
      this.updateCaption(result);
      this.retryDelay = BASE_RETRY_MS;
    };
    probe.onerror = () => {
      const next = this.fallbackQueue.shift();
      if (next) {
        this.loadImage(next, result);
      } else {
        this.setStatus('error', 'No recent pass available');
        this.scheduleRetryBackoff();
      }
    };
    probe.src = url;
  }

  private updateCaption(result: FrameImageResult): void {
    const when = result.capturedAt ? formatRelativeTime(result.capturedAt) : null;
    this.captionEl.textContent = when ? `${result.caption} · ${when}` : result.caption;
  }

  private scheduleRetryBackoff(): void {
    this.retryDelay = Math.min(MAX_RETRY_MS, this.retryDelay * 1.7);
  }

  private setStatus(status: FrameStatus, message?: string): void {
    this._status = status;
    this.rootEl.dataset.status = status;
    if (status === 'loading') {
      this.imgEl.hidden = true;
      this.statusEl.hidden = false;
      this.statusEl.textContent = message ?? 'Establishing uplink…';
    } else if (status === 'error') {
      this.imgEl.hidden = true;
      this.statusEl.hidden = false;
      this.statusEl.textContent = message ?? 'Uplink interrupted — retrying…';
    } else {
      this.statusEl.hidden = true;
    }
    this.dotEl.dataset.status = status;
  }
}

function buildBorderMesh(width: number, height: number, accentColor: number): THREE.Mesh {
  const thickness = Math.min(width, height) * 0.045;
  const depth = thickness * 1.4;

  const shape = new THREE.Shape();
  const ow = width / 2 + thickness;
  const oh = height / 2 + thickness;
  shape.moveTo(-ow, -oh);
  shape.lineTo(ow, -oh);
  shape.lineTo(ow, oh);
  shape.lineTo(-ow, oh);
  shape.closePath();

  const hole = new THREE.Path();
  const iw = width / 2;
  const ih = height / 2;
  hole.moveTo(-iw, -ih);
  hole.lineTo(iw, -ih);
  hole.lineTo(iw, ih);
  hole.lineTo(-iw, ih);
  hole.closePath();
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: thickness * 0.25,
    bevelSize: thickness * 0.2,
    bevelSegments: 2,
  });
  geometry.translate(0, 0, -depth / 2);

  const material = new THREE.MeshStandardMaterial({
    color: 0x0b0e14,
    metalness: 0.6,
    roughness: 0.35,
    emissive: new THREE.Color(accentColor),
    emissiveIntensity: 0.35,
  });

  return new THREE.Mesh(geometry, material);
}

function buildContentElement(title: string, accentColor: number) {
  const accent = `#${accentColor.toString(16).padStart(6, '0')}`;

  const root = document.createElement('div');
  root.className = 'gallery-frame';
  root.style.setProperty('--accent', accent);
  root.style.width = `${CONTENT_PX.w}px`;
  root.style.height = `${CONTENT_PX.h}px`;

  const media = document.createElement('div');
  media.className = 'gallery-frame__media';

  const img = document.createElement('img');
  img.className = 'gallery-frame__img';
  img.alt = title;
  img.hidden = true;
  media.appendChild(img);

  const status = document.createElement('div');
  status.className = 'gallery-frame__status';
  status.textContent = 'Establishing uplink…';
  media.appendChild(status);

  const titlebar = document.createElement('div');
  titlebar.className = 'gallery-frame__titlebar';

  const dot = document.createElement('span');
  dot.className = 'gallery-frame__dot';

  const titleText = document.createElement('span');
  titleText.textContent = title;

  titlebar.append(dot, titleText);

  const caption = document.createElement('div');
  caption.className = 'gallery-frame__caption';

  root.append(media, titlebar, caption);

  return { root, img, status, caption, dot };
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'moments ago';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
