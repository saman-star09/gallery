import * as satellite from 'satellite.js';
import { fetchWithTimeout } from './util';

/**
 * Tracks a curated set of real public Earth-observation satellites using
 * genuine orbital mechanics (SGP4), sourced from CelesTrak's open TLE
 * catalog. If the catalog can't be reached, positions fall back to a
 * physically-shaped simulation (see simulatedPosition) so the gallery stays
 * alive offline — but that fallback is explicitly labeled as such (`live:
 * false`) rather than presented as a real fix.
 */

export interface SatellitePosition {
  name: string;
  label: string;
  lat: number;
  lon: number;
  altitudeKm: number;
  velocityKmS: number;
  live: boolean;
}

export interface NearestSatelliteResult {
  nearest: SatellitePosition;
  all: SatellitePosition[];
  liveCatalog: boolean;
}

const TRACKED = [
  { name: 'TERRA', label: 'Terra (MODIS)', query: 'TERRA' },
  { name: 'AQUA', label: 'Aqua (MODIS)', query: 'AQUA' },
  { name: 'SUOMI NPP', label: 'Suomi NPP (VIIRS)', query: 'SUOMI NPP' },
  { name: 'NOAA 20', label: 'NOAA-20 (VIIRS)', query: 'NOAA 20' },
  { name: 'LANDSAT 8', label: 'Landsat 8 (OLI)', query: 'LANDSAT 8' },
  { name: 'LANDSAT 9', label: 'Landsat 9 (OLI-2)', query: 'LANDSAT 9' },
  { name: 'SENTINEL-2A', label: 'Sentinel-2A (MSI)', query: 'SENTINEL-2A' },
  { name: 'SENTINEL-2B', label: 'Sentinel-2B (MSI)', query: 'SENTINEL-2B' },
] as const;

// Real, slow-changing orbital facts (altitude/inclination/period/node local
// solar time) used only when the live TLE catalog is unreachable.
const SUN_SYNC_MODEL: Record<
  string,
  { altitudeKm: number; inclinationDeg: number; periodMin: number; nodeLocalSolarHour: number; descending: boolean; phaseSeedMin: number }
> = {
  TERRA: { altitudeKm: 705, inclinationDeg: 98.2, periodMin: 98.8, nodeLocalSolarHour: 10.5, descending: true, phaseSeedMin: 0 },
  AQUA: { altitudeKm: 705, inclinationDeg: 98.2, periodMin: 98.8, nodeLocalSolarHour: 13.5, descending: false, phaseSeedMin: 20 },
  'SUOMI NPP': { altitudeKm: 824, inclinationDeg: 98.7, periodMin: 101.4, nodeLocalSolarHour: 13.5, descending: false, phaseSeedMin: 40 },
  'NOAA 20': { altitudeKm: 824, inclinationDeg: 98.7, periodMin: 101.4, nodeLocalSolarHour: 13.5, descending: false, phaseSeedMin: 55 },
  'LANDSAT 8': { altitudeKm: 705, inclinationDeg: 98.2, periodMin: 99.0, nodeLocalSolarHour: 10.0, descending: true, phaseSeedMin: 10 },
  'LANDSAT 9': { altitudeKm: 705, inclinationDeg: 98.2, periodMin: 99.0, nodeLocalSolarHour: 10.0, descending: true, phaseSeedMin: 60 },
  'SENTINEL-2A': { altitudeKm: 786, inclinationDeg: 98.6, periodMin: 100.6, nodeLocalSolarHour: 10.5, descending: true, phaseSeedMin: 25 },
  'SENTINEL-2B': { altitudeKm: 786, inclinationDeg: 98.6, periodMin: 100.6, nodeLocalSolarHour: 10.5, descending: true, phaseSeedMin: 75 },
};

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const EARTH_RADIUS_KM = 6371;
const EARTH_MU = 398600.4418; // km^3/s^2

function wrapDeg(deg: number): number {
  let d = deg % 360;
  if (d < -180) d += 360;
  if (d > 180) d -= 360;
  return d;
}

