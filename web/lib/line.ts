import type { Event } from "./events";
import { categoryIconUrl } from "./line-icons";
import { dateInJst } from "./today";

const CONFIRMED_QUOTA = 3;
const EXPLORATORY_QUOTA = 2;
const LINE_BROADCAST_ENDPOINT = "https://api.line.me/v2/bot/message/broadcast";

const CONFIDENCE_LABEL: Record<Event["confidence"], string> = {
  confirmed: "確実",
  exploratory: "探索",
};

const CONFIDENCE_COLOR: Record<Event["confidence"], string> = {
  confirmed: "#4f46e5",
  exploratory: "#d97706",
};

// クエリ文字列付きURLでも判定できるよう、拡張子はパス末尾ではなく`?`/`#`の手前で見る
const IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|webp)(?:[?#].*)?$/i;

function isLikelyImageUrl(url: string | undefined): url is string {
  return typeof url === "string" && IMAGE_EXTENSION_PATTERN.test(url);
}

function isCreatedOn(event: Event, date: string): boolean {
  return dateInJst(event.created_at) === date;
}

/**
 * 当日収集した新着イベントのうち、confirmed優先3件・exploratory2件（計5件）を選ぶ。
 * 既に送信済み(alreadyNotifiedIds)のイベントは除外する（Task 8）。
 * 5件に満たない日はある分だけ返す。
 */
export function selectEventsToNotify(
  events: Event[],
  alreadyNotifiedIds: Set<string>,
  today: string
): Event[] {
  const candidates = events.filter(
    (event) => isCreatedOn(event, today) && !alreadyNotifiedIds.has(event.id)
  );

  const confirmed = candidates
    .filter((event) => event.confidence === "confirmed")
    .slice(0, CONFIRMED_QUOTA);
  const exploratory = candidates
    .filter((event) => event.confidence === "exploratory")
    .slice(0, EXPLORATORY_QUOTA);

  return [...confirmed, ...exploratory];
}

type FlexBubble = {
  type: "bubble";
  hero: { type: "image"; url: string; size: string; aspectRatio: string; aspectMode: string };
  body: { type: "box"; layout: "vertical"; spacing: string; contents: Record<string, unknown>[] };
  footer: { type: "box"; layout: "vertical"; contents: Record<string, unknown>[] };
};

/**
 * カード背景画像の決定（ユーザー要望: 常に同じ画像になること）。
 * 1. 収集済みページの実画像（og:image由来）。ただし画像ファイルらしいURLの場合のみ使う
 *    （HTML等の非画像URLをheroに渡すとFlex Message全体が送信エラーになるため）
 * 2. カテゴリの汎用アイコン（lib/line-icons.ts、カテゴリ→ファイルが固定なので常に同じ画像になる）
 */
function heroImageUrl(event: Event, siteUrl: string): string {
  if (isLikelyImageUrl(event.image_url)) {
    return event.image_url;
  }

  return categoryIconUrl(event.category, siteUrl);
}

export function buildBubble(event: Event, siteUrl: string): FlexBubble {
  const bodyContents: Record<string, unknown>[] = [
    {
      type: "text",
      text: CONFIDENCE_LABEL[event.confidence] ?? event.confidence,
      size: "xs",
      weight: "bold",
      color: CONFIDENCE_COLOR[event.confidence] ?? "#64748b",
    },
    {
      type: "text",
      text: event.title,
      weight: "bold",
      size: "md",
      wrap: true,
      maxLines: 2,
    },
  ];

  if (event.summary) {
    bodyContents.push({
      type: "text",
      text: event.summary,
      size: "sm",
      color: "#666666",
      wrap: true,
      maxLines: 3,
    });
  }

  return {
    type: "bubble",
    hero: {
      type: "image",
      url: heroImageUrl(event, siteUrl),
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: bodyContents,
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#4f46e5",
          action: { type: "uri", label: "詳細を見る", uri: `${siteUrl}/events/${event.id}` },
        },
      ],
    },
  };
}

export function buildCarouselMessage(events: Event[], siteUrl: string) {
  return {
    type: "flex" as const,
    altText: `本日の新着イベント${events.length}件`,
    contents: {
      type: "carousel" as const,
      contents: events.map((event) => buildBubble(event, siteUrl)),
    },
  };
}

/**
 * LINE Messaging APIのBroadcast（全フォロワー配信）で新着イベントを通知する。
 * 個人利用前提のため、Push先ユーザーIDの管理は行わない。
 * 5件をまとめて1件のFlex Messageカルーセルとして送信する（ユーザー要望）。
 */
export async function sendBroadcast(
  events: Event[],
  siteUrl: string,
  channelAccessToken: string
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const message = buildCarouselMessage(events, siteUrl);

  const res = await fetch(LINE_BROADCAST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({ messages: [message] }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body);
  }
}
