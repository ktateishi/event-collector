import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { listKeywords } from "@/lib/keywords";
import { collectEventsForKeyword } from "@/lib/gemini";
import { ingestEvents, type CandidateEvent } from "@/lib/ingest";
import { runDailyNotify } from "@/lib/notify";

export const maxDuration = 300;

/**
 * 収集直後にLINE Pushを自動送信する（Task 9）。収集自体は成功しているため、
 * 通知側の失敗（トークン未設定・LINE API障害等）でレスポンス全体を失敗させず、
 * notifyフィールドにエラーを含めて返す。
 */
async function notifyAfterCollect(client: ReturnType<typeof createServerSupabaseClient>) {
  try {
    return await runDailyNotify(client, process.env.LINE_CHANNEL_ACCESS_TOKEN);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "unknown error" };
  }
}

function getGeminiEnv() {
  const projectId = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_LOCATION;
  const model = process.env.GEMINI_MODEL;
  const serviceAccountKeyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;

  if (!projectId || !location || !model || !serviceAccountKeyJson) {
    throw new Error(
      "GCP_PROJECT_ID / GCP_LOCATION / GEMINI_MODEL / GCP_SERVICE_ACCOUNT_KEY が未設定です"
    );
  }

  return { projectId, location, model, serviceAccountKeyJson };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const client = createServerSupabaseClient();
  const keywords = await listKeywords(client);

  if (keywords.length === 0) {
    return NextResponse.json({
      keywords: 0,
      collected: 0,
      inserted: 0,
      skipped: 0,
      errors: [],
      notify: await notifyAfterCollect(client),
    });
  }

  const geminiEnv = getGeminiEnv();
  const candidates: CandidateEvent[] = [];
  const errors: { keyword: string; message: string }[] = [];

  for (const { keyword } of keywords) {
    try {
      const found = await collectEventsForKeyword(geminiEnv, keyword);
      // どの登録キーワードのために収集したかを記録する（カテゴリ分け用、Task 17）。
      // matched_keywordは「実際に一致した語」で拡張語が入りうるため別に持つ
      candidates.push(...found.map((event) => ({ ...event, source_keyword: keyword })));
    } catch (error) {
      errors.push({
        keyword,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  const result = await ingestEvents(client, candidates, { dryRun: false });

  return NextResponse.json({
    keywords: keywords.length,
    collected: candidates.length,
    inserted: result.inserted.length,
    merged: result.merged.length,
    skipped: result.skipped.length,
    errors,
    notify: await notifyAfterCollect(client),
  });
}
