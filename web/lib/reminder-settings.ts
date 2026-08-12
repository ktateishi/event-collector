import type { SupabaseClient } from "@supabase/supabase-js";

export type ReminderSetting = {
  id: string;
  days_before: number;
  created_at: string;
};

/**
 * 常に最新の1行を読む運用（supabase/migrations/0001_init.sql参照）。
 * 更新は新しい行のinsertで行い、UPDATEはしない（変更履歴が自然に残る）。
 */
export async function getLatestReminderSetting(
  client: SupabaseClient
): Promise<ReminderSetting | null> {
  const { data, error } = await client
    .from("reminder_settings")
    .select("id, days_before, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as ReminderSetting | null;
}

export async function setReminderDays(
  client: SupabaseClient,
  daysBefore: number
): Promise<ReminderSetting> {
  if (!Number.isInteger(daysBefore) || daysBefore < 0) {
    throw new Error("リマインド日数は0以上の整数で入力してください");
  }

  const { data, error } = await client
    .from("reminder_settings")
    .insert({ days_before: daysBefore })
    .select("id, days_before, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ReminderSetting;
}
