// Mock data for demonstration - replace with actual Supabase implementation
/** biome-ignore-all lint/style/noNonNullAssertion: env keys present */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SB_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SB_ANON!;

export const supabase = createClient(supabaseUrl, supabaseKey);


