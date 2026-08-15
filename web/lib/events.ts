import type { SupabaseClient } from "@supabase/supabase-js";
import { isEnded, isSafelyDeletable, type Occurrence } from "./occurrences";

export type Event = {
  id: string;
  title: string;
  source: string;
  url?: string;
  matched_keyword: string;
  /** どの登録キーワードのために収集したか（カテゴリ分け用、Task 17） */
  source_keyword?: string;
  matched_via: "direct" | "expanded";
  confidence: "confirmed" | "exploratory";
  event_date?: string;
  registration_opens_at?: string;
  deadline_at?: string;
  occurrences?: Occurrence[];
  /** LINE Flex Messageカルーセルのカード分類（固定値、Gemini抽出時に判定） */
  category?: EventCategory;
  /** カード表示用の1行要約（Gemini抽出時に生成） */
  summary?: string;
  /** 収集済みページのog:imageから抽出した実画像（あれば最優先で使う） */
  image_url?: string;
  /** 不要イベントの除外機構（SPEC.md）。nullなら表示対象 */
  excluded_at?: string;
  excluded_reason?: string;
  created_at: string;
};

export const EVENT_CATEGORIES = [
  "movie",
  "exhibition",
  "game",
  "concert",
  "collab",
  "other",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const UNCATEGORIZED_LABEL = "未分類";

/**
 * 登録キーワードごとにイベントをグループ化する（Task 17）。
 * source_keywordを持たない古いイベントは「未分類」にまとめ、最後に並べる。
 */
export function groupEventsByKeyword(events: Event[]): { keyword: string; events: Event[] }[] {
  const groups = new Map<string, Event[]>();

  for (const event of events) {
    const key = event.source_keyword?.trim() || UNCATEGORIZED_LABEL;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(event);
    } else {
      groups.set(key, [event]);
    }
  }

  return Array.from(groups.entries())
    .map(([keyword, groupedEvents]) => ({ keyword, events: groupedEvents }))
    .sort((a, b) => {
      if (a.keyword === UNCATEGORIZED_LABEL) return 1;
      if (b.keyword === UNCATEGORIZED_LABEL) return -1;
      return a.keyword.localeCompare(b.keyword, "ja");
    });
}

/**
 * 全occurrenceが終了しているイベントを一覧から除く（Task 20）。
 * 巡回展のように1会場でも残っていれば表示し続ける（isEnded参照）。
 * 日付情報がなく判定できないイベントは安全側に倒して表示に残す。
 */
export function filterUpcoming(events: Event[], today: string): Event[] {
  return events.filter((event) => !isEnded(event.occurrences ?? [], today));
}

export async function getEventCount(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from("events")
    .select("*", { count: "exact", head: true });

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

/**
 * 除外済み（excluded_at設定済み）イベントを一律で除く（不要イベントの除外機構、SPEC.md）。
 * イベント一覧・LINE新着選定（selectEventsToNotify）・リマインド判定（selectEventsForReminder）
 * すべてこの関数経由でイベントを取得するため、取得層で一元的にフィルタする
 */
export async function listEvents(client: SupabaseClient): Promise<Event[]> {
  const { data, error } = await client
    .from("events")
    .select("*")
    .is("excluded_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Event[];
}

/**
 * 除外済みイベントの一覧（不要イベントの除外機構、SPEC.md）。
 * 「不要」フラグの取り消しUIから使う
 */
export async function listExcludedEvents(client: SupabaseClient): Promise<Event[]> {
  const { data, error } = await client
    .from("events")
    .select("*")
    .not("excluded_at", "is", null)
    .order("excluded_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Event[];
}

/** 除外フラグを取り消し、一覧・通知の対象に戻す */
export async function restoreEvent(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client
    .from("events")
    .update({ excluded_at: null, excluded_reason: null })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getEventById(client: SupabaseClient, id: string): Promise<Event | null> {
  const { data, error } = await client.from("events").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as Event | null;
}

/**
 * 猶予期間を過ぎて安全に削除してよいイベントのIDを選ぶ（Task 20）。
 * 終了日が明示されていないイベントは対象にしない（isSafelyDeletable参照）。
 */
export function selectDeletableEventIds(
  events: Event[],
  today: string,
  gracePeriodDays: number
): string[] {
  return events
    .filter((event) => isSafelyDeletable(event.occurrences ?? [], today, gracePeriodDays))
    .map((event) => event.id);
}
