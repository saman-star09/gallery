import type { FrameImageResult } from './types';
import { isoDate } from './util';

/**
 * NASA GIBS (Global Imagery Browse Services) serves near-real-time satellite
 * mosaics as plain WMTS tile images — no key, no CORS preflight, just a URL.
 * We use the VIIRS SNPP Corrected Reflectance layer, which is reprocessed
 * within a few hours of acquisition.
 * Docs: https://nasa-gibs.github.io/gibs-api-docs/
 *
 * Tiling scheme (EPSG:4326 "best" matrix set): at zoom z there are
 * 2 * 2^z columns and 1 * 2^z rows covering the full -180..180 / -90..90
 * extent, so plain equirectangular math locates a tile from lon/lat.
 */
const LAYER = 'VIIRS_SNPP_CorrectedReflectance_TrueColor';
const MATRIX_SET = '250m';
const MAX_ZOOM = 6; // conservative — well inside the layer's documented range

export interface GibsTileRequest {
  lon: number;
  lat: number;
  zoom: number;
  date: Date;
}

function tileUrl({ lon, lat, zoom, date }: GibsTileRequest): { url: string; col: number; row: number } {
  const z = Math.max(0, Math.min(MAX_ZOOM, Math.round(zoom)));
  const cols = 2 * 2 ** z;
  const rows = 2 ** z;
  const col = Math.min(cols - 1, Math.max(0, Math.floor(((lon + 180) / 360) * cols)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor(((90 - lat) / 180) * rows)));
  const url = `https://gibs.earthdata.gov/wmts/epsg4326/best/${LAYER}/default/${isoDate(date)}/${MATRIX_SET}/${z}/${row}/${col}.jpg`;
  return { url, col, row };
}

/**
 * Builds a small cascade of candidate tile URLs to try in order: today at the
 * requested zoom, today one zoom level out, then yesterday at the base zoom.
 * GIBS near-real-time processing can lag a few hours, so "today" occasionally
 * has no tiles yet at high latitudes/zooms — the caller's <img> falls through
 * the list on error instead of showing a dead frame.
 */
export function gibsCandidates(lon: number, lat: number, proximityZoom: number): FrameImageResult {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const zoom = Math.round(2 + proximityZoom * (MAX_ZOOM - 2));

  const primary = tileUrl({ lon, lat, zoom, date: today });
  const widerToday = tileUrl({ lon, lat, zoom: Math.max(0, zoom - 2), date: today });
  const fallbackYesterday = tileUrl({ lon, lat, zoom: 2, date: yesterday });

  return {
    status: 'live',
    imageUrl: primary.url,
    imageUrlFallbacks: [widerToday.url, fallbackYesterday.url],
    capturedAt: today,
    sourceLabel: 'NASA GIBS — VIIRS Corrected Reflectance',
    caption: `Near-real-time scan centered on ${lat.toFixed(1)}°, ${lon.toFixed(1)}° · zoom L${zoom}`,
  };
}