function orbitalSpeedKmS(altitudeKm: number): number {
  return Math.sqrt(EARTH_MU / (EARTH_RADIUS_KM + altitudeKm));
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * DEG2RAD;
  const dLon = (lon2 - lon1) * DEG2RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Illustrative ground-track model, used only when CelesTrak is unreachable.
 * Sun-synchronous satellites cross their defining node at a fixed local
 * solar time by design, which pins that node's current longitude exactly
 * (nodeLon). The along-track offset since that node comes from standard
 * inclined-circular-orbit ground-track geometry. Precession and eccentricity
 * are intentionally omitted — this is a physically-shaped simulation, not a
 * substitute fix.
 */
function simulatedPosition(name: string, label: string, date: Date): SatellitePosition {
  const model = SUN_SYNC_MODEL[name];
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const nodeLon = wrapDeg(15 * (model.nodeLocalSolarHour - utcHours));

  const minutesOfDay = utcHours * 60 + model.phaseSeedMin;
  const u = ((minutesOfDay % model.periodMin) / model.periodMin) * 360;
  const uRad = u * DEG2RAD;
  const iRad = model.inclinationDeg * DEG2RAD;

  let lat: number;
  let dLon: number;
  if (model.descending) {
    lat = -Math.asin(Math.sin(iRad) * Math.sin(uRad)) * RAD2DEG;
    dLon = wrapDeg(Math.atan2(-Math.cos(iRad) * Math.sin(uRad), -Math.cos(uRad)) * RAD2DEG - 180);
  } else {
    lat = Math.asin(Math.sin(iRad) * Math.sin(uRad)) * RAD2DEG;
    dLon = Math.atan2(Math.cos(iRad) * Math.sin(uRad), Math.cos(uRad)) * RAD2DEG;
  }

  return {
    name,
    label,
    lat,
    lon: wrapDeg(nodeLon + dLon),
    altitudeKm: model.altitudeKm,
    velocityKmS: orbitalSpeedKmS(model.altitudeKm),
    live: false,
  };
}

interface CatalogEntry {
  name: string;
  label: string;
  satrec: satellite.SatRec;
}

let cachedCatalog: CatalogEntry[] | null = null;
let catalogFetchedAt = 0;
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;

async function fetchTleFor(entry: (typeof TRACKED)[number]): Promise<CatalogEntry | null> {
  const url = `https://celestrak.org/NORAD/elements/gp.php?NAME=${encodeURIComponent(entry.query)}&FORMAT=tle`;
  const res = await fetchWithTimeout(url, 8000);
  if (!res.ok) return null;
  const lines = (await res.text())
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const [, line1, line2] = lines;
  if (!line1?.startsWith('1 ') || !line2?.startsWith('2 ')) return null;
  return { name: entry.name, label: entry.label, satrec: satellite.twoline2satrec(line1, line2) };
}

async function getCatalog(): Promise<CatalogEntry[]> {
  const now = Date.now();
  if (cachedCatalog && now - catalogFetchedAt < CATALOG_TTL_MS) return cachedCatalog;
  const settled = await Promise.allSettled(TRACKED.map(fetchTleFor));
  const catalog = settled
    .filter((r): r is PromiseFulfilledResult<CatalogEntry | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((v): v is CatalogEntry => v !== null);
  if (catalog.length > 0) {
    cachedCatalog = catalog;
    catalogFetchedAt = now;
  }
  return catalog;
}

function livePosition(entry: CatalogEntry, date: Date): SatellitePosition | null {
  const pv = satellite.propagate(entry.satrec, date);
  if (!pv || !pv.position || typeof pv.position === 'boolean') return null;
  const gmst = satellite.gstime(date);
  const geo = satellite.eciToGeodetic(pv.position, gmst);
  const velocity = pv.velocity && typeof pv.velocity !== 'boolean' ? pv.velocity : undefined;
  const speed = velocity ? Math.hypot(velocity.x, velocity.y, velocity.z) : orbitalSpeedKmS(geo.height);

  return {
    name: entry.name,
    label: entry.label,
    lat: satellite.degreesLat(geo.latitude),
    lon: satellite.degreesLong(geo.longitude),
    altitudeKm: geo.height,
    velocityKmS: speed,
    live: true,
  };
}

export async function findNearestSatellite(refLat: number, refLon: number): Promise<NearestSatelliteResult> {
  const now = new Date();
  const catalog = await getCatalog();

  let positions: SatellitePosition[] = [];
  let liveCatalog = false;
  if (catalog.length > 0) {
    positions = catalog.map((entry) => livePosition(entry, now)).filter((p): p is SatellitePosition => p !== null);
    liveCatalog = positions.length > 0;
  }
  if (positions.length === 0) {
    positions = TRACKED.map((t) => simulatedPosition(t.name, t.label, now));
    liveCatalog = false;
  }

  const nearest = [...positions].sort((a, b) => haversineKm(refLat, refLon, a.lat, a.lon) - haversineKm(refLat, refLon, b.lat, b.lon))[0];

  return { nearest, all: positions, liveCatalog };
}

const DEFAULT_REFERENCE = { lat: 51.4778, lon: -0.0015 }; // Royal Observatory, Greenwich

export function getReferenceLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(DEFAULT_REFERENCE);
      return;
    }
    const timer = setTimeout(() => resolve(DEFAULT_REFERENCE), 4000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(DEFAULT_REFERENCE);
      },
      { maximumAge: 60000, timeout: 3500 },
    );
  });
}
