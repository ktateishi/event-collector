import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase";
import { filterUpcoming, groupEventsByKeyword, listEvents, type Event } from "@/lib/events";

export const dynamic = "force-dynamic";

const CONFIDENCE_LABEL: Record<string, string> = {
  confirmed: "確実",
  exploratory: "探索",
};

function occurrenceSummary(event: Event): string | null {
  const occurrences = event.occurrences ?? [];

  if (occurrences.length === 0) {
    return event.event_date ?? null;
  }

  if (occurrences.length === 1) {
    const only = occurrences[0];
    return [only.label, only.event_date].filter(Boolean).join(" ");
  }

  return `${occurrences.length}会場・地域（${occurrences
    .map((o) => o.label)
    .slice(0, 3)
    .join(" / ")}${occurrences.length > 3 ? " ほか" : ""}）`;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { all } = await searchParams;
  const showAll = all === "1";

  const client = createServerSupabaseClient();
  const allEvents = await listEvents(client);
  const today = new Date().toISOString().slice(0, 10);
  const events = showAll ? allEvents : filterUpcoming(allEvents, today);
  const groups = groupEventsByKeyword(events);
  const hiddenCount = allEvents.length - events.length;

  return (
    <main>
      <h1>収集したイベント一覧</h1>
      {!showAll && hiddenCount > 0 && (
        <p>
          終了したイベント{hiddenCount}件を非表示にしています。
          <Link href="/events?all=1">すべて表示</Link>
        </p>
      )}
      {showAll && (
        <p>
          <Link href="/events">開催予定のみ表示に戻す</Link>
        </p>
      )}
      {groups.length === 0 && <p>まだイベントがありません。</p>}
      {groups.map((group) => (
        <section key={group.keyword}>
          <h2>
            {group.keyword}（{group.events.length}件）
          </h2>
          <ul>
            {group.events.map((event) => {
              const summary = occurrenceSummary(event);
              return (
                <li key={event.id}>
                  <span>[{CONFIDENCE_LABEL[event.confidence] ?? event.confidence}]</span>{" "}
                  <Link href={`/events/${event.id}`}>{event.title}</Link>
                  {summary && <span> — {summary}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
