/**
 * 同一イベントの個々の開催（会場・地域）を表す。
 * 例: 巡回展の「東京会場」「名古屋会場」、映画の「全米公開」「日本公開」。
 */
export type Occurrence = {
  label: string;
  event_date?: string;
  registration_opens_at?: string;
  deadline_at?: string;
  url?: string;
};

function occurrenceKey(occurrence: Occurrence): string {
  return `${occurrence.label.trim().toLowerCase()}|${occurrence.event_date ?? ""}`;
}

/**
 * 既存のoccurrencesに新しく収集したoccurrencesをマージする。
 *
 * 重複除去をタイトル一致の「スキップ」にしていると、後から発表された会場
 * （1回目は2会場、2回目は4会場が判明、等）を丸ごと取りこぼす。これは本プロジェクトの
 * 最優先課題である「見逃し」そのものなので、既存イベントに対しては
 * スキップではなくこの関数でマージして更新する。
 *
 * 同一occurrence（label + event_dateが一致）の場合は、既存側で欠けていた
 * フィールド（url・締切等）を新しい情報で埋める。
 */
export function mergeOccurrences(
  existing: Occurrence[],
  incoming: Occurrence[]
): Occurrence[] {
  const merged = existing.map((o) => ({ ...o }));
  const indexByKey = new Map(merged.map((o, i) => [occurrenceKey(o), i]));

  for (const candidate of incoming) {
    const key = occurrenceKey(candidate);
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      merged.push({ ...candidate });
      indexByKey.set(key, merged.length - 1);
      continue;
    }

    const target = merged[existingIndex];
    merged[existingIndex] = {
      ...target,
      event_date: target.event_date ?? candidate.event_date,
      registration_opens_at: target.registration_opens_at ?? candidate.registration_opens_at,
      deadline_at: target.deadline_at ?? candidate.deadline_at,
      url: target.url ?? candidate.url,
    };
  }

  return merged;
}

/**
 * occurrencesの中で最も早いevent_dateを返す。イベント全体の代表日付として
 * 並び替え・リマインド判定に使う。
 */
export function earliestDate(occurrences: Occurrence[]): string | undefined {
  const dates = occurrences
    .map((o) => o.event_date)
    .filter((d): d is string => typeof d === "string" && d.length > 0);

  if (dates.length === 0) {
    return undefined;
  }

  return dates.sort()[0];
}
