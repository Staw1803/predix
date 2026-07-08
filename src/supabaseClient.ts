import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are valid and configured
export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' && 
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY'
);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase is not configured yet. Please copy .env.example to .env and configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Falling back to local simulated state.'
  );
}

// Fallback credentials to prevent createClient from crashing the builder
const finalUrl = isSupabaseConfigured ? supabaseUrl : 'https://prcfmhrccfowsykkysld.supabase.co';
const finalKey = isSupabaseConfigured ? supabaseAnonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';

export const supabase = createClient(finalUrl, finalKey);
