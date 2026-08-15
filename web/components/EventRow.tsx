import Link from "next/link";
import { Badge } from "./Badge";
import { ExcludeButton } from "./ExcludeButton";
import { CONFIDENCE_CLASS, CONFIDENCE_LABEL, NEUTRAL_CLASS, URGENCY_CLASS, URGENCY_LABEL } from "./badgeStyles";
import type { Event } from "@/lib/events";
import { nextRelevantDate, urgencyLevel } from "@/lib/urgency";

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

export function EventRow({ event, today }: { event: Event; today: string }) {
  const summary = occurrenceSummary(event);
  const level = urgencyLevel(nextRelevantDate(event, today), today);

  return (
    <li className="relative">
      <Link
        href={`/events/${event.id}`}
        className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-4 pr-16 transition-colors hover:border-brand-400 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={CONFIDENCE_CLASS[event.confidence] ?? NEUTRAL_CLASS}>
            {CONFIDENCE_LABEL[event.confidence] ?? event.confidence}
          </Badge>
          {(level === "urgent" || level === "soon") && (
            <Badge className={URGENCY_CLASS[level]}>{URGENCY_LABEL[level]}</Badge>
          )}
        </div>
        <p className="font-medium text-slate-900 dark:text-slate-100">{event.title}</p>
        {summary && <p className="text-sm text-slate-500 dark:text-slate-400">{summary}</p>}
      </Link>
      <ExcludeButton
        eventId={event.id}
        className="absolute right-3 top-3 rounded-md px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
      />
    </li>
  );
}
