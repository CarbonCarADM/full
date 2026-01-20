
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gpkopzpsdurmywxqlfae.supabase.co';
const supabaseAnonKey = 'sb_publishable_y-wnsnVqkHkhXzutH-b6bQ_JO1i8Mp1';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
