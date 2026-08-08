import type { SupabaseClient } from "@supabase/supabase-js";

export type Keyword = {
  id: string;
  keyword: string;
  created_at?: string;
};

const UNIQUE_VIOLATION = "23505";

export async function listKeywords(client: SupabaseClient): Promise<Keyword[]> {
  const { data, error } = await client
    .from("keywords")
    .select("id, keyword, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Keyword[];
}

export async function addKeyword(client: SupabaseClient, rawKeyword: string): Promise<Keyword> {
  const keyword = rawKeyword.trim();

  if (keyword.length === 0) {
    throw new Error("キーワードを入力してください");
  }

  const { data, error } = await client
    .from("keywords")
    .insert({ keyword })
    .select("id, keyword")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error("このキーワードはすでに登録されています");
    }
    throw new Error(error.message);
  }

  return data as Keyword;
}

export async function deleteKeyword(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("keywords").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
