import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { listEvents } from "@/lib/events";
import { listNotifiedEventIds, recordNotifications } from "@/lib/notifications";
import { selectEventsForReminder } from "@/lib/reminders";
import { sendBroadcast } from "@/lib/line";
import { getSiteUrl } from "@/lib/site-url";
import { getLatestReminderSetting } from "@/lib/reminder-settings";
import { todayInJst } from "@/lib/today";

const REMINDER_TYPE = "reminder";
// reminder_settingsに1行も無い場合のフォールバック（マイグレーションのデフォルト値と合わせる）
const DEFAULT_DAYS_BEFORE = 3;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!channelAccessToken) {
    return NextResponse.json(
      { error: "LINE_CHANNEL_ACCESS_TOKEN が設定されていません" },
      { status: 500 }
    );
  }

  const client = createServerSupabaseClient();
  const setting = await getLatestReminderSetting(client);
  const daysBefore = setting?.days_before ?? DEFAULT_DAYS_BEFORE;

  const events = await listEvents(client);
  const today = todayInJst();
  // (event_id, type)一意制約のため、1イベントにつきreminderは生涯1回のみ
  // （MVP簡略化。複数段階のリマインドが必要になったら見直す。supabase/migrations/0001参照）
  const alreadyNotifiedIds = await listNotifiedEventIds(client, REMINDER_TYPE);

  const due = selectEventsForReminder(events, today, daysBefore).filter(
    (event) => !alreadyNotifiedIds.has(event.id)
  );

  if (due.length === 0) {
    return NextResponse.json({ daysBefore, candidates: 0, sent: 0 });
  }

  await sendBroadcast(due, getSiteUrl(), channelAccessToken);
  await recordNotifications(
    client,
    due.map((event) => event.id),
    REMINDER_TYPE
  );

  return NextResponse.json({ daysBefore, candidates: due.length, sent: due.length });
}
