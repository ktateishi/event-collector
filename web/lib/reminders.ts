import type { Event } from "./events";
import { dateInJst } from "./today";

// LINE Flex Messageのカルーセルは1メッセージにつき最大12バブルという技術的な上限がある。
// 超過分は次回以降の実行で拾われる（1件も取りこぼさないため、選定はしない）
export const MAX_REMINDER_EVENTS = 12;

function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * イベント（またはその各occurrence）のregistration_opens_at/deadline_atのいずれかが、
 * 「today（JST）からdaysBefore日後」ちょうどに一致すればリマインド対象とする。
 * occurrencesが空のイベントは自身のトップレベルの日付にフォールバックする。
 */
function isReminderDue(event: Event, today: string, daysBefore: number): boolean {
  const sources =
    event.occurrences && event.occurrences.length > 0 ? event.occurrences : [event];
  const targetDate = addDaysToDateString(today, daysBefore);

  return sources.some((source) => {
    const dates = [source.registration_opens_at, source.deadline_at].filter(
      (d): d is string => typeof d === "string" && d.length > 0
    );
    return dates.some((d) => dateInJst(d) === targetDate);
  });
}

export function selectEventsForReminder(
  events: Event[],
  today: string,
  daysBefore: number
): Event[] {
  return events
    .filter((event) => isReminderDue(event, today, daysBefore))
    .slice(0, MAX_REMINDER_EVENTS);
}
