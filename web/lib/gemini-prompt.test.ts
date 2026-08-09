import { describe, expect, it } from "vitest";
import { buildEventPrompt, parseGeminiCandidates } from "./gemini-prompt";

describe("buildEventPrompt", () => {
  it("includes the keyword and asks for date-bearing events", () => {
    const prompt = buildEventPrompt("鬼滅の刃");

    expect(prompt).toContain("鬼滅の刃");
    expect(prompt).toContain("日付");
  });
});

describe("parseGeminiCandidates", () => {
  const validJson = JSON.stringify({
    events: [
      {
        title: "鬼滅の刃 ライブイベント",
        source: "kimetsu.com/news",
        url: "https://kimetsu.com/news/1",
        matched_via: "direct",
        matched_term: "鬼滅の刃",
        event_date: "2026-09-15",
        registration_opens_at: null,
        deadline_at: null,
      },
      {
        title: "MAPPA EXPO",
        source: "collabo-cafe.com",
        url: "https://collabo-cafe.com/mappa",
        matched_via: "expanded",
        matched_term: "MAPPA",
        event_date: "2026-09-16",
        registration_opens_at: null,
        deadline_at: "2026-12-07T14:59:59+09:00",
      },
    ],
  });

  it("maps direct matches to confirmed and expanded matches to exploratory", () => {
    const result = parseGeminiCandidates(validJson);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      title: "鬼滅の刃 ライブイベント",
      matched_keyword: "鬼滅の刃",
      matched_via: "direct",
      confidence: "confirmed",
    });
    expect(result[1]).toMatchObject({
      title: "MAPPA EXPO",
      matched_keyword: "MAPPA",
      matched_via: "expanded",
      confidence: "exploratory",
    });
  });

  it("drops events with no date information at all", () => {
    const json = JSON.stringify({
      events: [
        {
          title: "日付不明のイベント",
          source: "example.com",
          matched_via: "direct",
          matched_term: "鬼滅の刃",
          event_date: null,
          registration_opens_at: null,
          deadline_at: null,
        },
      ],
    });

    expect(parseGeminiCandidates(json)).toHaveLength(0);
  });

  it("tolerates JSON wrapped in markdown code fences", () => {
    const fenced = "```json\n" + validJson + "\n```";

    expect(parseGeminiCandidates(fenced)).toHaveLength(2);
  });

  it("returns an empty array for unparseable input", () => {
    expect(parseGeminiCandidates("not json at all")).toEqual([]);
  });

  it("returns an empty array when events is missing", () => {
    expect(parseGeminiCandidates(JSON.stringify({}))).toEqual([]);
  });
});
