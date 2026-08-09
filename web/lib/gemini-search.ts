import { callGenerateContent, type GeminiEnv } from "./gemini-client";
import { resolveGroundingUrl } from "./fetch-page";
import { buildCoreSearchPrompt, buildExpansionSearchPrompt } from "./gemini-prompt";

const MAX_URLS_PER_KEYWORD = 12;

type GroundingChunk = { web?: { uri?: string } };

async function searchWithPrompt(env: GeminiEnv, prompt: string): Promise<string[]> {
  const data = await callGenerateContent(env, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
  });

  const chunks: GroundingChunk[] = data?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const redirectUrls = chunks
    .map((chunk) => chunk?.web?.uri)
    .filter((uri): uri is string => typeof uri === "string");

  return Promise.all(redirectUrls.map((uri) => resolveGroundingUrl(uri)));
}

/**
 * キーワードについてGoogle検索グラウンディングでURLを収集する。2種類の検索を行う:
 *
 * 1. 定番クエリ（「キーワード イベント」等）— コード側で明示的に指定し、
 *    モデルの判断だけに頼らず確実に検索させる（実運用で「Googleで直接検索すれば
 *    一番上に出るのに拾えていない」という抜け漏れが判明したための対策）
 * 2. 拡張検索（声優・スタジオ・コラボ相手等）— モデル自身の知識・判断による拡張
 *
 * どちらか一方が失敗しても、もう一方の結果は返す。
 */
export async function searchGroundingUrls(env: GeminiEnv, keyword: string): Promise<string[]> {
  const results = await Promise.allSettled([
    searchWithPrompt(env, buildCoreSearchPrompt(keyword)),
    searchWithPrompt(env, buildExpansionSearchPrompt(keyword)),
  ]);

  const urls = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const unique = Array.from(new Set(urls));

  return unique.slice(0, MAX_URLS_PER_KEYWORD);
}
