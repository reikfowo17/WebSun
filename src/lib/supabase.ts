import { createClient } from '@supabase/supabase-js';

// ===========================================================================
// SUPABASE CLIENT CONFIGURATION
// ===========================================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Missing environment variables. Using mock mode.');
}

/**
 * Supabase client instance
 * Note: For full type safety, regenerate types with: npx supabase gen types typescript
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
});

/**
 * Check if Supabase is properly configured
 * When false, services will use mock data
 */
export const isSupabaseConfigured = (): boolean => {
    return Boolean(supabaseUrl && supabaseAnonKey);
};

export default supabase;
