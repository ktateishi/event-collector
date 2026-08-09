import type { CandidateEvent } from "./ingest";

/**
 * 「確実に検索すべき」定番クエリのテンプレート。モデルの自由な判断だけに任せると、
 * 「キーワード + イベント」のような最も当たり前で検索結果の上位に出るクエリすら
 * 検索されないことがある（実運用で判明した抜け漏れ）。そのためコード側で
 * クエリを明示的に列挙し、モデルにはそれを「実行させる」だけにする。
 */
const CORE_QUERY_SUFFIXES = ["イベント", "展覧会", "コラボ", "グッズ", "チケット"];

/**
 * 確実に実行すべき定番クエリ用プロンプト。テキスト出力自体は使わず、
 * groundingChunksから実URLを回収するために使う（gemini-search.ts参照）。
 */
export function buildCoreSearchPrompt(keyword: string): string {
  const queries = CORE_QUERY_SUFFIXES.map((suffix) => `${keyword} ${suffix}`);

  return `以下の検索クエリを**すべて**Google検索で実行してください（省略しないこと）。
それぞれの検索結果から、日付のあるイベント情報（放送・イベント・グッズ発売・
コラボ・チケット先行受付・締切など）を調べてください。

${queries.map((q) => `- 「${q}」`).join("\n")}

見つけた情報を日本語で簡潔にまとめてください。`;
}

/**
 * 関連語（声優・スタジオ・コラボ相手等）を使った拡張検索用プロンプト。
 * こちらはモデル自身の知識・判断による拡張が必要なため、定番クエリとは別に
 * 自由記述の指示にしている。テキスト出力自体は使わず、groundingChunksから
 * 実URLを回収するために使う（gemini-search.ts参照）。
 */
export function buildExpansionSearchPrompt(keyword: string): string {
  return `「${keyword}」というアニメ・キャラクター等に関連する、日付のある最新イベント情報
（放送・イベント・グッズ発売・コラボ・チケット先行受付・締切など）をGoogle検索で
幅広く調べてください。

キーワードそのものだけでなく、関連語（声優・出演者名、制作会社・スタジオ、
コラボ相手・ブランド、シリーズ内の関連作品名、既知の関連イベント名など）でも
検索し、「${keyword}」に関する新着イベントを取りこぼさないようにしてください。
無関係な連想については検索しないでください。

見つけた情報を日本語で簡潔にまとめてください。`;
}

/**
 * 抽出フェーズ用プロンプト。検索ツールは使わず、実際に取得したページ本文を
 * 渡して構造化抽出させる（この段階ではSearch Toolを使わないためresponseSchemaを
 * 併用できる）。
 */
export function buildExtractionPrompt(
  keyword: string,
  pages: { url: string; text: string }[]
): string {
  const pagesBlock = pages
    .map((p, i) => `### ページ番号 ${i + 1}\nURL: ${p.url}\n本文:\n${p.text}`)
    .join("\n\n");

  return `あなたはイベント情報抽出アシスタントです。登録キーワード「${keyword}」に関連して
収集した以下のWebページ本文から、日付のあるイベント情報を抽出してください。

## 「日付のあるイベント情報」の定義

開催日・受付開始日時・締切日時のいずれか1つ以上が本文中に明確に書かれているもの。
日付が一切分からない情報（感想記事、日付不明の噂等）は対象外とする。
開催期間が既に終了間近、または既に大部分が経過しているイベントは除外する。

## matched_via / matched_term の判定

- ページの内容が登録キーワード「${keyword}」そのものについてなら matched_via: "direct"、
  matched_term: "${keyword}"
- ページの内容が「${keyword}」の関連語（声優・スタジオ・コラボ相手等）についてで、
  「${keyword}」自体ではないなら matched_via: "expanded"、matched_term: 実際の関連語

## 制約（重要）

- **URLを自分で書かないこと。** 代わりに、そのイベントが書かれていた
  「ページ番号」（1, 2, 3...の整数）を page_id に入れること。
  存在しないページ番号や、他のページの内容を混同したページ番号を書かないこと
- 1ページから複数のイベントが読み取れる場合は複数件出力してよい
- イベントが読み取れないページは無視してよい（無理に出力しない）

## 収集したページ

${pagesBlock}

## 出力形式

{
  "events": [
    {
      "title": "string",
      "source": "string（取得元のドメインまたはサイト名）",
      "page_id": 1,
      "matched_via": "direct または expanded",
      "matched_term": "string",
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
  page_id?: unknown;
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

/**
 * page_id（1始まりのページ番号）を実際のページURLに変換して候補イベントを作る。
 * page_idが範囲外・数値でない場合はGeminiがURLを混同/捏造した可能性が高いため
 * そのイベントごと破棄する（404・誤リンクを未然に防ぐための安全策）。
 */
export function parseGeminiCandidates(
  rawText: string,
  pages: { url: string }[]
): CandidateEvent[] {
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
    const pageIndex = typeof raw.page_id === "number" ? raw.page_id - 1 : -1;
    const page = pages[pageIndex];

    if (
      typeof raw.title !== "string" ||
      typeof raw.source !== "string" ||
      typeof raw.matched_term !== "string" ||
      !isValidMatchedVia(raw.matched_via) ||
      !hasAnyDate(raw) ||
      !page
    ) {
      continue;
    }

    results.push({
      title: raw.title,
      source: raw.source,
      url: page.url,
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
