import type { CandidateEvent } from "./ingest";

export function buildEventPrompt(keyword: string): string {
  return `あなたはイベント収集アシスタントです。以下のキーワードについて、Google検索を使って
日付のある最新イベント情報を探してください。

登録キーワード: 「${keyword}」

## 手順

1. 登録キーワードそのもの（direct）に加えて、関連語（expanded）を3〜6件程度考える。
   観点の例: 声優・出演者名、制作会社・スタジオ、コラボ相手・ブランド、
   シリーズ内の関連作品名、既知の関連イベント名。
   「そのキーワードに関する新着イベントを取りこぼさないために検索する価値があるか」で判断し、
   無関係な連想は含めない。
2. 登録キーワードと各関連語について、Google検索で公式サイト・公式ブログ・個人ブログ等から、
   開催日・受付開始日時・締切日時のいずれか1つ以上が明確に分かるイベント情報を探す。
   日付が一切分からない情報（感想記事、日付不明の噂等）は対象外とする。
   開催期間が既に終了間近、または既に大部分が経過しているイベントは除外する。
3. 見つけた各イベントについて、それが登録キーワードそのものの検索で見つかったのか
   （matched_via: "direct"）、関連語の検索でのみ見つかったのか（matched_via: "expanded"）を判定し、
   実際に一致した語（登録キーワード自身、または関連語）を matched_term に記録する。

## 出力形式

以下のJSONスキーマに厳密に従って出力してください（余計なテキストを含めないこと）:

{
  "events": [
    {
      "title": "string",
      "source": "string（取得元のドメインまたはサイト名）",
      "url": "string（元ページのURL）",
      "matched_via": "direct または expanded",
      "matched_term": "string（実際に一致した語）",
      "event_date": "YYYY-MM-DD または null",
      "registration_opens_at": "ISO8601日時 または null",
      "deadline_at": "ISO8601日時 または null"
    }
  ]
}

該当するイベントが1件もなければ、"events": [] を返してください。`;
}

type RawGeminiEvent = {
  title?: unknown;
  source?: unknown;
  url?: unknown;
  matched_via?: unknown;
  matched_term?: unknown;
  event_date?: unknown;
  registration_opens_at?: unknown;
  deadline_at?: unknown;
};

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

function hasAnyDate(event: RawGeminiEvent): boolean {
  return Boolean(event.event_date || event.registration_opens_at || event.deadline_at);
}

function isValidMatchedVia(value: unknown): value is "direct" | "expanded" {
  return value === "direct" || value === "expanded";
}

export function parseGeminiCandidates(rawText: string): CandidateEvent[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripCodeFence(rawText));
  } catch {
    return [];
  }

  const events = (parsed as { events?: unknown })?.events;
  if (!Array.isArray(events)) {
    return [];
  }

  const results: CandidateEvent[] = [];

  for (const raw of events as RawGeminiEvent[]) {
    if (
      typeof raw.title !== "string" ||
      typeof raw.source !== "string" ||
      typeof raw.matched_term !== "string" ||
      !isValidMatchedVia(raw.matched_via) ||
      !hasAnyDate(raw)
    ) {
      continue;
    }

    results.push({
      title: raw.title,
      source: raw.source,
      url: typeof raw.url === "string" ? raw.url : undefined,
      matched_keyword: raw.matched_term,
      matched_via: raw.matched_via,
      confidence: raw.matched_via === "direct" ? "confirmed" : "exploratory",
      event_date: typeof raw.event_date === "string" ? raw.event_date : undefined,
      registration_opens_at:
        typeof raw.registration_opens_at === "string" ? raw.registration_opens_at : undefined,
      deadline_at: typeof raw.deadline_at === "string" ? raw.deadline_at : undefined,
    });
  }

  return results;
}
