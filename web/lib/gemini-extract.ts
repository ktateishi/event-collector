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
          // LINE Flex Messageカードの背景画像フォールバック・要約表示に使う（ユーザー要望）
          category: {
            type: "string",
            enum: ["movie", "exhibition", "game", "concert", "collab", "other"],
          },
          summary: { type: "string" },
          // URLは文字列としてモデルに書かせない（推測・混同による404/誤リンクの原因になるため）。
          // 代わりにpage_id（渡したページの番号）を返させ、呼び出し側で実URLに解決する
          page_id: { type: "integer" },
          // 同一イベントの複数会場・複数地域（Task 18）。単一開催でも1件入れる
          occurrences: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                // 注意: Vertex AIのresponseSchemaはJSON Schema標準のtype配列
                // （type: ["string","null"]）を受け付けない（400エラー）。
                // 代わりにnullable:trueを使う必要がある
                event_date: { type: "string", nullable: true },
                // event_dateは開始日。終了日が本文に明記されている場合のみ入れる
                // （推測禁止）。Task 20: 終了済みイベントの自動判定・削除に使う
                event_end_date: { type: "string", nullable: true },
                registration_opens_at: { type: "string", nullable: true },
                deadline_at: { type: "string", nullable: true },
              },
              required: ["label"],
            },
          },
        },
        required: ["title", "source", "page_id", "matched_via", "matched_term", "occurrences"],
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
  pages: { url: string; text: string; imageUrl?: string }[]
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
