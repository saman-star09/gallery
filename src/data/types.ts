export type FrameStatus = 'loading' | 'live' | 'error';

export interface FrameImageResult {
  status: FrameStatus;
  imageUrl?: string;
  /** Additional URLs to try in order if imageUrl fails to load (e.g. same tile from a prior day). */
  imageUrlFallbacks?: string[];
  caption: string;
  sourceLabel: string;
  capturedAt?: Date;
  error?: string;
}

export interface FrameFetchContext {
  /** 0 = far away, 1 = right up against the glass. */
  proximity: number;
}
