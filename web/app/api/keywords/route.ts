import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { addKeyword, listKeywords } from "@/lib/keywords";

export async function GET() {
  const client = createServerSupabaseClient();
  const keywords = await listKeywords(client);
  return NextResponse.json({ keywords });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const keyword = typeof body?.keyword === "string" ? body.keyword : "";

  const client = createServerSupabaseClient();

  try {
    const created = await addKeyword(client, keyword);
    return NextResponse.json({ keyword: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "登録に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
