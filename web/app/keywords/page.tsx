import { createServerSupabaseClient } from "@/lib/supabase";
import { listKeywords } from "@/lib/keywords";
import { KeywordManager } from "./KeywordManager";

export const dynamic = "force-dynamic";

export default async function KeywordsPage() {
  const client = createServerSupabaseClient();
  const keywords = await listKeywords(client);

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">キーワード管理</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          登録したキーワードをもとに毎朝イベントを収集します。
        </p>
      </div>
      <KeywordManager initialKeywords={keywords} />
    </main>
  );
}
