import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase";
import { listEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

const CONFIDENCE_LABEL: Record<string, string> = {
  confirmed: "確実",
  exploratory: "探索",
};

export default async function EventsPage() {
  const client = createServerSupabaseClient();
  const events = await listEvents(client);

  return (
    <main>
      <h1>収集したイベント一覧</h1>
      {events.length === 0 && <p>まだイベントがありません。</p>}
      <ul>
        {events.map((event) => (
          <li key={event.id}>
            <span aria-label={CONFIDENCE_LABEL[event.confidence] ?? event.confidence}>
              [{CONFIDENCE_LABEL[event.confidence] ?? event.confidence}]
            </span>{" "}
            <Link href={`/events/${event.id}`}>{event.title}</Link>
            {event.event_date && <span> — {event.event_date}</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
