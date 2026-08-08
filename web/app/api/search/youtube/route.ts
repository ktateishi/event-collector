import { NextResponse } from "next/server";
import { searchYoutube } from "@/lib/youtube";

export async function GET(request: Request) {
  const token = process.env.INTERNAL_INGEST_TOKEN;
  const authHeader = request.headers.get("authorization");

  if (!token || authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    // v1: YouTube連携は未設定でも収集ルーチン全体は止めない
    return NextResponse.json({ results: [], skipped: "YOUTUBE_API_KEY not configured" });
  }

  try {
    const results = await searchYoutube(apiKey, query);
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "検索に失敗しました";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
