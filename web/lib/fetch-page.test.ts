import { describe, expect, it, vi, afterEach } from "vitest";
import { extractOgImage, fetchPageText, htmlToText, resolveGroundingUrl } from "./fetch-page";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("htmlToText", () => {
  it("strips tags and collapses whitespace", () => {
    const html = "<div><h1>タイトル</h1>\n\n  <p>本文です</p></div>";
    expect(htmlToText(html)).toBe("タイトル 本文です");
  });

  it("removes script and style contents entirely", () => {
    const html = "<style>.a{color:red}</style><script>var x=1;</script><p>見える</p>";
    expect(htmlToText(html)).toBe("見える");
  });

  it("decodes common HTML entities", () => {
    expect(htmlToText("<p>A&amp;B&nbsp;C</p>")).toBe("A&B C");
  });
});

describe("resolveGroundingUrl", () => {
  it("returns the Location header when the URL redirects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 302,
        headers: { get: (k: string) => (k === "location" ? "https://real.example.com/news/1" : null) },
      })
    );

    expect(await resolveGroundingUrl("https://redirect.example/abc")).toBe(
      "https://real.example.com/news/1"
    );
  });

  it("returns the original URL when there is no redirect", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 200, headers: { get: () => null } })
    );

    expect(await resolveGroundingUrl("https://direct.example/page")).toBe(
      "https://direct.example/page"
    );
  });

  it("returns the original URL when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    expect(await resolveGroundingUrl("https://broken.example")).toBe("https://broken.example");
  });
});

describe("extractOgImage", () => {
  it("extracts an absolute og:image URL", () => {
    const html = `<html><head><meta property="og:image" content="https://example.com/a.jpg" /></head></html>`;

    expect(extractOgImage(html, "https://example.com/news/1")).toBe("https://example.com/a.jpg");
  });

  it("works regardless of attribute order", () => {
    const html = `<meta content="https://example.com/b.jpg" property="og:image">`;

    expect(extractOgImage(html, "https://example.com/news/1")).toBe("https://example.com/b.jpg");
  });

  it("resolves a relative og:image URL against the page URL", () => {
    const html = `<meta property="og:image" content="/images/c.jpg">`;

    expect(extractOgImage(html, "https://example.com/news/1")).toBe(
      "https://example.com/images/c.jpg"
    );
  });

  it("falls back to twitter:image when og:image is absent", () => {
    const html = `<meta name="twitter:image" content="https://example.com/d.jpg">`;

    expect(extractOgImage(html, "https://example.com/news/1")).toBe("https://example.com/d.jpg");
  });

  it("returns undefined when neither tag is present", () => {
    const html = `<meta property="og:title" content="タイトル">`;

    expect(extractOgImage(html, "https://example.com/news/1")).toBeUndefined();
  });
});

describe("fetchPageText", () => {
  it("returns the final URL and extracted text on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: "https://real.example.com/news/1",
      text: async () => "<html><body><p>イベントは2026年9月15日開催</p></body></html>",
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPageText("https://real.example.com/news/1");

    expect(result).toEqual({
      url: "https://real.example.com/news/1",
      text: "イベントは2026年9月15日開催",
      imageUrl: undefined,
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["User-Agent"]).toContain("Mozilla");
  });

  it("includes the og:image URL found in the fetched page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        url: "https://real.example.com/news/1",
        text: async () =>
          `<html><head><meta property="og:image" content="https://real.example.com/thumb.jpg"></head><body><p>本文</p></body></html>`,
      })
    );

    const result = await fetchPageText("https://real.example.com/news/1");

    expect(result?.imageUrl).toBe("https://real.example.com/thumb.jpg");
  });

  it("returns null when the page responds with an error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, url: "x", text: async () => "" })
    );

    expect(await fetchPageText("https://gone.example")).toBeNull();
  });

  it("returns null when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));

    expect(await fetchPageText("https://slow.example")).toBeNull();
  });

  it("truncates text longer than maxChars", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        url: "https://long.example",
        text: async () => "<p>" + "あ".repeat(500) + "</p>",
      })
    );

    const result = await fetchPageText("https://long.example", 100);

    expect(result?.text).toHaveLength(100);
  });
});
