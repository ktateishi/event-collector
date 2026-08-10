import { describe, expect, it } from "vitest";
import { normalizeTitle } from "./normalize-title";

describe("normalizeTitle", () => {
  it("treats titles differing only in nested brackets as the same", () => {
    const a = "ホラー・メイズ「バイオハザード レクイエム」ザ・ダイブ";
    const b = "ホラー・メイズ「『バイオハザード レクイエム』ザ・ダイブ」";

    expect(normalizeTitle(a)).toBe(normalizeTitle(b));
  });

  it("ignores half-width vs full-width spacing differences", () => {
    const a = "呪術廻戦 展覧会";
    const b = "呪術廻戦　展覧会";

    expect(normalizeTitle(a)).toBe(normalizeTitle(b));
  });

  it("is case-insensitive", () => {
    expect(normalizeTitle("EVANGELION Store")).toBe(normalizeTitle("evangelion store"));
  });

  it("still distinguishes genuinely different titles", () => {
    expect(normalizeTitle("呪術廻戦展")).not.toBe(normalizeTitle("呪術廻戦カフェ"));
  });

  it("strips various bracket styles", () => {
    const variants = [
      "映画『バイオハザード』全米公開",
      "映画(バイオハザード)全米公開",
      "映画【バイオハザード】全米公開",
      "映画（バイオハザード）全米公開",
    ];
    const normalized = new Set(variants.map(normalizeTitle));

    expect(normalized.size).toBe(1);
  });
});
