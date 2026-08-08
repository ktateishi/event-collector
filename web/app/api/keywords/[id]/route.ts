import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { deleteKeyword } from "@/lib/keywords";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = createServerSupabaseClient();

  try {
    await deleteKeyword(client, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "削除に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
