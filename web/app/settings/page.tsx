import { createServerSupabaseClient } from "@/lib/supabase";
import { getLatestReminderSetting } from "@/lib/reminder-settings";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

const DEFAULT_DAYS_BEFORE = 3;

export default async function SettingsPage() {
  const client = createServerSupabaseClient();
  const setting = await getLatestReminderSetting(client);

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">設定</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          受付開始・締切の何日前にリマインド通知するかを設定します。
        </p>
      </div>
      <SettingsForm initialDaysBefore={setting?.days_before ?? DEFAULT_DAYS_BEFORE} />
    </main>
  );
}
