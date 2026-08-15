import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCallGenerateContent } = vi.hoisted(() => ({
  mockCallGenerateContent: vi.fn(),
}));

vi.mock("./gemini-client", () => ({ callGenerateContent: mockCallGenerateContent }));

const { extractEventsFromPages } = await import("./gemini-extract");

const env = {
  projectId: "p",
  location: "us-central1",
  model: "gemini-2.5-flash",
  serviceAccountKeyJson: "{}",
};

describe("extractEventsFromPages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes excludedTitles through to the extraction prompt", async () => {
    mockCallGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ events: [] }) }] } }],
    });

    await extractEventsFromPages(
      env,
      "鬼滅の刃",
      [{ url: "https://kimetsu.com/1", text: "本文" }],
      ["フィギュア発売"]
    );

    const [, body] = mockCallGenerateContent.mock.calls[0];
    expect(body.contents[0].parts[0].text).toContain("フィギュア発売");
  });

  it("returns an empty array without calling Vertex AI when there are no pages", async () => {
    const result = await extractEventsFromPages(env, "鬼滅の刃", []);

    expect(result).toEqual([]);
    expect(mockCallGenerateContent).not.toHaveBeenCalled();
  });

  it("calls Vertex AI without the search tool but with a response schema, and parses the result", async () => {
    const responseJson = JSON.stringify({
      events: [
        {
          title: "鬼滅の刃 ライブイベント",
          source: "kimetsu.com",
          page_id: 1,
          matched_via: "direct",
          matched_term: "鬼滅の刃",
          occurrences: [{ label: "東京会場", event_date: "2026-09-15" }],
        },
      ],
    });
    mockCallGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: responseJson }] } }],
    });

    const pages = [{ url: "https://kimetsu.com/1", text: "本文" }];
    const result = await extractEventsFromPages(env, "鬼滅の刃", pages);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://kimetsu.com/1");

    const [, body] = mockCallGenerateContent.mock.calls[0];
    expect(body.tools).toBeUndefined();
    expect(body.generationConfig.responseSchema).toBeDefined();
    expect(body.contents[0].parts[0].text).toContain("本文");
  });

  it("declares category and summary in the response schema (LINE Flex Message用)", async () => {
    mockCallGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ events: [] }) }] } }],
    });

    await extractEventsFromPages(env, "鬼滅の刃", [{ url: "https://kimetsu.com/1", text: "本文" }]);

    const [, body] = mockCallGenerateContent.mock.calls[0];
    const eventSchema = body.generationConfig.responseSchema.properties.events.items.properties;
    expect(eventSchema.category.enum).toEqual([
      "movie",
      "exhibition",
      "game",
      "concert",
      "collab",
      "other",
    ]);
    expect(eventSchema.summary.type).toBe("string");
  });

  it("carries the source page's image URL through to the parsed candidate", async () => {
    const responseJson = JSON.stringify({
      events: [
        {
          title: "鬼滅の刃 ライブイベント",
          source: "kimetsu.com",
          page_id: 1,
          matched_via: "direct",
          matched_term: "鬼滅の刃",
          category: "concert",
          summary: "要約",
          occurrences: [{ label: "東京会場", event_date: "2026-09-15" }],
        },
      ],
    });
    mockCallGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: responseJson }] } }],
    });

    const pages = [{ url: "https://kimetsu.com/1", text: "本文", imageUrl: "https://kimetsu.com/og.jpg" }];
    const result = await extractEventsFromPages(env, "鬼滅の刃", pages);

    expect(result[0]).toMatchObject({
      category: "concert",
      summary: "要約",
      image_url: "https://kimetsu.com/og.jpg",
    });
  });

  it("returns an empty array when the response has no usable text", async () => {
    mockCallGenerateContent.mockResolvedValue({ candidates: [{}] });

    const result = await extractEventsFromPages(env, "鬼滅の刃", [
      { url: "https://x.example", text: "t" },
    ]);

    expect(result).toEqual([]);
  });
});
