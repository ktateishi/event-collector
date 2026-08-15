import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSearchGroundingUrls,
  mockFetchPageText,
  mockExtractEventsFromPages,
  mockSearchYoutube,
} = vi.hoisted(() => ({
  mockSearchGroundingUrls: vi.fn(),
  mockFetchPageText: vi.fn(),
  mockExtractEventsFromPages: vi.fn(),
  mockSearchYoutube: vi.fn(),
}));

vi.mock("./gemini-search", () => ({ searchGroundingUrls: mockSearchGroundingUrls }));
vi.mock("./fetch-page", () => ({ fetchPageText: mockFetchPageText }));
vi.mock("./gemini-extract", () => ({ extractEventsFromPages: mockExtractEventsFromPages }));
vi.mock("./youtube", async () => {
  const actual = await vi.importActual<typeof import("./youtube")>("./youtube");
  return { ...actual, searchYoutube: mockSearchYoutube };
});

const { collectEventsForKeyword } = await import("./gemini");

const env = {
  projectId: "p",
  location: "us-central1",
  model: "gemini-2.5-flash",
  serviceAccountKeyJson: "{}",
};

describe("collectEventsForKeyword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wires search -> fetch -> extract in order, skipping failed fetches", async () => {
    mockSearchGroundingUrls.mockResolvedValue(["https://a.example", "https://b.example"]);
    mockFetchPageText.mockImplementation(async (url: string) =>
      url === "https://a.example" ? { url, text: "本文A" } : null
    );
    mockExtractEventsFromPages.mockResolvedValue([{ title: "event" }]);

    const result = await collectEventsForKeyword(env, "鬼滅の刃");

    expect(mockSearchGroundingUrls).toHaveBeenCalledWith(env, "鬼滅の刃");
    expect(mockExtractEventsFromPages).toHaveBeenCalledWith(
      env,
      "鬼滅の刃",
      [{ url: "https://a.example", text: "本文A" }],
      []
    );
    expect(result).toEqual([{ title: "event" }]);
  });

  it("returns an empty array without fetching/extracting when no URLs are found", async () => {
    mockSearchGroundingUrls.mockResolvedValue([]);

    const result = await collectEventsForKeyword(env, "鬼滅の刃");

    expect(result).toEqual([]);
    expect(mockFetchPageText).not.toHaveBeenCalled();
    expect(mockExtractEventsFromPages).not.toHaveBeenCalled();
  });

  it("merges YouTube results into the pages passed to extraction when a YouTube API key is given", async () => {
    mockSearchGroundingUrls.mockResolvedValue(["https://a.example"]);
    mockFetchPageText.mockResolvedValue({ url: "https://a.example", text: "本文A" });
    mockSearchYoutube.mockResolvedValue([
      {
        title: "配信タイトル",
        description: "配信の説明",
        channel: "ch",
        publishedAt: "2026-08-01T00:00:00Z",
        url: "https://www.youtube.com/watch?v=abc123",
        thumbnailUrl: "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
      },
    ]);
    mockExtractEventsFromPages.mockResolvedValue([]);

    await collectEventsForKeyword(env, "鬼滅の刃", "fake-youtube-key");

    expect(mockSearchYoutube).toHaveBeenCalledWith("fake-youtube-key", "鬼滅の刃");
    expect(mockExtractEventsFromPages).toHaveBeenCalledWith(
      env,
      "鬼滅の刃",
      [
        { url: "https://a.example", text: "本文A" },
        {
          url: "https://www.youtube.com/watch?v=abc123",
          text: "配信タイトル\n配信の説明",
          imageUrl: "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
        },
      ],
      []
    );
  });

  it("skips YouTube search entirely when no API key is given", async () => {
    mockSearchGroundingUrls.mockResolvedValue([]);

    await collectEventsForKeyword(env, "鬼滅の刃");

    expect(mockSearchYoutube).not.toHaveBeenCalled();
  });

  it("does not let a YouTube search failure break collection of the other sources", async () => {
    mockSearchGroundingUrls.mockResolvedValue(["https://a.example"]);
    mockFetchPageText.mockResolvedValue({ url: "https://a.example", text: "本文A" });
    mockSearchYoutube.mockRejectedValue(new Error("quota exceeded"));
    mockExtractEventsFromPages.mockResolvedValue([{ title: "event" }]);

    const result = await collectEventsForKeyword(env, "鬼滅の刃", "fake-youtube-key");

    expect(result).toEqual([{ title: "event" }]);
    expect(mockExtractEventsFromPages).toHaveBeenCalledWith(
      env,
      "鬼滅の刃",
      [{ url: "https://a.example", text: "本文A" }],
      []
    );
  });

  it("still extracts from YouTube-only results when web search grounding finds nothing", async () => {
    mockSearchGroundingUrls.mockResolvedValue([]);
    mockSearchYoutube.mockResolvedValue([
      {
        title: "配信タイトル",
        description: "配信の説明",
        channel: "ch",
        publishedAt: "2026-08-01T00:00:00Z",
        url: "https://www.youtube.com/watch?v=abc123",
        thumbnailUrl: "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
      },
    ]);
    mockExtractEventsFromPages.mockResolvedValue([{ title: "event" }]);

    const result = await collectEventsForKeyword(env, "鬼滅の刃", "fake-youtube-key");

    expect(result).toEqual([{ title: "event" }]);
    expect(mockFetchPageText).not.toHaveBeenCalled();
  });

  it("passes excludedTitles through to extraction (不要情報の除外機構)", async () => {
    mockSearchGroundingUrls.mockResolvedValue(["https://a.example"]);
    mockFetchPageText.mockResolvedValue({ url: "https://a.example", text: "本文A" });
    mockExtractEventsFromPages.mockResolvedValue([]);

    await collectEventsForKeyword(env, "鬼滅の刃", undefined, ["フィギュア発売"]);

    expect(mockExtractEventsFromPages).toHaveBeenCalledWith(
      env,
      "鬼滅の刃",
      [{ url: "https://a.example", text: "本文A" }],
      ["フィギュア発売"]
    );
  });
});
