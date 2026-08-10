import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMessageText, selectEventsToNotify, sendBroadcast } from "./line";
import type { Event } from "./events";

const TODAY = "2026-08-10";

function event(
  id: string,
  confidence: Event["confidence"],
  createdAt: string = `${TODAY}T00:00:00Z`
): Event {
  return {
    id,
    title: `イベント${id}`,
    source: "example.com",
    matched_keyword: "テスト",
    matched_via: "direct",
    confidence,
    created_at: createdAt,
  };
}

describe("selectEventsToNotify", () => {
  it("selects up to 3 confirmed and 2 exploratory events from today", () => {
    const events = [
      event("1", "confirmed"),
      event("2", "confirmed"),
      event("3", "confirmed"),
      event("4", "confirmed"), // 4件目のconfirmedは選ばれない
      event("5", "exploratory"),
      event("6", "exploratory"),
      event("7", "exploratory"), // 3件目のexploratoryは選ばれない
    ];

    const result = selectEventsToNotify(events, new Set(), TODAY);

    expect(result.map((e) => e.id)).toEqual(["1", "2", "3", "5", "6"]);
  });

  it("returns fewer than 5 when not enough candidates exist", () => {
    const events = [event("1", "confirmed"), event("2", "exploratory")];

    const result = selectEventsToNotify(events, new Set(), TODAY);

    expect(result.map((e) => e.id)).toEqual(["1", "2"]);
  });

  it("excludes events created on a different day", () => {
    const events = [event("1", "confirmed", "2026-08-09T23:00:00Z")];

    expect(selectEventsToNotify(events, new Set(), TODAY)).toEqual([]);
  });

  it("excludes events that were already notified", () => {
    const events = [event("1", "confirmed"), event("2", "confirmed")];

    const result = selectEventsToNotify(events, new Set(["1"]), TODAY);

    expect(result.map((e) => e.id)).toEqual(["2"]);
  });
});

describe("buildMessageText", () => {
  it("includes the title and a link to the detail page", () => {
    const text = buildMessageText(event("1", "confirmed"), "https://example.com");

    expect(text).toBe("イベント1\nhttps://example.com/events/1");
  });
});

describe("sendBroadcast", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does nothing when there are no events", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await sendBroadcast([], "https://example.com", "token");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a broadcast message with one text message per event", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await sendBroadcast([event("1", "confirmed")], "https://example.com", "token-123");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.line.me/v2/bot/message/broadcast",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer token-123",
        }),
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { type: "text", text: "イベント1\nhttps://example.com/events/1" },
    ]);
  });

  it("throws when the LINE API responds with an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve("invalid request"),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendBroadcast([event("1", "confirmed")], "https://example.com", "token")).rejects.toThrow(
      "invalid request"
    );
  });
});
