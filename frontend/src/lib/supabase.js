
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pekbmyrzprsmzahgtjhp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_1RsxLhVcrCQyCAphkj3G_w_COF4LrDl';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase URL or Anon Key.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
