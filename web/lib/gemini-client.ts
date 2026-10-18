import { GoogleAuth } from "google-auth-library";

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

/**
 * Gemini 3系モデルはリージョン別エンドポイント（us-central1等）では404になり、
 * locationを"global"にする必要がある（実測済み）。globalのホストはリージョン接頭辞を持たない。
 */
function vertexHost(location: string): string {
  return location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
}

// GEMINI_MODELだけ変えてGCP_LOCATIONの変更を忘れると、収集が黙って止まる（過去に11日間停止した事故）。
// Gemini 3系は設定のlocationに関わらずglobalで呼ぶ
function effectiveLocation(env: GeminiEnv): string {
  return env.model.startsWith("gemini-3") ? "global" : env.location;
}

/**
 * Vertex AIのgenerateContentを呼ぶ共通の低レベル関数。
 * 検索フェーズ(gemini-search.ts)・抽出フェーズ(gemini-extract.ts)の両方から使う。
 */
export async function callGenerateContent(
  env: GeminiEnv,
  body: Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const accessToken = await getAccessToken(env.serviceAccountKeyJson);
  const location = effectiveLocation(env);
  const url = `https://${vertexHost(location)}/v1/projects/${env.projectId}/locations/${location}/publishers/google/models/${env.model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Vertex AI呼び出しに失敗しました (status ${res.status})`);
  }

  return res.json();
}
