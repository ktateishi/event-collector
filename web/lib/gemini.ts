import type { GeminiEnv } from "./gemini-client";
import { searchGroundingUrls } from "./gemini-search";
import { fetchPageText } from "./fetch-page";
import { extractEventsFromPages } from "./gemini-extract";
import type { CandidateEvent } from "./ingest";

export type { GeminiEnv } from "./gemini-client";

/**
 * 3段階パイプライン:
 * 1. searchGroundingUrls  — Google検索グラウンディングで実URL一覧を取得
 * 2. fetchPageText        — 各URLの実ページ本文をブラウザUAで取得（404/取得失敗は除外）
 * 3. extractEventsFromPages — 実ページ本文から構造化イベント情報を抽出
 *
 * URLをモデルに「書かせる」のではなく、実際に検索・取得したページだけを対象にすることで、
 * リンク切れ・情報の幻覚を防ぐ（詳細: docs/research/secrets-handling.md）。
 */
export async function collectEventsForKeyword(
  env: GeminiEnv,
  keyword: string
): Promise<CandidateEvent[]> {
  const urls = await searchGroundingUrls(env, keyword);

  if (urls.length === 0) {
    return [];
  }

  const fetched = await Promise.all(urls.map((url) => fetchPageText(url)));
  const pages = fetched.filter(
    (page): page is { url: string; text: string } => page !== null && page.text.length > 0
  );

  return extractEventsFromPages(env, keyword, pages);
}
