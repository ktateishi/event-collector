import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationType = "daily" | "reminder";

export async function listNotifiedEventIds(
  client: SupabaseClient,
  type: NotificationType
): Promise<Set<string>> {
  const { data, error } = await client.from("notifications").select("event_id").eq("type", type);

  if (error) {
    throw new Error(error.message);
  }

  return new Set((data ?? []).map((row) => row.event_id as string));
}

/**
 * 送信済みとして記録する。既存の(event_id, type)一意制約により、
 * 重複挿入はignoreDuplicatesで無害化する（同一イベントへの二重送信防止）。
 */
export async function recordNotifications(
  client: SupabaseClient,
  eventIds: string[],
  type: NotificationType
): Promise<void> {
  if (eventIds.length === 0) {
    return;
  }

  const { error } = await client
    .from("notifications")
    .upsert(
      eventIds.map((event_id) => ({ event_id, type })),
      { onConflict: "event_id,type", ignoreDuplicates: true }
    );

  if (error) {
    throw new Error(error.message);
  }
}
