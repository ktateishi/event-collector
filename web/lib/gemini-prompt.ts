import type { CandidateEvent } from "./ingest";
import { earliestDate, type Occurrence } from "./occurrences";

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

## 同一イベントの統合（重要）

**同じイベントの複数会場・複数地域は、1件のイベントにまとめてください。**
各会場・各地域の情報は occurrences 配列として列挙します。

まとめる例:
- 巡回展「30周年記念展 ALL OF EVANGELION」が東京・名古屋・大阪・岩手で開催される
  → **1件**にまとめ、occurrences に4件（label: "東京会場" 等）を入れる
- 映画『バイオハザード』が全米公開と日本公開で日付が違う
  → **1件**にまとめ、occurrences に2件（label: "全米公開" / "日本公開"）を入れる

まとめない例（別イベントとして出力する）:
- 「呪術廻戦展」と「呪術廻戦カフェ」は別の催しなので、別イベントとして出力する
- 同じ会場でもシリーズが異なる別公演は、別イベントとして出力する

title には会場名・地域名を含めない共通の名称を入れてください
（「ALL OF EVANGELION 名古屋会場」ではなく「30周年記念展 ALL OF EVANGELION」）。
会場が1つだけの場合も、occurrences には必ず1件入れてください。

## 終了日について（重要）

**event_date は開催の開始日です。終了日ではありません。** 展覧会・キャンペーン等、
本文に終了日・会期末日が明記されている場合は、必ず event_end_date に入れてください
（このツールは終了したイベントを自動的に片付けるために終了日を使うため、
分かるのに省略すると「まだ開催中なのに終了扱いされる」事故につながります）。
終了日が本文に見当たらない場合は event_end_date を null にしてください
（推測で埋めないこと）。単発の1日だけのイベントは event_end_date を
event_date と同じ日にしてください。

## 制約（重要）

- **URLを自分で書かないこと。** 代わりに、そのイベントが書かれていた
  「ページ番号」（1, 2, 3...の整数）を page_id に入れること。
  存在しないページ番号や、他のページの内容を混同したページ番号を書かないこと
- 1ページから複数の（別々の）イベントが読み取れる場合は複数件出力してよい
- イベントが読み取れないページは無視してよい（無理に出力しない）

## 収集したページ

${pagesBlock}

## 出力形式

{
  "events": [
    {
      "title": "string（会場名・地域名を含めない共通の名称）",
      "source": "string（取得元のドメインまたはサイト名）",
      "page_id": 1,
      "matched_via": "direct または expanded",
      "matched_term": "string",
      "occurrences": [
        {
          "label": "string（会場名・地域名。単一開催なら「開催」等でよい）",
          "event_date": "YYYY-MM-DD または null（開始日）",
          "event_end_date": "YYYY-MM-DD または null（終了日、本文に明記されている場合のみ）",
          "registration_opens_at": "ISO8601日時 または null",
          "deadline_at": "ISO8601日時 または null"
        }
      ]
    }
  ]
}

該当するイベントが1件もなければ、"events": [] を返してください。`;
}

type RawOccurrence = {
  label?: unknown;
  event_date?: unknown;
  event_end_date?: unknown;
  registration_opens_at?: unknown;
  deadline_at?: unknown;
};

type RawGeminiEvent = {
  title?: unknown;
  source?: unknown;
  page_id?: unknown;
  matched_via?: unknown;
  matched_term?: unknown;
  occurrences?: unknown;
};

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

function isValidMatchedVia(value: unknown): value is "direct" | "expanded" {
  return value === "direct" || value === "expanded";
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** 日付情報を1つも持たないoccurrenceは「日付のあるイベント」の定義を満たさないため除外する */
function toOccurrences(raw: unknown): Occurrence[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const results: Occurrence[] = [];

  for (const item of raw as RawOccurrence[]) {
    const event_date = asOptionalString(item?.event_date);
    const event_end_date = asOptionalString(item?.event_end_date);
    const registration_opens_at = asOptionalString(item?.registration_opens_at);
    const deadline_at = asOptionalString(item?.deadline_at);

    if (!event_date && !registration_opens_at && !deadline_at) {
      continue;
    }

    results.push({
      label: asOptionalString(item?.label) ?? "開催",
      event_date,
      event_end_date,
      registration_opens_at,
      deadline_at,
    });
  }

  return results;
}

/**
 * page_id（1始まりのページ番号）を実際のページURLに変換して候補イベントを作る。
 * page_idが範囲外・数値でない場合はGeminiがURLを混同/捏造した可能性が高いため
 * そのイベントごと破棄する（404・誤リンクを未然に防ぐための安全策）。
 *
 * 各イベントは occurrences（複数会場・複数地域）を持つ。日付情報を持つoccurrenceが
 * 1件もないイベントは「日付のあるイベント」ではないため破棄する。
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
    const occurrences = toOccurrences(raw.occurrences);

    if (
      typeof raw.title !== "string" ||
      typeof raw.source !== "string" ||
      typeof raw.matched_term !== "string" ||
      !isValidMatchedVia(raw.matched_via) ||
      occurrences.length === 0 ||
      !page
    ) {
      continue;
    }

    const first = occurrences[0];

    results.push({
      title: raw.title,
      source: raw.source,
      url: page.url,
      matched_keyword: raw.matched_term,
      matched_via: raw.matched_via,
      confidence: raw.matched_via === "direct" ? "confirmed" : "exploratory",
      occurrences,
      // トップレベルの日付は代表値（最も早い開催日）。ingestEvents側で
      // earliestDate()により再計算されるが、単一occurrenceの場合の素直な値として入れておく
      event_date: earliestDate(occurrences) ?? first.event_date,
      registration_opens_at: first.registration_opens_at,
      deadline_at: first.deadline_at,
    });
  }

  return results;
}
