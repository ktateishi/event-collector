import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBubble, buildCarouselMessage, selectEventsToNotify, sendBroadcast } from "./line";
import type { Event } from "./events";

const TODAY = "2026-08-10";

function event(
  id: string,
  confidence: Event["confidence"],
  overrides: Partial<Event> = {}
): Event {
  return {
    id,
    title: `イベント${id}`,
    source: "example.com",
    matched_keyword: "テスト",
    matched_via: "direct",
    confidence,
    created_at: `${TODAY}T00:00:00Z`,
    ...overrides,
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
    const events = [event("1", "confirmed", { created_at: "2026-08-09T23:00:00Z" })];

    expect(selectEventsToNotify(events, new Set(), TODAY)).toEqual([]);
  });

  it("excludes events that were already notified", () => {
    const events = [event("1", "confirmed"), event("2", "confirmed")];

    const result = selectEventsToNotify(events, new Set(["1"]), TODAY);

    expect(result.map((e) => e.id)).toEqual(["2"]);
  });
});

describe("buildBubble", () => {
  it("uses the event's own image when it looks like a real image URL", () => {
    const bubble = buildBubble(
      event("1", "confirmed", { image_url: "https://example.com/photo.jpg" }),
      "https://site.example"
    );

    expect(bubble.hero.url).toBe("https://example.com/photo.jpg");
  });

  it("falls back to the category icon when there is no event image", () => {
    const bubble = buildBubble(event("1", "confirmed", { category: "concert" }), "https://site.example");

    expect(bubble.hero.url).toBe("https://site.example/icons/concert.png");
  });

  it("falls back to the 'other' icon when category is also unknown", () => {
    const bubble = buildBubble(event("1", "exploratory"), "https://site.example");

    expect(bubble.hero.url).toBe("https://site.example/icons/other.png");
  });

  it("ignores an image_url that does not look like an actual image file", () => {
    const bubble = buildBubble(
      event("1", "confirmed", { image_url: "https://example.com/page.html", category: "movie" }),
      "https://site.example"
    );

    expect(bubble.hero.url).toBe("https://site.example/icons/movie.png");
  });

  it("always resolves to the same image for the same event (deterministic)", () => {
    const e = event("1", "confirmed", { category: "game" });

    const first = buildBubble(e, "https://site.example");
    const second = buildBubble(e, "https://site.example");

    expect(first.hero.url).toBe(second.hero.url);
  });

  it("includes the title, summary, and a detail-page button", () => {
    const bubble = buildBubble(
      event("1", "confirmed", { summary: "面白いイベントです" }),
      "https://site.example"
    );

    const bodyTexts = bubble.body.contents.filter((c) => c.type === "text").map((c) => c.text);
    expect(bodyTexts).toContain("イベント1");
    expect(bodyTexts).toContain("面白いイベントです");
    expect(bubble.footer.contents[0]).toMatchObject({
      type: "button",
      action: { type: "uri", uri: "https://site.example/events/1" },
    });
  });

  it("omits the summary line when there is no summary", () => {
    const bubble = buildBubble(event("1", "confirmed"), "https://site.example");

    const bodyTexts = bubble.body.contents.filter((c) => c.type === "text").map((c) => c.text);
    expect(bodyTexts).toEqual(["確実", "イベント1"]);
  });
});

describe("buildCarouselMessage", () => {
  it("wraps up to 5 events into a single flex carousel message", () => {
    const events = [event("1", "confirmed"), event("2", "exploratory")];

    const message = buildCarouselMessage(events, "https://site.example");

    expect(message.type).toBe("flex");
    expect(message.contents.type).toBe("carousel");
    expect(message.contents.contents).toHaveLength(2);
    expect(message.altText).toContain("2");
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

  it("posts a single flex carousel message for all events", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    await sendBroadcast(
      [event("1", "confirmed"), event("2", "exploratory")],
      "https://example.com",
      "token-123"
    );

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
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].type).toBe("flex");
    expect(body.messages[0].contents.contents).toHaveLength(2);
  });

  it("throws when the LINE API responds with an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve("invalid request"),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendBroadcast([event("1", "confirmed")], "https://example.com", "token")
    ).rejects.toThrow("invalid request");
  });
});
