import { describe, expect, it, vi, afterEach } from "vitest";
import { searchYoutube, youtubeResultsToPages } from "./youtube";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchYoutube", () => {
  it("returns simplified results including description and thumbnail on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: { videoId: "abc123" },
            snippet: {
              title: "鬼滅の刃 記念配信",
              description: "8月15日20時から記念生配信を行います。",
              channelTitle: "Aniplex",
              publishedAt: "2026-08-01T00:00:00Z",
              thumbnails: {
                default: { url: "https://i.ytimg.com/vi/abc123/default.jpg" },
                high: { url: "https://i.ytimg.com/vi/abc123/hqdefault.jpg" },
              },
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchYoutube("fake-key", "鬼滅の刃");

    expect(results).toEqual([
      {
        title: "鬼滅の刃 記念配信",
        description: "8月15日20時から記念生配信を行います。",
        channel: "Aniplex",
        publishedAt: "2026-08-01T00:00:00Z",
        url: "https://www.youtube.com/watch?v=abc123",
        thumbnailUrl: "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("key=fake-key"));
  });

  it("falls back to the default thumbnail when a high-res one is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: { videoId: "xyz789" },
              snippet: {
                title: "t",
                description: "d",
                channelTitle: "c",
                publishedAt: "2026-08-01T00:00:00Z",
                thumbnails: { default: { url: "https://i.ytimg.com/vi/xyz789/default.jpg" } },
              },
            },
          ],
        }),
      })
    );

    const results = await searchYoutube("fake-key", "q");

    expect(results[0].thumbnailUrl).toBe("https://i.ytimg.com/vi/xyz789/default.jpg");
  });

  it("throws a friendly error when the YouTube API responds with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) })
    );

    await expect(searchYoutube("fake-key", "q")).rejects.toThrow(
      "YouTube検索に失敗しました (status 403)"
    );
  });
});

describe("youtubeResultsToPages", () => {
  it("converts YouTube results into the page shape used by the extraction pipeline", () => {
    const pages = youtubeResultsToPages([
      {
        title: "鬼滅の刃 記念配信",
        description: "8月15日20時から記念生配信を行います。",
        channel: "Aniplex",
        publishedAt: "2026-08-01T00:00:00Z",
        url: "https://www.youtube.com/watch?v=abc123",
        thumbnailUrl: "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
      },
    ]);

    expect(pages).toEqual([
      {
        url: "https://www.youtube.com/watch?v=abc123",
        text: "鬼滅の刃 記念配信\n8月15日20時から記念生配信を行います。",
        imageUrl: "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
      },
    ]);
  });

  it("returns an empty array for no results", () => {
    expect(youtubeResultsToPages([])).toEqual([]);
  });
});
