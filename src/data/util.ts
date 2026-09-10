import type { FrameImageResult } from './types';

export async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

export function errorResult(sourceLabel: string, err: unknown): FrameImageResult {
  const message = err instanceof Error ? err.message : String(err);
  return {
    status: 'error',
    sourceLabel,
    caption: 'Uplink interrupted.',
    error: message,
  };
}

export function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
