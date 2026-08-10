import { describe, expect, it, vi } from "vitest";

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

  it("returns an empty array when the response has no usable text", async () => {
    mockCallGenerateContent.mockResolvedValue({ candidates: [{}] });

    const result = await extractEventsFromPages(env, "鬼滅の刃", [
      { url: "https://x.example", text: "t" },
    ]);

    expect(result).toEqual([]);
  });
});
