import { describe, expect, it, vi, afterEach } from "vitest";
import { searchYoutube } from "./youtube";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchYoutube", () => {
  it("returns simplified results on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: { videoId: "abc123" },
            snippet: {
              title: "鬼滅の刃 記念配信",
              channelTitle: "Aniplex",
              publishedAt: "2026-08-01T00:00:00Z",
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
        channel: "Aniplex",
        publishedAt: "2026-08-01T00:00:00Z",
        url: "https://www.youtube.com/watch?v=abc123",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("key=fake-key")
    );
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
