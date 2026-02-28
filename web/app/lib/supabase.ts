import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SUPABASE_URL } from "./deployment-defaults";

let cachedClient: SupabaseClient | null = null;

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function readSupabaseUrl(): string {
  const url = DEFAULT_SUPABASE_URL;

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
