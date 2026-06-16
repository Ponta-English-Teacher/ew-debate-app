import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Creates a service-role client for use in API routes (bypasses RLS)
export function createServerClient() {
  return createClient(url, serviceKey);
}
