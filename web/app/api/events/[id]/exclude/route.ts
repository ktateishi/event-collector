import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getEventById } from "@/lib/events";
import { addExcludedExample } from "@/lib/excluded-examples";

/**
 * イベントを「不要」として手動フラグ付けする（不要イベントの除外機構、SPEC.md）。
 * 削除はせず一覧・LINE通知から非表示にするだけ。タイトルをexcluded_examplesに
 * 蓄積し、今後の収集プロンプトへの負例として使う（lib/gemini-prompt.ts参照）。
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = createServerSupabaseClient();

  const event = await getEventById(client, id);
  if (!event) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const { error } = await client
    .from("events")
    .update({ excluded_at: new Date().toISOString(), excluded_reason: "manual" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await addExcludedExample(client, event.title, event.source_keyword);

  return NextResponse.json({ ok: true });
}
