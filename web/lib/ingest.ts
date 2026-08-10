import type { SupabaseClient } from "@supabase/supabase-js";
import { earliestDate, isAlreadyOver, mergeOccurrences, type Occurrence } from "./occurrences";
import { normalizeTitle } from "./normalize-title";

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
};

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
  const today = options.today ?? new Date().toISOString().slice(0, 10);

  const { data: existingRows, error } = await client
    .from("events")
    .select("id, title, occurrences");

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

      if (addedCount === 0) {
        result.skipped.push({ candidate, reason: "duplicate" });
        continue;
      }

      if (options.dryRun) {
        result.merged.push({ title: candidate.title, addedOccurrences: addedCount });
        continue;
      }

      const { error: updateError } = await client
        .from("events")
        .update({ occurrences: merged, event_date: earliestDate(merged) ?? candidate.event_date })
        .eq("id", existing.id);

      if (updateError) {
        result.skipped.push({ candidate, reason: "invalid" });
        continue;
      }

      existing.occurrences = merged;
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
