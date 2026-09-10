import type { FrameImageResult } from './types';

/**
 * NOAA GOES-East / GOES-West GeoColor full-disk composites. NOAA republishes
 * these as a static "latest.jpg" at a fixed URL roughly every 10 minutes, no
 * key or auth required. We cache-bust on every request so the browser always
 * asks the CDN for the current frame instead of a stale local copy.
 * Docs: https://www.star.nesdis.noaa.gov/GOES/
 */
export type GoesSatellite = 'GOES16' | 'GOES18';

const LABELS: Record<GoesSatellite, string> = {
  GOES16: 'NOAA GOES-16 (East) — GeoColor',
  GOES18: 'NOAA GOES-18 (West) — GeoColor',
};

const CAPTIONS: Record<GoesSatellite, string> = {
  GOES16: 'Full-disk view of the Americas & Atlantic, updated ~every 10 min.',
  GOES18: 'Full-disk view of the Pacific, updated ~every 10 min.',
};

export function goesFrame(satellite: GoesSatellite): FrameImageResult {
  const imageUrl = `https://cdn.star.nesdis.noaa.gov/${satellite}/ABI/FD/GEOCOLOR/latest.jpg?cb=${Date.now()}`;
  return {
    status: 'live',
    imageUrl,
    capturedAt: new Date(),
    sourceLabel: LABELS[satellite],
    caption: CAPTIONS[satellite],
  };
}
