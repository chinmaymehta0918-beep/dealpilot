import { createClient } from "@supabase/supabase-js";

let browserClient: any = null;

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase is not configured. Add the project URL and publishable key to the environment.");
  }

  if (!browserClient) {
    browserClient = createClient<any>(url, publishableKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    });
  }

  return browserClient;
}
