import { describe, expect, it } from "vitest";
import { getSiteUrl } from "./site-url";

describe("getSiteUrl", () => {
  it("prefers an explicitly configured SITE_URL", () => {
    const result = getSiteUrl({
      SITE_URL: "https://example.com",
      VERCEL_PROJECT_PRODUCTION_URL: "web-xxx.vercel.app",
    });

    expect(result).toBe("https://example.com");
  });

  it("falls back to Vercel's production URL system variable", () => {
    const result = getSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "web-xxx.vercel.app" });

    expect(result).toBe("https://web-xxx.vercel.app");
  });

  it("falls back to localhost when nothing is configured", () => {
    expect(getSiteUrl({})).toBe("http://localhost:3000");
  });

  it("strips a trailing slash from an explicitly configured SITE_URL", () => {
    expect(getSiteUrl({ SITE_URL: "https://example.com/" })).toBe("https://example.com");
  });
});
