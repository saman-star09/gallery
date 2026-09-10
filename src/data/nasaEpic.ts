import type { FrameImageResult } from './types';
import { errorResult, fetchWithTimeout, pad2 } from './util';

/**
 * NASA EPIC — Earth Polychromatic Imaging Camera aboard DSCOVR, parked at the
 * Sun-Earth L1 point ~1.5M km away. It photographs the full sunlit disc of
 * Earth roughly every 1-2 hours with no API key required. This is the closest
 * thing the public web has to a live "whole planet" webcam.
 * Docs: https://epic.gsfc.nasa.gov/about/api
 */
const METADATA_URL = 'https://epic.gsfc.nasa.gov/api/natural/images';
const ARCHIVE_BASE = 'https://epic.gsfc.nasa.gov/archive/natural';
const SOURCE_LABEL = 'NASA EPIC — DSCOVR @ Sun-Earth L1';

interface EpicItem {
  image: string;
  date: string; // "2024-05-01 03:12:34"
}

export async function fetchLatestEpicImage(): Promise<FrameImageResult> {
  try {
    const res = await fetchWithTimeout(METADATA_URL, 12000);
    if (!res.ok) throw new Error(`EPIC metadata responded ${res.status}`);
    const items = (await res.json()) as EpicItem[];
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('No sunlit passes published yet today');
    }
    const latest = items[items.length - 1];
    const capturedAt = new Date(`${latest.date.replace(' ', 'T')}Z`);
    const y = capturedAt.getUTCFullYear();
    const m = pad2(capturedAt.getUTCMonth() + 1);
    const d = pad2(capturedAt.getUTCDate());
    const imageUrl = `${ARCHIVE_BASE}/${y}/${m}/${d}/png/${latest.image}.png`;

    return {
      status: 'live',
      imageUrl,
      capturedAt,
      sourceLabel: SOURCE_LABEL,
      caption: 'The sunlit face of Earth, this orbit.',
    };
  } catch (err) {
    return errorResult(SOURCE_LABEL, err);
  }
}
