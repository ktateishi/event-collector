import { describe, expect, it } from "vitest";
import {
  buildCoreSearchPrompt,
  buildExpansionSearchPrompt,
  buildExtractionPrompt,
  parseGeminiCandidates,
} from "./gemini-prompt";

describe("buildCoreSearchPrompt", () => {
  it("includes obvious query templates like 'keyword イベント'", () => {
    const prompt = buildCoreSearchPrompt("バイオハザード");

    expect(prompt).toContain("バイオハザード イベント");
    expect(prompt).toContain("バイオハザード 展覧会");
    expect(prompt).toContain("バイオハザード グッズ");
  });
});

describe("buildExpansionSearchPrompt", () => {
  it("includes the keyword and asks for date-bearing events", () => {
    const prompt = buildExpansionSearchPrompt("鬼滅の刃");

    expect(prompt).toContain("鬼滅の刃");
    expect(prompt).toContain("日付");
  });
});

describe("buildExtractionPrompt", () => {
  it("embeds each page's URL and text with a page number, and the keyword", () => {
    const prompt = buildExtractionPrompt("鬼滅の刃", [
      { url: "https://a.example/1", text: "本文A" },
      { url: "https://b.example/2", text: "本文B" },
    ]);

    expect(prompt).toContain("鬼滅の刃");
    expect(prompt).toContain("ページ番号 1");
    expect(prompt).toContain("https://a.example/1");
    expect(prompt).toContain("本文A");
    expect(prompt).toContain("ページ番号 2");
    expect(prompt).toContain("https://b.example/2");
    expect(prompt).toContain("本文B");
    expect(prompt).toContain("page_id");
  });
});

describe("parseGeminiCandidates", () => {
  const pages = [{ url: "https://a.example/1" }, { url: "https://b.example/2" }];

  const validJson = JSON.stringify({
    events: [
      {
        title: "鬼滅の刃 ライブイベント",
        source: "kimetsu.com",
        page_id: 1,
        matched_via: "direct",
        matched_term: "鬼滅の刃",
        event_date: "2026-09-15",
        registration_opens_at: null,
        deadline_at: null,
      },
      {
        title: "MAPPA EXPO",
        source: "collabo-cafe.com",
        page_id: 2,
        matched_via: "expanded",
        matched_term: "MAPPA",
        event_date: "2026-09-16",
        registration_opens_at: null,
        deadline_at: "2026-12-07T14:59:59+09:00",
      },
    ],
  });

  it("resolves page_id to the real URL from the given pages, and maps confidence", () => {
    const result = parseGeminiCandidates(validJson, pages);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      title: "鬼滅の刃 ライブイベント",
      url: "https://a.example/1",
      matched_keyword: "鬼滅の刃",
      matched_via: "direct",
      confidence: "confirmed",
    });
    expect(result[1]).toMatchObject({
      title: "MAPPA EXPO",
      url: "https://b.example/2",
      matched_keyword: "MAPPA",
      matched_via: "expanded",
      confidence: "exploratory",
    });
  });

  it("drops events whose page_id is out of range (prevents URL confusion/hallucination)", () => {
    const json = JSON.stringify({
      events: [
        {
          title: "存在しないページのイベント",
          source: "example.com",
          page_id: 99,
          matched_via: "direct",
          matched_term: "鬼滅の刃",
          event_date: "2026-09-15",
        },
      ],
    });

    expect(parseGeminiCandidates(json, pages)).toHaveLength(0);
  });

  it("drops events with no date information at all", () => {
    const json = JSON.stringify({
      events: [
        {
          title: "日付不明のイベント",
          source: "example.com",
          page_id: 1,
          matched_via: "direct",
          matched_term: "鬼滅の刃",
          event_date: null,
          registration_opens_at: null,
          deadline_at: null,
        },
      ],
    });

    expect(parseGeminiCandidates(json, pages)).toHaveLength(0);
  });

  it("tolerates JSON wrapped in markdown code fences", () => {
    const fenced = "```json\n" + validJson + "\n```";

    expect(parseGeminiCandidates(fenced, pages)).toHaveLength(2);
  });

  it("returns an empty array for unparseable input", () => {
    expect(parseGeminiCandidates("not json at all", pages)).toEqual([]);
  });

  it("returns an empty array when events is missing", () => {
    expect(parseGeminiCandidates(JSON.stringify({}), pages)).toEqual([]);
  });
});
