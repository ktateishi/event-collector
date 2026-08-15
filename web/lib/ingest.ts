import type { SupabaseClient } from "@supabase/supabase-js";
import { earliestDate, isAlreadyOver, mergeOccurrences, type Occurrence } from "./occurrences";
import { normalizeTitle } from "./normalize-title";
import { EVENT_CATEGORIES, type EventCategory } from "./events";
import { todayInJst } from "./today";

export type CandidateEvent = {
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
  /** 同一イベントの複数会場・複数地域（Task 18） */
  occurrences?: Occurrence[];
  /** LINE Flex Messageカルーセルのカード分類（固定値、Gemini抽出時に判定） */
  category?: EventCategory;
  /** カード表示用の1行要約（Gemini抽出時に生成） */
  summary?: string;
  /** 収集済みページのog:imageから抽出した実画像（あれば最優先で使う） */
  image_url?: string;
};

export type IngestResult = {
  inserted: CandidateEvent[];
  /** 既存イベントにoccurrencesを追加したもの（新会場の追加発表など） */
  merged: { title: string; addedOccurrences: number }[];
  wouldInsert: CandidateEvent[];
  skipped: {
    candidate: Partial<CandidateEvent>;
    reason: "duplicate" | "invalid" | "already_over";
  }[];
};

type ExistingEvent = {
  id: string;
  title: string;
  occurrences?: Occurrence[];
  category?: EventCategory;
  summary?: string;
  image_url?: string;
  excluded_at?: string;
  excluded_reason?: string;
};

/**
 * category=collabのイベントを自動除外する（不要情報の除外機構、2026-08-13、SPEC.md参照）。
 * 既にexcluded_atが設定済み（手動フラグ含む）なら絶対に上書きしない
 * （自動判定で「不要ではない」に戻すことはしない）。
 */
function excludedFieldsFor(
  category: EventCategory | undefined,
  existingExcludedAt: string | undefined,
  existingExcludedReason: string | undefined
): { excluded_at?: string; excluded_reason?: string } {
  if (existingExcludedAt) {
    return { excluded_at: existingExcludedAt, excluded_reason: existingExcludedReason };
  }
  if (category === "collab") {
    return { excluded_at: new Date().toISOString(), excluded_reason: "category" };
  }
  return {};
}

const VALID_MATCHED_VIA = new Set(["direct", "expanded"]);
const VALID_CONFIDENCE = new Set(["confirmed", "exploratory"]);

/**
 * 重複判定はtitleのみで行う（sourceは含めない）。同一イベントが複数の
 * ニュースサイト（PR TIMES・ファミ通・公式サイト等）から別々に報じられ、
 * それぞれ抽出されるケースが実運用で確認されたため。
 * タイトルは括弧・空白等の表記ゆれを吸収してから比較する（Task 20）。
 */
function dedupeKey(title: string): string {
  return normalizeTitle(title);
}

function isValid(candidate: CandidateEvent): boolean {
  return (
    typeof candidate.title === "string" &&
    candidate.title.trim().length > 0 &&
    typeof candidate.source === "string" &&
    candidate.source.trim().length > 0 &&
    typeof candidate.matched_keyword === "string" &&
    candidate.matched_keyword.trim().length > 0 &&
    VALID_MATCHED_VIA.has(candidate.matched_via) &&
    VALID_CONFIDENCE.has(candidate.confidence)
  );
}

