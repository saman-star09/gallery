import * as THREE from 'three';
import { fetchLatestEpicImage } from '../data/nasaEpic';
import { goesFrame } from '../data/noaaGoes';
import { gibsCandidates } from '../data/nasaGibs';
import { findNearestSatellite, getReferenceLocation } from '../data/satelliteTracker';
import type { FrameImageResult } from '../data/types';
import type { FrameOptions } from './Frame';

export const SPAWN_POINT = new THREE.Vector3(0, 0, 6);

let referenceLocationPromise: Promise<{ lat: number; lon: number }> | null = null;
function referenceLocation() {
  if (!referenceLocationPromise) referenceLocationPromise = getReferenceLocation();
  return referenceLocationPromise;
}

async function nearestSatelliteFrame(proximity: number): Promise<FrameImageResult> {
  const ref = await referenceLocation();
  const { nearest, liveCatalog } = await findNearestSatellite(ref.lat, ref.lon);
  const result = gibsCandidates(nearest.lon, nearest.lat, proximity);
  result.sourceLabel = `${nearest.label} — ${liveCatalog ? 'live orbital catalog' : 'simulated orbit'}`;
  result.caption = `${liveCatalog ? 'Tracking' : 'Illustrating'} ${nearest.label} · ${nearest.lat.toFixed(1)}°, ${nearest.lon.toFixed(1)}° · alt ${Math.round(
    nearest.altitudeKm,
  )} km · ${nearest.velocityKmS.toFixed(1)} km/s`;
  return result;
}

export function buildFrameConfigs(): FrameOptions[] {
  return [
    {
      id: 'epic',
      title: 'The Whole Earth, Right Now',
      position: new THREE.Vector3(0, 1.2, -10),
      lookAt: SPAWN_POINT,
      width: 3.4,
      height: 3.4,
      accentColor: 0x4fc3f7,
      refreshMs: 10 * 60 * 1000,
      fetcher: () => fetchLatestEpicImage(),
    },
    {
      id: 'goes16',
      title: 'GOES-16 — Americas, Live',
      position: new THREE.Vector3(-9, 0, -14),
      lookAt: SPAWN_POINT,
      width: 3.8,
      height: 3.8,
      accentColor: 0xffa64d,
      refreshMs: 3 * 60 * 1000,
      fetcher: () => Promise.resolve(goesFrame('GOES16')),
    },
    {
      id: 'goes18',
      title: 'GOES-18 — Pacific, Live',
      position: new THREE.Vector3(9, 0.6, -16),
      lookAt: SPAWN_POINT,
      width: 3.8,
      height: 3.8,
      accentColor: 0x4dffc3,
      refreshMs: 3 * 60 * 1000,
      fetcher: () => Promise.resolve(goesFrame('GOES18')),
    },
    {
      id: 'nearest-satellite',
      title: 'Nearest Satellite Pass',
      position: new THREE.Vector3(0, -2.6, -22),
      lookAt: SPAWN_POINT,
      width: 3.2,
      height: 3.2,
      accentColor: 0xb388ff,
      refreshMs: 60 * 1000,
      fetcher: (ctx) => nearestSatelliteFrame(ctx.proximity),
    },
  ];
}
