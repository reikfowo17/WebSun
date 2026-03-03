import { createClient } from "@supabase/supabase-js";

// ===========================================================================
// SUPABASE CLIENT CONFIGURATION
// ===========================================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Supabase] Missing environment variables. Using mock mode.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: (url, options) => {
      return fetch(url, { ...options, signal: AbortSignal.timeout(15_000) });
    },
  },
});

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

// ===========================================================================
// RETRY UTILITY — Exponential backoff for resilient API calls
// ===========================================================================

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelay = 1000,
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === retries - 1;
      if (isLast) throw err;
      const jitter = Math.random() * 200;
      await delay(baseDelay * Math.pow(2, attempt) + jitter);
      console.warn(`[Supabase] Retry ${attempt + 1}/${retries}`, err);
    }
  }
  throw new Error("withRetry: should not reach here");
}

export default supabase;
