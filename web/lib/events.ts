import type { SupabaseClient } from "@supabase/supabase-js";

export type Event = {
  id: string;
  title: string;
  source: string;
  url?: string;
  matched_keyword: string;
  matched_via: "direct" | "expanded";
  confidence: "confirmed" | "exploratory";
  event_date?: string;
  registration_opens_at?: string;
  deadline_at?: string;
  created_at: string;
};

export async function getEventCount(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("events")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

export async function listEvents(client: SupabaseClient): Promise<Event[]> {
  const { data, error } = await client
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Event[];
}

export async function getEventById(client: SupabaseClient, id: string): Promise<Event | null> {
  const { data, error } = await client.from("events").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as Event | null;
}
