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

  return (
    <main>
      <h1>{event.title}</h1>
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
        {event.event_date && (
          <>
            <dt>開催日</dt>
            <dd>{event.event_date}</dd>
          </>
        )}
        {event.registration_opens_at && (
          <>
            <dt>受付開始</dt>
            <dd>{event.registration_opens_at}</dd>
          </>
        )}
        {event.deadline_at && (
          <>
            <dt>締切</dt>
            <dd>{event.deadline_at}</dd>
          </>
        )}
      </dl>
    </main>
  );
}
