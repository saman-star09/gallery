import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isConfigured = Boolean(url && anonKey);

export let configError: string | null = null;

/**
 * `null` when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY weren't provided at
 * build time, or when the provided values were malformed enough that the
 * client itself failed to construct (e.g. stray quotes or a missing scheme
 * from copy-pasting into a secrets field). Callers must check `isConfigured`
 * and `configError` rather than assume this is non-null, so a bad config
 * shows a clear message instead of crashing the whole module — and taking
 * the entire page down with it — before anything renders.
 */
export let supabase: SupabaseClient | null = null;

if (isConfigured) {
  try {
    supabase = createClient(url!, anonKey!);
  } catch (err) {
    configError = err instanceof Error ? err.message : String(err);
  }
}
