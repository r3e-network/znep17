import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

// Initialize the Supabase client with the service role key to bypass RLS policies
// This should ONLY be used in server-side API routes, NEVER on the client.
export const supabase = createClient(supabaseUrl, supabaseServiceKey);
