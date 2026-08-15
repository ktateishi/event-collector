import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase";
import { filterUpcoming, groupEventsByKeyword, listEvents } from "@/lib/events";
import { categoryColorClass } from "@/lib/colors";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { EventRow } from "@/components/EventRow";
import { todayInJst } from "@/lib/today";

export const dynamic = "force-dynamic";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { all } = await searchParams;
  const showAll = all === "1";

  const client = createServerSupabaseClient();
  const allEvents = await listEvents(client);
  const today = todayInJst();
  const events = showAll ? allEvents : filterUpcoming(allEvents, today);
  const groups = groupEventsByKeyword(events);
  const hiddenCount = allEvents.length - events.length;

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          収集したイベント一覧
        </h1>
        <div className="flex gap-2 text-sm">
          <Link
            href="/events"
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              !showAll
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            開催予定のみ
          </Link>
          <Link
            href="/events?all=1"
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              showAll
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            すべて表示
          </Link>
          <Link
            href="/events/excluded"
            className="rounded-md px-3 py-1.5 font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            非表示にしたイベント
          </Link>
        </div>
      </div>

      {!showAll && hiddenCount > 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          終了したイベント{hiddenCount}件を非表示にしています。
        </p>
      )}

      {groups.length === 0 ? (
        <EmptyState
          title="まだイベントがありません"
          description="キーワードを登録すると、毎朝自動で収集が始まります。"
          action={
            <Link
              href="/keywords"
              className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-500"
            >
              キーワードを登録する →
            </Link>
          }
        />
      ) : (
        groups.map((group) => (
          <section key={group.keyword} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              <Badge className={categoryColorClass(group.keyword)}>{group.keyword}</Badge>
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                {group.events.length}件
              </span>
            </h2>
            <ul className="flex flex-col gap-2">
              {group.events.map((event) => (
                <EventRow key={event.id} event={event} today={today} />
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
