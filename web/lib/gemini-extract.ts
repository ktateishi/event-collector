import { callGenerateContent, type GeminiEnv } from "./gemini-client";
import { buildExtractionPrompt, parseGeminiCandidates } from "./gemini-prompt";
import type { CandidateEvent } from "./ingest";

const EVENT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          source: { type: "string" },
          url: { type: "string" },
          matched_via: { type: "string", enum: ["direct", "expanded"] },
          matched_term: { type: "string" },
          // URLは文字列としてモデルに書かせない（推測・混同による404/誤リンクの原因になるため）。
          // 代わりにpage_id（渡したページの番号）を返させ、呼び出し側で実URLに解決する
          page_id: { type: "integer" },
          // 注意: Vertex AIのresponseSchemaはJSON Schema標準のtype配列
          // （type: ["string","null"]）を受け付けない（400エラー）。
          // 代わりにnullable:trueを使う必要がある
          event_date: { type: "string", nullable: true },
          registration_opens_at: { type: "string", nullable: true },
          deadline_at: { type: "string", nullable: true },
        },
        required: ["title", "source", "page_id", "matched_via", "matched_term"],
      },
    },
  },
  required: ["events"],
};

/**
 * 検索フェーズ(gemini-search.ts)で取得した実ページ本文から、構造化イベント情報を
 * 抽出する。Search Toolを使わないため、responseSchemaによる構造化出力を併用できる
 * （gemini-2.5-flashではSearch Toolと構造化出力は同一リクエストで併用不可のため、
 * フェーズを分けている。詳細: docs/research/secrets-handling.md）。
 */
export async function extractEventsFromPages(
  env: GeminiEnv,
  keyword: string,
  pages: { url: string; text: string }[]
): Promise<CandidateEvent[]> {
  if (pages.length === 0) {
    return [];
  }

  const data = await callGenerateContent(env, {
    contents: [{ role: "user", parts: [{ text: buildExtractionPrompt(keyword, pages) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: EVENT_RESPONSE_SCHEMA,
    },
  });

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof text !== "string") {
    return [];
  }

  return parseGeminiCandidates(text, pages);
}
