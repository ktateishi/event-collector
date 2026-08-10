import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getEventById } from "@/lib/events";
import { categoryColorClass } from "@/lib/colors";
import { urgencyLevel } from "@/lib/urgency";
import { Badge } from "@/components/Badge";
import {
  CONFIDENCE_CLASS,
  CONFIDENCE_LABEL,
  NEUTRAL_CLASS,
  URGENCY_CLASS,
  URGENCY_LABEL,
} from "@/components/badgeStyles";

export const dynamic = "force-dynamic";

const MATCHED_VIA_LABEL: Record<string, string> = {
  direct: "登録キーワード直接一致",
  expanded: "AI拡張語経由",
};

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = createServerSupabaseClient();
  const event = await getEventById(client, id);

  if (!event) {
    notFound();
  }

  const occurrences = event.occurrences ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="flex flex-col gap-6">
      <Link
        href="/events"
        className="w-fit text-sm font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-500"
      >
        ← イベント一覧に戻る
      </Link>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {event.source_keyword && (
            <Badge className={categoryColorClass(event.source_keyword)}>
              {event.source_keyword}
            </Badge>
          )}
          <Badge className={CONFIDENCE_CLASS[event.confidence] ?? NEUTRAL_CLASS}>
            {CONFIDENCE_LABEL[event.confidence] ?? event.confidence}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{event.title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {MATCHED_VIA_LABEL[event.matched_via] ?? event.matched_via}: {event.matched_keyword}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-800 dark:bg-slate-900">
        <dl className="flex flex-col gap-2">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-slate-500 dark:text-slate-400">取得元</dt>
            <dd className="text-slate-900 dark:text-slate-100">{event.source}</dd>
          </div>
          {event.url && (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-slate-500 dark:text-slate-400">リンク</dt>
              <dd className="min-w-0 truncate">
                <a
                  href={event.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 hover:underline dark:text-brand-500"
                >
                  {event.url}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          開催情報（{occurrences.length}件）
        </h2>

        {occurrences.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            開催情報が登録されていません。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {occurrences.map((occurrence, index) => {
              const level = urgencyLevel(occurrence.event_date, today);

              return (
                <li
                  key={`${occurrence.label}-${occurrence.event_date ?? index}`}
                  className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {occurrence.label}
                    </p>
                    {(level === "urgent" || level === "soon") && (
                      <Badge className={URGENCY_CLASS[level]}>{URGENCY_LABEL[level]}</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5 text-slate-500 dark:text-slate-400">
                    {occurrence.event_date && <span>開催日: {occurrence.event_date}</span>}
                    {occurrence.registration_opens_at && (
                      <span>受付開始: {occurrence.registration_opens_at}</span>
                    )}
                    {occurrence.deadline_at && <span>締切: {occurrence.deadline_at}</span>}
                    {occurrence.url && (
                      <a
                        href={occurrence.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-brand-600 hover:underline dark:text-brand-500"
                      >
                        {occurrence.url}
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
