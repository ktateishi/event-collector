import { describe, expect, it } from "vitest";
import {
  earliestDate,
  isAlreadyOver,
  isEnded,
  isSafelyDeletable,
  mergeOccurrences,
  type Occurrence,
} from "./occurrences";

const tokyo: Occurrence = {
  label: "東京会場",
  event_date: "2026-09-16",
  url: "https://example.com/tokyo",
};
const nagoya: Occurrence = {
  label: "名古屋会場",
  event_date: "2026-11-01",
  url: "https://example.com/nagoya",
};
const osaka: Occurrence = { label: "大阪会場", event_date: "2026-12-05" };

describe("mergeOccurrences", () => {
  it("adds occurrences that are not already present", () => {
    const result = mergeOccurrences([tokyo], [nagoya]);

    expect(result).toHaveLength(2);
    expect(result.map((o) => o.label)).toEqual(["東京会場", "名古屋会場"]);
  });

  it("does not duplicate an occurrence with the same label and date", () => {
    const result = mergeOccurrences([tokyo, nagoya], [{ ...tokyo }, osaka]);

    expect(result).toHaveLength(3);
    expect(result.map((o) => o.label)).toEqual(["東京会場", "名古屋会場", "大阪会場"]);
  });

  it("treats the same label with a different date as a separate occurrence", () => {
    const rescheduled = { ...tokyo, event_date: "2026-10-01" };

    const result = mergeOccurrences([tokyo], [rescheduled]);

    expect(result).toHaveLength(2);
  });

  it("fills in missing fields on an existing occurrence rather than dropping them", () => {
    const withoutUrl: Occurrence = { label: "東京会場", event_date: "2026-09-16" };
    const withUrl: Occurrence = {
      label: "東京会場",
      event_date: "2026-09-16",
      url: "https://example.com/tokyo",
      deadline_at: "2026-09-10T23:59:59+09:00",
      event_end_date: "2026-09-20",
    };

    const result = mergeOccurrences([withoutUrl], [withUrl]);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://example.com/tokyo");
    expect(result[0].deadline_at).toBe("2026-09-10T23:59:59+09:00");
    expect(result[0].event_end_date).toBe("2026-09-20");
  });

  it("handles empty inputs on either side", () => {
    expect(mergeOccurrences([], [tokyo])).toEqual([tokyo]);
    expect(mergeOccurrences([tokyo], [])).toEqual([tokyo]);
    expect(mergeOccurrences([], [])).toEqual([]);
  });
});

describe("earliestDate", () => {
  it("returns the earliest event_date across occurrences", () => {
    expect(earliestDate([nagoya, tokyo, osaka])).toBe("2026-09-16");
  });

  it("ignores occurrences without a date", () => {
    expect(earliestDate([{ label: "未定" }, nagoya])).toBe("2026-11-01");
  });

  it("returns undefined when no occurrence has a date", () => {
    expect(earliestDate([{ label: "未定" }])).toBeUndefined();
    expect(earliestDate([])).toBeUndefined();
  });
});

const TODAY = "2026-11-15";

describe("isEnded", () => {
  it("is true when every occurrence's end date has passed", () => {
    const past: Occurrence[] = [
      { label: "東京会場", event_date: "2026-09-01", event_end_date: "2026-09-30" },
      { label: "大阪会場", event_date: "2026-10-01", event_end_date: "2026-10-31" },
    ];

    expect(isEnded(past, TODAY)).toBe(true);
  });

  it("is false when at least one occurrence is still upcoming", () => {
    const mixed: Occurrence[] = [
      { label: "東京会場", event_date: "2026-09-01", event_end_date: "2026-09-30" },
      { label: "大阪会場", event_date: "2026-12-01", event_end_date: "2026-12-20" },
    ];

    expect(isEnded(mixed, TODAY)).toBe(false);
  });

  it("is false while an occurrence's period is still running", () => {
    const ongoing: Occurrence[] = [
      { label: "東京会場", event_date: "2026-10-30", event_end_date: "2026-12-07" },
    ];

    expect(isEnded(ongoing, TODAY)).toBe(false);
  });

  it("falls back to event_date when no end date is given", () => {
    expect(isEnded([{ label: "単日", event_date: "2026-09-01" }], TODAY)).toBe(true);
    expect(isEnded([{ label: "単日", event_date: "2026-12-01" }], TODAY)).toBe(false);
  });

  it("uses deadline_at when it is the only date available", () => {
    expect(
      isEnded([{ label: "受付", deadline_at: "2026-09-30T23:59:59+09:00" }], TODAY)
    ).toBe(true);
  });

  it("is false when there is no date information at all (never hide what we cannot judge)", () => {
    expect(isEnded([{ label: "未定" }], TODAY)).toBe(false);
    expect(isEnded([], TODAY)).toBe(false);
  });
});

describe("isAlreadyOver (ingest guard)", () => {
  it("rejects an event whose explicit end date has passed", () => {
    const ended: Occurrence[] = [
      { label: "東京会場", event_date: "2026-09-01", event_end_date: "2026-09-30" },
    ];

    expect(isAlreadyOver(ended, TODAY)).toBe(true);
  });

  it("does NOT reject when only a start date is slightly in the past (may still be running)", () => {
    const maybeOngoing: Occurrence[] = [{ label: "東京会場", event_date: "2026-10-30" }];

    expect(isAlreadyOver(maybeOngoing, TODAY)).toBe(false);
  });

  it("rejects when only a start date is given but it is long past (clearly stale)", () => {
    const stale: Occurrence[] = [{ label: "東京会場", event_date: "2025-01-01" }];

    expect(isAlreadyOver(stale, TODAY)).toBe(true);
  });

  it("does not reject when any occurrence is upcoming", () => {
    const mixed: Occurrence[] = [
      { label: "終了", event_date: "2025-01-01" },
      { label: "予定", event_date: "2026-12-01" },
    ];

    expect(isAlreadyOver(mixed, TODAY)).toBe(false);
  });
});

describe("isSafelyDeletable", () => {
  it("is true only after the grace period has passed since the explicit end", () => {
    const ended: Occurrence[] = [
      { label: "東京会場", event_date: "2026-09-01", event_end_date: "2026-10-01" },
    ];

    expect(isSafelyDeletable(ended, TODAY, 30)).toBe(true);
    expect(isSafelyDeletable(ended, "2026-10-20", 30)).toBe(false);
  });

  it("never deletes an event whose end date is only inferred from a start date", () => {
    const inferredOnly: Occurrence[] = [{ label: "東京会場", event_date: "2025-01-01" }];

    expect(isSafelyDeletable(inferredOnly, TODAY, 30)).toBe(false);
  });

  it("never deletes when any occurrence is still upcoming", () => {
    const mixed: Occurrence[] = [
      { label: "終了", event_date: "2026-01-01", event_end_date: "2026-01-31" },
      { label: "予定", event_date: "2026-12-01", event_end_date: "2026-12-20" },
    ];

    expect(isSafelyDeletable(mixed, TODAY, 30)).toBe(false);
  });

  it("never deletes when there is no date information", () => {
    expect(isSafelyDeletable([{ label: "未定" }], TODAY, 30)).toBe(false);
    expect(isSafelyDeletable([], TODAY, 30)).toBe(false);
  });
});
