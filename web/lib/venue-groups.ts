import type { Event } from "./events";
import { normalizeTitle } from "./normalize-title";

// occurrencesの label に具体的な会場名が入っていない場合のデフォルト値（ingest.ts参照）。
// これで揃えても「同じ会場」ではなく「会場情報が無い」だけなのでグループ化しない
const DEFAULT_LABEL = normalizeTitle("開催");

// 「東京会場」等、複数の巡回展で使い回される一般的な地域名だけでの
// 誤グルーピングを避けるための下限文字数（「三鷹の森ジブリ美術館」「台北展前売券」等、
// 実際に同一イベント・同一会場を指す固有名詞は十分長いことを利用する）
const MIN_LABEL_LENGTH = 6;

/**
 * イベントが持つ単一のoccurrenceのlabelから、グルーピングに使える会場名を取り出す。
 * 複数occurrence（Task 18で既に1イベントにまとめ済みの巡回展等）は対象外にする
 * （その内訳の一部の会場名だけで、別イベントと誤って結びつけないため）。
 */
function venueGroupingKey(event: Event): string | undefined {
  const occurrences = event.occurrences ?? [];
  if (occurrences.length !== 1) {
    return undefined;
  }

  const label = normalizeTitle(occurrences[0].label);
  if (label === DEFAULT_LABEL || label.length < MIN_LABEL_LENGTH) {
    return undefined;
  }

  return label;
}

/**
 * 同じ会場（occurrenceのlabel）を指す単発イベントを、表示用に束ねる。
 * 別々のイベントとしてDBに残したまま（通知は個別のまま）、一覧表示だけをまとめる
 * （ユーザー要望: 「Lines of EVANGELION 台北展」と「...前売券発売」、
 * 「三鷹の森ジブリ美術館」の上映作品と企画展示、が別イベント表示になっていた件）。
 */
export function clusterEventsByVenue(events: Event[]): Event[][] {
  const clusters: Event[][] = [];
  const labelToClusterIndex = new Map<string, number>();

  for (const event of events) {
    const key = venueGroupingKey(event);
    const existingIndex = key ? labelToClusterIndex.get(key) : undefined;

    if (existingIndex !== undefined) {
      clusters[existingIndex].push(event);
      continue;
    }

    const newIndex = clusters.length;
    clusters.push([event]);
    if (key) {
      labelToClusterIndex.set(key, newIndex);
    }
  }

  return clusters;
}
