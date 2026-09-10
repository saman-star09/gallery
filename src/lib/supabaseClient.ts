import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);

/**
 * `null` when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY weren't provided at
 * build time — callers must check `isConfigured` first rather than assume
 * this is non-null, so a missing config shows a clear message instead of a
 * runtime crash.
 */
export const supabase: SupabaseClient | null = isConfigured ? createClient(url!, anonKey!) : null;
