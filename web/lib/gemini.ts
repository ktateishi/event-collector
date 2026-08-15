import type { GeminiEnv } from "./gemini-client";
import { searchGroundingUrls } from "./gemini-search";
import { fetchPageText } from "./fetch-page";
import { extractEventsFromPages } from "./gemini-extract";
import { searchYoutube, youtubeResultsToPages, type ExtractionPage } from "./youtube";
import type { CandidateEvent } from "./ingest";

export type { GeminiEnv } from "./gemini-client";

async function collectYoutubePages(apiKey: string, keyword: string): Promise<ExtractionPage[]> {
  try {
    const results = await searchYoutube(apiKey, keyword);
    return youtubeResultsToPages(results);
  } catch {
    // YouTube検索の失敗（クォータ超過等）で収集全体を止めない。他ソースの結果は活かす
    return [];
  }
}

/**
 * 収集パイプライン:
 * 1. searchGroundingUrls  — Google検索グラウンディングで実URL一覧を取得
 * 2. fetchPageText / searchYoutube — 各URLの実ページ本文（ブラウザUA）と、
 *    YouTube検索結果（構造化データ、Task 21）を並行取得
 * 3. extractEventsFromPages — 集めたページから構造化イベント情報を抽出
 *
 * URLをモデルに「書かせる」のではなく、実際に検索・取得したページだけを対象にすることで、
 * リンク切れ・情報の幻覚を防ぐ（詳細: docs/research/secrets-handling.md）。
 * YouTubeはyoutubeApiKeyが未設定なら黙ってスキップする（v1からの既存方針を踏襲）。
 */
export async function collectEventsForKeyword(
  env: GeminiEnv,
  keyword: string,
  youtubeApiKey?: string,
  excludedTitles: string[] = []
): Promise<CandidateEvent[]> {
  const urls = await searchGroundingUrls(env, keyword);

  const [fetched, youtubePages] = await Promise.all([
    Promise.all(urls.map((url) => fetchPageText(url))),
    youtubeApiKey ? collectYoutubePages(youtubeApiKey, keyword) : Promise.resolve([]),
  ]);

  const webPages = fetched.filter(
    (page): page is { url: string; text: string; imageUrl?: string } =>
      page !== null && page.text.length > 0
  );

  const pages = [...webPages, ...youtubePages];

  if (pages.length === 0) {
    return [];
  }

  return extractEventsFromPages(env, keyword, pages, excludedTitles);
}
