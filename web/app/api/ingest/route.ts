import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { ingestEvents, type CandidateEvent } from "@/lib/ingest";

export async function POST(request: Request) {
  const token = process.env.INTERNAL_INGEST_TOKEN;
  const authHeader = request.headers.get("authorization");

  if (!token || authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const events = Array.isArray(body?.events) ? (body.events as CandidateEvent[]) : null;
  const dryRun = body?.dry_run === true;

  if (!events) {
    return NextResponse.json({ error: "events must be an array" }, { status: 400 });
  }

  const client = createServerSupabaseClient();
  const result = await ingestEvents(client, events, { dryRun });

  return NextResponse.json(result);
}
