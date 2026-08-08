import { createServerSupabaseClient } from "@/lib/supabase";
import { listKeywords } from "@/lib/keywords";
import { KeywordManager } from "./KeywordManager";

export const dynamic = "force-dynamic";

export default async function KeywordsPage() {
  const client = createServerSupabaseClient();
  const keywords = await listKeywords(client);

  return (
    <main>
      <h1>キーワード管理</h1>
      <KeywordManager initialKeywords={keywords} />
    </main>
  );
}
