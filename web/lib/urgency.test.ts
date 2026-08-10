import { describe, expect, it } from "vitest";
import { nextRelevantDate, urgencyLevel } from "./urgency";
import type { Event } from "./events";

const TODAY = "2026-08-10";

function baseEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "1",
    title: "テストイベント",
    source: "web",
    matched_keyword: "テスト",
    matched_via: "direct",
    confidence: "confirmed",
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("urgencyLevel", () => {
  it("is urgent within 7 days", () => {
    expect(urgencyLevel("2026-08-12", TODAY)).toBe("urgent");
    expect(urgencyLevel("2026-08-17", TODAY)).toBe("urgent");
  });

  it("is soon between 8 and 30 days", () => {
    expect(urgencyLevel("2026-08-18", TODAY)).toBe("soon");
    expect(urgencyLevel("2026-09-09", TODAY)).toBe("soon");
  });

  it("is normal beyond 30 days", () => {
    expect(urgencyLevel("2026-09-10", TODAY)).toBe("normal");
  });

  it("is normal when the date has already passed", () => {
    expect(urgencyLevel("2026-08-01", TODAY)).toBe("normal");
  });

  it("is normal when there is no date", () => {
    expect(urgencyLevel(undefined, TODAY)).toBe("normal");
  });
});

describe("nextRelevantDate", () => {
  it("picks the earliest upcoming date among occurrences' fields", () => {
    const event = baseEvent({
      occurrences: [
        { label: "名古屋会場", event_date: "2026-11-01" },
        { label: "東京会場", event_date: "2026-08-15", deadline_at: "2026-08-12T00:00:00Z" },
      ],
    });

    expect(nextRelevantDate(event, TODAY)).toBe("2026-08-12");
  });

  it("ignores dates that have already passed", () => {
    const event = baseEvent({
      occurrences: [{ label: "終了済み会場", event_date: "2026-01-01" }],
    });

    expect(nextRelevantDate(event, TODAY)).toBeUndefined();
  });

  it("falls back to top-level event fields when there are no occurrences", () => {
    const event = baseEvent({ event_date: "2026-08-20" });

    expect(nextRelevantDate(event, TODAY)).toBe("2026-08-20");
  });

  it("returns undefined when nothing is upcoming", () => {
    const event = baseEvent({});

    expect(nextRelevantDate(event, TODAY)).toBeUndefined();
  });
});
