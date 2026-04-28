import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserSupabaseClient: SupabaseClient | null | undefined;

export function getBrowserSupabaseClient() {
  if (typeof window === "undefined") {
    return null;
  }

  if (browserSupabaseClient !== undefined) {
    return browserSupabaseClient;
  }

  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!url || !key) {
    browserSupabaseClient = null;
    return browserSupabaseClient;
  }

  try {
    browserSupabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch {
    browserSupabaseClient = null;
  }

  return browserSupabaseClient;
}
