import { createClient } from "@supabase/supabase-js";

export function createServerSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません（web/.env.local を確認）"
    );
  }

  return createClient(url, serviceRoleKey);
}
