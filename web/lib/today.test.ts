import { describe, expect, it } from "vitest";
import { todayInJst } from "./today";

describe("todayInJst", () => {
  it("returns the UTC date when it already matches JST (well into the day)", () => {
    expect(todayInJst(new Date("2026-08-12T01:00:00Z"))).toBe("2026-08-12");
  });

  it("rolls over to the next day during the UTC/JST mismatch window (07:00-09:00 JST)", () => {
    // 22:30 UTC (Aug 11) == 07:30 JST (Aug 12) — the daily collection cron fires in this window
    expect(todayInJst(new Date("2026-08-11T22:30:00Z"))).toBe("2026-08-12");
  });

  it("stays on the same JST day just before midnight JST", () => {
    // 14:59:59 UTC == 23:59:59 JST (still Aug 12)
    expect(todayInJst(new Date("2026-08-12T14:59:59Z"))).toBe("2026-08-12");
  });

  it("rolls over at JST midnight", () => {
    // 15:00:00 UTC == 00:00:00 JST (already Aug 13)
    expect(todayInJst(new Date("2026-08-12T15:00:00Z"))).toBe("2026-08-13");
  });
});
