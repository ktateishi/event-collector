import { describe, expect, it } from "vitest";
import { earliestDate, mergeOccurrences, type Occurrence } from "./occurrences";

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
    };

    const result = mergeOccurrences([withoutUrl], [withUrl]);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://example.com/tokyo");
    expect(result[0].deadline_at).toBe("2026-09-10T23:59:59+09:00");
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
