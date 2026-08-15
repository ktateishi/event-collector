import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase";
import { listExcludedEvents } from "@/lib/events";
import { categoryColorClass } from "@/lib/colors";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { RestoreButton } from "@/components/RestoreButton";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  category: "自動除外（グッズ発売等）",
  manual: "手動で「不要」に設定",
};

export default async function ExcludedEventsPage() {
  const client = createServerSupabaseClient();
  const events = await listExcludedEvents(client);

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          非表示にしたイベント
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          自動除外・「不要」フラグで非表示になっているイベントです。「元に戻す」で一覧・通知に再表示できます。
        </p>
        <Link
          href="/events"
          className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline dark:text-brand-500"
        >
          ← イベント一覧に戻る
        </Link>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="非表示にしたイベントはありません"
          description="「不要」フラグを付けたイベントや、自動除外されたイベントがここに表示されます。"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {event.source_keyword && (
                    <Badge className={categoryColorClass(event.source_keyword)}>
                      {event.source_keyword}
                    </Badge>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {REASON_LABEL[event.excluded_reason ?? ""] ?? event.excluded_reason}
                  </span>
                </div>
                <Link
                  href={`/events/${event.id}`}
                  className="truncate font-medium text-slate-900 hover:text-brand-600 dark:text-slate-100 dark:hover:text-brand-500"
                >
                  {event.title}
                </Link>
              </div>
              <RestoreButton eventId={event.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
