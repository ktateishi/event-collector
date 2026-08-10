import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getEventCount } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const client = createServerSupabaseClient();
  const count = await getEventCount(client);

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          event_collector
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          見逃したくないイベント情報を毎日収集する
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">収集済みイベント</p>
        <p className="mt-1 text-3xl font-bold text-brand-600 dark:text-brand-500">{count} 件</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/events"
          className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-brand-500 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500 dark:hover:bg-brand-500/10"
        >
          <p className="font-semibold text-slate-900 dark:text-slate-100">イベント一覧</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            収集したイベントをキーワードごとに確認する
          </p>
        </Link>
        <Link
          href="/keywords"
          className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-brand-500 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500 dark:hover:bg-brand-500/10"
        >
          <p className="font-semibold text-slate-900 dark:text-slate-100">キーワード管理</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            収集対象のキーワードを追加・削除する
          </p>
        </Link>
      </div>
    </main>
  );
}
