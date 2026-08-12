import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { runDailyNotify } from "@/lib/notify";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const client = createServerSupabaseClient();
    const result = await runDailyNotify(client, process.env.LINE_CHANNEL_ACCESS_TOKEN);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 }
    );
  }
}
