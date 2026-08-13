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

  it("instructs the model to merge multi-venue events into a single event", () => {
    const prompt = buildExtractionPrompt("エヴァンゲリオン", [
      { url: "https://a.example/1", text: "本文A" },
    ]);

    expect(prompt).toContain("occurrences");
    expect(prompt).toContain("1件");
  });

  it("judges matched_via by whether the event content itself names the keyword, not by which search found it (Task 16)", () => {
    const prompt = buildExtractionPrompt("エヴァンゲリオン", [
      { url: "https://a.example/1", text: "本文A" },
    ]);

    // 実運用データで発見した誤分類パターン1: 略称・表記ゆれ（エヴァ/EVANGELION等）を
    // 別物として expanded 扱いしてしまう
    expect(prompt).toContain("略称");
    expect(prompt).toContain("表記ゆれ");
    // 実運用データで発見した誤分類パターン2: キャラクター名等の関連語検索で見つけても、
    // 商品・イベント自体のタイトルにキーワードが明記されていればdirectにすべき
    expect(prompt).toContain("綾波レイ");
    expect(prompt).toContain("どの検索で見つかったか");
  });

  it("asks for a fixed-set category and a one-line summary (LINE Flex Message用)", () => {
    const prompt = buildExtractionPrompt("エヴァンゲリオン", [
      { url: "https://a.example/1", text: "本文A" },
    ]);

    expect(prompt).toContain("category");
    expect(prompt).toContain("movie");
    expect(prompt).toContain("exhibition");
    expect(prompt).toContain("game");
    expect(prompt).toContain("concert");
    expect(prompt).toContain("collab");
    expect(prompt).toContain("other");
    expect(prompt).toContain("summary");
  });
});

describe("parseGeminiCandidates", () => {
  const pages = [
    { url: "https://a.example/1", imageUrl: "https://a.example/og.jpg" },
    { url: "https://b.example/2" },
  ];

  const validJson = JSON.stringify({
    events: [
      {
        title: "鬼滅の刃 ライブイベント",
        source: "kimetsu.com",
        page_id: 1,
        matched_via: "direct",
        matched_term: "鬼滅の刃",
        category: "concert",
        summary: "鬼滅の刃の大規模ライブイベント",
        occurrences: [{ label: "東京会場", event_date: "2026-09-15" }],
      },
      {
        title: "MAPPA EXPO",
        source: "collabo-cafe.com",
        page_id: 2,
        matched_via: "expanded",
        matched_term: "MAPPA",
        category: "collab",
        summary: "MAPPA作品のコラボカフェ",
        occurrences: [
          { label: "大阪会場", event_date: "2026-10-01" },
          { label: "東京会場", event_date: "2026-09-16", deadline_at: "2026-12-07T14:59:59+09:00" },
        ],
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

  it("carries category, summary, and the source page's image URL", () => {
    const result = parseGeminiCandidates(validJson, pages);

    expect(result[0]).toMatchObject({
      category: "concert",
      summary: "鬼滅の刃の大規模ライブイベント",
      image_url: "https://a.example/og.jpg",
    });
    // page 2にはimageUrlがない
    expect(result[1].image_url).toBeUndefined();
  });

  it("drops an unrecognized category value instead of failing the whole event", () => {
    const json = JSON.stringify({
      events: [
        {
          title: "鬼滅の刃 ライブイベント",
          source: "kimetsu.com",
          page_id: 1,
          matched_via: "direct",
          matched_term: "鬼滅の刃",
          category: "not-a-real-category",
          occurrences: [{ label: "東京会場", event_date: "2026-09-15" }],
        },
      ],
    });

    const result = parseGeminiCandidates(json, pages);

    expect(result).toHaveLength(1);
    expect(result[0].category).toBeUndefined();
  });

  it("keeps all occurrences and uses the earliest date as the event's representative date", () => {
    const result = parseGeminiCandidates(validJson, pages);

    expect(result[1].occurrences).toHaveLength(2);
    expect(result[1].event_date).toBe("2026-09-16");
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
          occurrences: [{ label: "東京会場", event_date: "2026-09-15" }],
        },
      ],
    });

    expect(parseGeminiCandidates(json, pages)).toHaveLength(0);
  });

  it("drops events whose occurrences all lack date information", () => {
    const json = JSON.stringify({
      events: [
        {
          title: "日付不明のイベント",
          source: "example.com",
          page_id: 1,
          matched_via: "direct",
          matched_term: "鬼滅の刃",
          occurrences: [
            { label: "東京会場", event_date: null, registration_opens_at: null, deadline_at: null },
          ],
        },
      ],
    });

    expect(parseGeminiCandidates(json, pages)).toHaveLength(0);
  });

  it("drops events with no occurrences at all", () => {
    const json = JSON.stringify({
      events: [
        {
          title: "occurrencesなし",
          source: "example.com",
          page_id: 1,
          matched_via: "direct",
          matched_term: "鬼滅の刃",
          occurrences: [],
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
