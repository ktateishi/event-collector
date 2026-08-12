import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { listEvents, selectDeletableEventIds } from "@/lib/events";
import { todayInJst } from "@/lib/today";

// 全occurrenceの終了から何日待って物理削除するか（tasks/todo.md Task 20で確定）
const GRACE_PERIOD_DAYS = 30;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const client = createServerSupabaseClient();
  const events = await listEvents(client);
  const today = todayInJst();
  const deletableIds = selectDeletableEventIds(events, today, GRACE_PERIOD_DAYS);

  if (deletableIds.length === 0) {
    return NextResponse.json({ checked: events.length, deleted: 0 });
  }

  const { error } = await client.from("events").delete().in("id", deletableIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ checked: events.length, deleted: deletableIds.length });
}
