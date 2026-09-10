import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Neither a Supabase project URL nor its API keys ever legitimately contain
 * anything outside printable ASCII. Copying a secret through a chat client,
 * notes app, or word processor can silently swap in a smart quote, em-dash,
 * or invisible character — which is invalid in an HTTP header and breaks
 * every request with an opaque "non ISO-8859-1 code point" fetch error deep
 * inside the client. Stripping anything outside that range up front makes
 * the app immune to that class of copy-paste corruption entirely.
 */
function sanitize(value: string | undefined): string {
  return (value ?? '').replace(/[^\x20-\x7E]/g, '').trim();
}

const url = sanitize(import.meta.env.VITE_SUPABASE_URL);
const anonKey = sanitize(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const isConfigured = Boolean(url && anonKey);

export let configError: string | null = null;

/**
 * `null` when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY weren't provided at
 * build time, or when the provided values were malformed enough that the
 * client itself failed to construct. Callers must check `isConfigured` and
 * `configError` rather than assume this is non-null, so a bad config shows
 * a clear message instead of crashing the whole module — and taking the
 * entire page down with it — before anything renders.
 */
export let supabase: SupabaseClient | null = null;

if (isConfigured) {
  try {
    supabase = createClient(url, anonKey);
  } catch (err) {
    configError = err instanceof Error ? err.message : String(err);
  }
}
