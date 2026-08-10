import type { Event } from "./events";

const CONFIRMED_QUOTA = 3;
const EXPLORATORY_QUOTA = 2;
const LINE_BROADCAST_ENDPOINT = "https://api.line.me/v2/bot/message/broadcast";

function isCreatedOn(event: Event, date: string): boolean {
  return event.created_at.slice(0, 10) === date;
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

export function buildMessageText(event: Event, siteUrl: string): string {
  return `${event.title}\n${siteUrl}/events/${event.id}`;
}

/**
 * LINE Messaging APIのBroadcast（全フォロワー配信）で新着イベントを通知する。
 * 個人利用前提のため、Push先ユーザーIDの管理は行わない。
 */
export async function sendBroadcast(
  events: Event[],
  siteUrl: string,
  channelAccessToken: string
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const messages = events.map((event) => ({
    type: "text",
    text: buildMessageText(event, siteUrl),
  }));

  const res = await fetch(LINE_BROADCAST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body);
  }
}
