import { GoogleAuth } from "google-auth-library";
import { buildEventPrompt, parseGeminiCandidates } from "./gemini-prompt";
import type { CandidateEvent } from "./ingest";

export type GeminiEnv = {
  projectId: string;
  location: string;
  model: string;
  serviceAccountKeyJson: string;
};

async function getAccessToken(serviceAccountKeyJson: string): Promise<string> {
  const credentials = JSON.parse(serviceAccountKeyJson);
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();

  if (!token) {
    throw new Error("GCPアクセストークンの取得に失敗しました");
  }

  return token;
}

export async function collectEventsForKeyword(
  env: GeminiEnv,
  keyword: string
): Promise<CandidateEvent[]> {
  const accessToken = await getAccessToken(env.serviceAccountKeyJson);

  const url = `https://${env.location}-aiplatform.googleapis.com/v1/projects/${env.projectId}/locations/${env.location}/publishers/google/models/${env.model}:generateContent`;

  // 注意: Vertex AI(gemini-2.5-flash)ではSearchツールと構造化出力(responseSchema/
  // responseMimeType)を同一リクエストで併用できない（400 "controlled generation is
  // not supported with Search tool"）。そのためJSON形式の指定はプロンプト側の指示のみに
  // 頼り、生成テキストを parseGeminiCandidates で緩く解析する。
  const requestBody = {
    contents: [{ role: "user", parts: [{ text: buildEventPrompt(keyword) }] }],
    tools: [{ googleSearch: {} }],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    throw new Error(`Vertex AI呼び出しに失敗しました (status ${res.status})`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof text !== "string") {
    return [];
  }

  return parseGeminiCandidates(text);
}
