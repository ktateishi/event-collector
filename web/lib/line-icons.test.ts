import { describe, expect, it } from "vitest";
import { categoryIconUrl } from "./line-icons";

describe("categoryIconUrl", () => {
  it("resolves a per-category icon URL under the given site URL", () => {
    expect(categoryIconUrl("movie", "https://example.com")).toBe(
      "https://example.com/icons/movie.png"
    );
    expect(categoryIconUrl("collab", "https://example.com")).toBe(
      "https://example.com/icons/collab.png"
    );
  });

  it("falls back to the 'other' icon when category is undefined", () => {
    expect(categoryIconUrl(undefined, "https://example.com")).toBe(
      "https://example.com/icons/other.png"
    );
  });

  it("strips a trailing slash from the site URL", () => {
    expect(categoryIconUrl("game", "https://example.com/")).toBe(
      "https://example.com/icons/game.png"
    );
  });
});
