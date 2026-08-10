import type { EventCategory } from "./events";
import { getSiteUrl } from "./site-url";

const ICON_FILENAMES: Record<EventCategory, string> = {
  movie: "movie.png",
  exhibition: "exhibition.png",
  game: "game.png",
  concert: "concert.png",
  collab: "collab.png",
  other: "other.png",
};

/**
 * イベント画像(og:image)が取れなかった場合のフォールバック。
 * カテゴリごとに常に同じ汎用アイコンを返す（web/public/icons/配下、自ドメインでホスト）。
 * category未確定（既存データ・分類失敗）はotherにフォールバックする。
 */
export function categoryIconUrl(
  category: EventCategory | undefined,
  siteUrl: string = getSiteUrl()
): string {
  const base = siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;
  const filename = ICON_FILENAMES[category ?? "other"];

  return `${base}/icons/${filename}`;
}
