import type { Event } from "@/lib/events";
import { EventRow } from "./EventRow";

/**
 * 同じ会場（occurrenceのlabel）を指す単発イベントをまとめて表示する
 * （ユーザー要望: 別イベント扱いになっていた同一会場の情報をまとめたい。
 * 通知は個別のままでよいため、DB上は別イベントのまま表示だけをまとめる）
 */
export function VenueGroup({ events, today }: { events: Event[]; today: string }) {
  const label = events[0]?.occurrences?.[0]?.label ?? "同じ会場";

  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <p className="mb-2 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        同じ会場「{label}」で{events.length}件
      </p>
      <ul className="flex flex-col gap-2">
        {events.map((event) => (
          <EventRow key={event.id} event={event} today={today} />
        ))}
      </ul>
    </li>
  );
}
