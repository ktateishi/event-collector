import type { SupabaseClient } from "@supabase/supabase-js";
import { listEvents } from "./events";
import { listNotifiedEventIds, recordNotifications } from "./notifications";
import { selectEventsToNotify, sendBroadcast } from "./line";
import { getSiteUrl } from "./site-url";
import { todayInJst } from "./today";

const DAILY_TYPE = "daily";

export type NotifyResult = { candidates: number; sent: number };

/**
 * 当日の新着イベントを選定し、LINEへFlex Messageカルーセルで送信する。
 * /api/notify（手動・デバッグ用）と /api/cron/collect（収集完了後の自動起動、Task 9）の
 * 両方から呼ばれる共通ロジック。
 */
export async function runDailyNotify(
  client: SupabaseClient,
  channelAccessToken: string | undefined
): Promise<NotifyResult> {
  if (!channelAccessToken) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN が設定されていません");
  }

  const events = await listEvents(client);
  const today = todayInJst();
  const alreadyNotifiedIds = await listNotifiedEventIds(client, DAILY_TYPE);
  const toNotify = selectEventsToNotify(events, alreadyNotifiedIds, today);

  if (toNotify.length === 0) {
    return { candidates: 0, sent: 0 };
  }

  await sendBroadcast(toNotify, getSiteUrl(), channelAccessToken);
  await recordNotifications(
    client,
    toNotify.map((event) => event.id),
    DAILY_TYPE
  );

  return { candidates: toNotify.length, sent: toNotify.length };
}
