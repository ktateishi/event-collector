import { callGenerateContent, type GeminiEnv } from "./gemini-client";
import { resolveGroundingUrl } from "./fetch-page";
import { buildSearchPrompt } from "./gemini-prompt";

const MAX_URLS_PER_KEYWORD = 6;

type GroundingChunk = { web?: { uri?: string } };

/**
 * キーワードについてGoogle検索グラウンディング付きでGeminiに調べさせ、
 * groundingChunksから実際に参照されたURL（中継URLを解決した本物のURL）を
 * 重複除去・件数上限つきで返す。テキスト出力自体は使わない
 * （抽出はgemini-extract.tsが実ページ本文を見て行う）。
 */
export async function searchGroundingUrls(env: GeminiEnv, keyword: string): Promise<string[]> {
  const data = await callGenerateContent(env, {
    contents: [{ role: "user", parts: [{ text: buildSearchPrompt(keyword) }] }],
    tools: [{ googleSearch: {} }],
  });

  const chunks: GroundingChunk[] = data?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const redirectUrls = chunks
    .map((chunk) => chunk?.web?.uri)
    .filter((uri): uri is string => typeof uri === "string");

  const resolved = await Promise.all(redirectUrls.map((uri) => resolveGroundingUrl(uri)));
  const unique = Array.from(new Set(resolved));

  return unique.slice(0, MAX_URLS_PER_KEYWORD);
}
