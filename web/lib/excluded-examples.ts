import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_LIMIT = 10;

/**
 * ユーザーが「不要」とフラグ付けした実例のタイトルを、直近順にN件取得する。
 * Gemini抽出プロンプトへの負例として使う（lib/gemini-prompt.ts参照）。
 */
export async function listRecentExcludedExamples(
  client: SupabaseClient,
  limit: number = DEFAULT_LIMIT
): Promise<string[]> {
  const { data, error } = await client
    .from("excluded_examples")
    .select("title")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.title as string);
}

export async function addExcludedExample(
  client: SupabaseClient,
  title: string,
  sourceKeyword: string | undefined
): Promise<void> {
  const { error } = await client
    .from("excluded_examples")
    .insert({ title, source_keyword: sourceKeyword });

  if (error) {
    throw new Error(error.message);
  }
}
