import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getEventById } from "@/lib/events";

export const dynamic = "force-dynamic";

const CONFIDENCE_LABEL: Record<string, string> = {
  confirmed: "確実",
  exploratory: "探索",
};

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

  return (
    <main>
      <h1>{event.title}</h1>
      {event.source_keyword && <p>カテゴリ: {event.source_keyword}</p>}
      <p>
        判定: {CONFIDENCE_LABEL[event.confidence] ?? event.confidence}（
        {MATCHED_VIA_LABEL[event.matched_via] ?? event.matched_via}: {event.matched_keyword}）
      </p>
      <dl>
        <dt>取得元</dt>
        <dd>{event.source}</dd>
        {event.url && (
          <>
            <dt>リンク</dt>
            <dd>
              <a href={event.url} target="_blank" rel="noreferrer">
                {event.url}
              </a>
            </dd>
          </>
        )}
      </dl>

      <h2>開催情報（{occurrences.length}件）</h2>
      {occurrences.length === 0 && <p>開催情報が登録されていません。</p>}
      <ul>
        {occurrences.map((occurrence, index) => (
          <li key={`${occurrence.label}-${occurrence.event_date ?? index}`}>
            <strong>{occurrence.label}</strong>
            {occurrence.event_date && <span> — 開催日: {occurrence.event_date}</span>}
            {occurrence.registration_opens_at && (
              <span> / 受付開始: {occurrence.registration_opens_at}</span>
            )}
            {occurrence.deadline_at && <span> / 締切: {occurrence.deadline_at}</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
