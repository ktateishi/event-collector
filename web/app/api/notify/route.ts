import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { listEvents } from "@/lib/events";
import { listNotifiedEventIds, recordNotifications } from "@/lib/notifications";
import { selectEventsToNotify, sendBroadcast } from "@/lib/line";
import { getSiteUrl } from "@/lib/site-url";

const DAILY_TYPE = "daily";

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
  const events = await listEvents(client);
  const today = new Date().toISOString().slice(0, 10);
  const alreadyNotifiedIds = await listNotifiedEventIds(client, DAILY_TYPE);
  const toNotify = selectEventsToNotify(events, alreadyNotifiedIds, today);

  if (toNotify.length === 0) {
    return NextResponse.json({ candidates: 0, sent: 0 });
  }

  await sendBroadcast(toNotify, getSiteUrl(), channelAccessToken);
  await recordNotifications(
    client,
    toNotify.map((event) => event.id),
    DAILY_TYPE
  );

  return NextResponse.json({ candidates: toNotify.length, sent: toNotify.length });
}
