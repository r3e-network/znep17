import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function readSupabaseUrl(): string {
  const directUrl = process.env.SUPABASE_URL?.trim();
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const url = directUrl || publicUrl;
  if (!url) {
    throw new Error("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Supabase URL is invalid.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Supabase URL must use https://.");
  }

  return parsed.toString().replace(/\/+$/, "");
}

// Server-side privileged client for maintainer off-chain state updates.
export function getSupabaseAdminClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = readSupabaseUrl();
  const supabaseServiceKey = readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  cachedClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}
