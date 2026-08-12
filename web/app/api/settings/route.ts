import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getLatestReminderSetting, setReminderDays } from "@/lib/reminder-settings";

export async function GET() {
  const client = createServerSupabaseClient();
  const setting = await getLatestReminderSetting(client);
  return NextResponse.json({ setting });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const daysBefore = typeof body?.days_before === "number" ? body.days_before : Number.NaN;

  const client = createServerSupabaseClient();

  try {
    const setting = await setReminderDays(client, daysBefore);
    return NextResponse.json({ setting }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
