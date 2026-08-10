import type { Event } from "./events";

export type UrgencyLevel = "urgent" | "soon" | "normal";

const URGENT_THRESHOLD_DAYS = 7;
const SOON_THRESHOLD_DAYS = 30;

function dateOnly(isoLike: string): string {
  return isoLike.slice(0, 10);
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(`${fromDateStr}T00:00:00Z`).getTime();
  const to = new Date(`${toDateStr}T00:00:00Z`).getTime();
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

/**
 * イベント（またはその各occurrence）が持つ日付のうち、今日以降で最も近いものを返す。
 * 詳細画面・一覧の緊急度バッジに使う「次に何が起きるか」の代表日付。
 */
export function nextRelevantDate(event: Event, today: string): string | undefined {
  const sources =
    event.occurrences && event.occurrences.length > 0 ? event.occurrences : [event];

  const upcoming = sources
    .flatMap((source) => [source.event_date, source.registration_opens_at, source.deadline_at])
    .filter((d): d is string => typeof d === "string" && d.length > 0)
    .map(dateOnly)
    .filter((d) => d >= today)
    .sort();

  return upcoming[0];
}

/**
 * 日付の緊急度を3段階で返す。日付がない・すでに過ぎている場合は
 * 強調すべき緊急性がないため normal を返す。
 */
export function urgencyLevel(dateStr: string | undefined, today: string): UrgencyLevel {
  if (!dateStr) {
    return "normal";
  }

  const days = daysBetween(today, dateOnly(dateStr));

  if (days < 0) {
    return "normal";
  }
  if (days <= URGENT_THRESHOLD_DAYS) {
    return "urgent";
  }
  if (days <= SOON_THRESHOLD_DAYS) {
    return "soon";
  }
  return "normal";
}
