/**
 * 同一イベントの個々の開催（会場・地域）を表す。
 * 例: 巡回展の「東京会場」「名古屋会場」、映画の「全米公開」「日本公開」。
 */
export type Occurrence = {
  label: string;
  event_date?: string;
  /** 開催終了日（分かる場合のみ）。event_dateは開始日であり終了日ではないため、
   *  「まだ開催中か」「安全に削除してよいか」の判定にはこちらを優先して使う */
  event_end_date?: string;
  registration_opens_at?: string;
  deadline_at?: string;
  url?: string;
};

/** 「明らかに古い」とみなす日数。終了日が不明な単発の開始日だけの情報を
 *  取り込み時に弾く際の閾値（展覧会等は数ヶ月続くことがあるため長めに取る） */
const STALE_THRESHOLD_DAYS = 180;

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
 * フィールド（url・終了日・締切等）を新しい情報で埋める。
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
      event_end_date: target.event_end_date ?? candidate.event_end_date,
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

function dateOnly(isoLike: string): string {
  return isoLike.slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(`${fromDateStr}T00:00:00Z`).getTime();
  const to = new Date(`${toDateStr}T00:00:00Z`).getTime();
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

type OccurrenceStatus = "ended" | "upcoming" | "unknown";

/**
 * 表示フィルタ（isEnded）用の判定。終了日があればそれを、なければ単日イベントとして
 * event_dateを、それも無ければdeadline_atを使う。何も無ければ判定不能（unknown）とし、
 * 「判断できないものは隠さない」方針を守る。
 */
function statusForDisplay(occurrence: Occurrence, today: string): OccurrenceStatus {
  if (occurrence.event_end_date) {
    return occurrence.event_end_date < today ? "ended" : "upcoming";
  }
  if (occurrence.event_date) {
    return occurrence.event_date < today ? "ended" : "upcoming";
  }
  if (occurrence.deadline_at) {
    return dateOnly(occurrence.deadline_at) < today ? "ended" : "upcoming";
  }
  return "unknown";
}

/**
 * 全occurrenceが終了しているか（一覧のデフォルト表示から外してよいか）を判定する。
 * 1つでも「開催予定」または「判定不能」のoccurrenceがあれば false
 * （巡回展で1会場でも残っていれば表示し続ける。判断できないものは隠さない）。
 */
export function isEnded(occurrences: Occurrence[], today: string): boolean {
  if (occurrences.length === 0) {
    return false;
  }
  return occurrences.every((o) => statusForDisplay(o, today) === "ended");
}

/**
 * 収集・取り込み時に「明らかに終了済み」のイベントを弾くための判定
 * （Task 20: ゴミをそもそもDBに入れない）。
 *
 * event_end_dateやdeadline_atがあれば厳密に判定する。event_dateしか無い場合は
 * 「開始日は過ぎているが、展覧会等はまだ続いているかもしれない」ため、
 * STALE_THRESHOLD_DAYSを超えて明らかに古い場合のみ「終了済み」とみなす
 * （直近の開始日だけでは弾かない＝見逃し防止を優先）。
 */
function isOccurrenceDefinitelyOver(occurrence: Occurrence, today: string): boolean {
  if (occurrence.event_end_date) {
    return occurrence.event_end_date < today;
  }
  if (occurrence.event_date) {
    if (occurrence.event_date >= today) {
      return false;
    }
    return daysBetween(occurrence.event_date, today) > STALE_THRESHOLD_DAYS;
  }
  if (occurrence.deadline_at) {
    return dateOnly(occurrence.deadline_at) < today;
  }
  return false;
}

export function isAlreadyOver(occurrences: Occurrence[], today: string): boolean {
  if (occurrences.length === 0) {
    return false;
  }
  return occurrences.every((o) => isOccurrenceDefinitelyOver(o, today));
}

/**
 * 物理削除してよいかの判定（Task 20: 猶予期間つき削除）。
 * isEnded/isAlreadyOverより厳格で、**明示的な終了日情報がある場合のみ**判定する。
 * event_dateしか無いoccurrence（終了日が不明）が1件でもあれば、
 * どれだけ古くても削除しない（推測で消さない）。
 */
export function isSafelyDeletable(
  occurrences: Occurrence[],
  today: string,
  gracePeriodDays: number
): boolean {
  if (occurrences.length === 0) {
    return false;
  }

  const confirmedEnds: (string | undefined)[] = occurrences.map((o) => {
    if (o.event_end_date) return o.event_end_date;
    // event_dateが無く締切日時だけの回（例:受付のみのoccurrence）は締切を確定終了とみなす
    if (!o.event_date && o.deadline_at) return dateOnly(o.deadline_at);
    return undefined;
  });

  if (confirmedEnds.some((end) => end === undefined)) {
    return false;
  }

  const latestEnd = [...(confirmedEnds as string[])].sort().at(-1)!;
  const deletableFrom = addDays(latestEnd, gracePeriodDays);

  return today > deletableFrom;
}