export async function ingestEvents(
  client: SupabaseClient,
  candidates: CandidateEvent[],
  options: { dryRun: boolean; today?: string }
): Promise<IngestResult> {
  const today = options.today ?? todayInJst();

  const { data: existingRows, error } = await client
    .from("events")
    .select("id, title, occurrences, category, summary, image_url, excluded_at, excluded_reason");

  if (error) {
    throw new Error(error.message);
  }

  const existingByKey = new Map<string, ExistingEvent>();
  for (const row of (existingRows ?? []) as ExistingEvent[]) {
    existingByKey.set(dedupeKey(row.title), row);
  }

  const result: IngestResult = { inserted: [], merged: [], wouldInsert: [], skipped: [] };

  for (const candidate of candidates) {
    if (!isValid(candidate)) {
      result.skipped.push({ candidate, reason: "invalid" });
      continue;
    }

    const incomingOccurrences = candidate.occurrences ?? [];

    // 収集時点で既に終了しているイベントはそもそも取り込まない（Task 20）。
    // これをしないと、削除した過去イベントが翌日また「新規」として
    // 再収集され、LINE通知で終了済みイベントが新着として届いてしまう
    if (isAlreadyOver(incomingOccurrences, today)) {
      result.skipped.push({ candidate, reason: "already_over" });
      continue;
    }

    const key = dedupeKey(candidate.title);
    const existing = existingByKey.get(key);

    // 既存イベントがある場合はスキップせず、occurrencesをマージして更新する。
    // 後から発表された会場（1回目は2会場、2回目は4会場が判明、等）を
    // 取りこぼさないための処理（tasks/todo.md Task 18参照）。
    if (existing) {
      const existingOccurrences = existing.occurrences ?? [];
      const merged = mergeOccurrences(existingOccurrences, incomingOccurrences);
      const addedCount = merged.length - existingOccurrences.length;

      // category/summary/image_urlは既存イベントに欠けていれば埋める
      // （本機能追加前に収集済みのイベントへの後埋め、occurrencesと同じ「既存優先」方針）
      const nextCategory = existing.category ?? candidate.category;
      const nextSummary = existing.summary ?? candidate.summary;
      const nextImageUrl = existing.image_url ?? candidate.image_url;
      const nextExcluded = excludedFieldsFor(
        nextCategory,
        existing.excluded_at,
        existing.excluded_reason
      );
      const backfilled =
        nextCategory !== existing.category ||
        nextSummary !== existing.summary ||
        nextImageUrl !== existing.image_url ||
        nextExcluded.excluded_at !== existing.excluded_at;

      if (addedCount === 0 && !backfilled) {
        result.skipped.push({ candidate, reason: "duplicate" });
        continue;
      }

      if (options.dryRun) {
        result.merged.push({ title: candidate.title, addedOccurrences: addedCount });
        continue;
      }

      const { error: updateError } = await client
        .from("events")
        .update({
          occurrences: merged,
          event_date: earliestDate(merged) ?? candidate.event_date,
          category: nextCategory,
          summary: nextSummary,
          image_url: nextImageUrl,
          ...nextExcluded,
        })
        .eq("id", existing.id);

      if (updateError) {
        result.skipped.push({ candidate, reason: "invalid" });
        continue;
      }

      existing.occurrences = merged;
      existing.category = nextCategory;
      existing.summary = nextSummary;
      existing.image_url = nextImageUrl;
      existing.excluded_at = nextExcluded.excluded_at;
      existing.excluded_reason = nextExcluded.excluded_reason;
      result.merged.push({ title: candidate.title, addedOccurrences: addedCount });
      continue;
    }

    if (options.dryRun) {
      existingByKey.set(key, { id: "dry-run", title: candidate.title, occurrences: incomingOccurrences });
      result.wouldInsert.push(candidate);
      continue;
    }

    const row = {
      ...candidate,
      occurrences: incomingOccurrences,
      event_date: earliestDate(incomingOccurrences) ?? candidate.event_date,
      ...excludedFieldsFor(candidate.category, undefined, undefined),
    };

    const { data, error: insertError } = await client
      .from("events")
      .insert(row)
      .select("id, title, source, matched_keyword, source_keyword, matched_via, confidence")
      .single();

    if (insertError) {
      result.skipped.push({ candidate, reason: "invalid" });
      continue;
    }

    existingByKey.set(key, {
      id: (data as { id: string }).id,
      title: candidate.title,
      occurrences: incomingOccurrences,
    });
    result.inserted.push(data as CandidateEvent);
  }

  return result;
}
