import type { SupabaseClient } from "@supabase/supabase-js";

export async function getEventCount(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("events")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}
