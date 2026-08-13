import { describe, expect, it } from "vitest";
import { MAX_REMINDER_EVENTS, selectEventsForReminder } from "./reminders";
import type { Event } from "./events";

const TODAY = "2026-08-13";
const DAYS_BEFORE = 3;
// TODAY + 3日 = 2026-08-16 が「リマインド対象日」になる

function event(id: string, overrides: Partial<Event> = {}): Event {
  return {
    id,
    title: `イベント${id}`,
    source: "example.com",
    matched_keyword: "テスト",
    matched_via: "direct",
    confidence: "confirmed",
    created_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("selectEventsForReminder", () => {
  it("selects an event whose registration_opens_at falls exactly N days from today (JST)", () => {
    const events = [
      event("1", {
        occurrences: [
          { label: "開催", registration_opens_at: "2026-08-16T10:00:00+09:00" },
        ],
      }),
    ];

    expect(selectEventsForReminder(events, TODAY, DAYS_BEFORE).map((e) => e.id)).toEqual(["1"]);
  });

  it("selects an event whose deadline_at falls exactly N days from today (JST)", () => {
    const events = [
      event("1", {
        occurrences: [{ label: "開催", deadline_at: "2026-08-16T23:59:59+09:00" }],
      }),
    ];

    expect(selectEventsForReminder(events, TODAY, DAYS_BEFORE).map((e) => e.id)).toEqual(["1"]);
  });

  it("does not select events whose relevant dates are on a different day", () => {
    const events = [
      event("1", {
        occurrences: [{ label: "開催", registration_opens_at: "2026-08-17T10:00:00+09:00" }],
      }),
      event("2", {
        occurrences: [{ label: "開催", deadline_at: "2026-08-15T23:59:59+09:00" }],
      }),
    ];

    expect(selectEventsForReminder(events, TODAY, DAYS_BEFORE)).toEqual([]);
  });

  it("checks all occurrences, selecting the event if any one of them matches", () => {
    const events = [
      event("1", {
        occurrences: [
          { label: "東京会場", registration_opens_at: "2026-08-01T10:00:00+09:00" },
          { label: "大阪会場", registration_opens_at: "2026-08-16T10:00:00+09:00" },
        ],
      }),
    ];

    expect(selectEventsForReminder(events, TODAY, DAYS_BEFORE).map((e) => e.id)).toEqual(["1"]);
  });

  it("falls back to the event's own top-level fields when there are no occurrences", () => {
    const events = [event("1", { deadline_at: "2026-08-16T23:59:59+09:00" })];

    expect(selectEventsForReminder(events, TODAY, DAYS_BEFORE).map((e) => e.id)).toEqual(["1"]);
  });

  it("returns an empty array when nothing matches", () => {
    const events = [event("1", { occurrences: [{ label: "開催" }] })];

    expect(selectEventsForReminder(events, TODAY, DAYS_BEFORE)).toEqual([]);
  });

  it("caps the result at MAX_REMINDER_EVENTS (LINE carousel's bubble limit)", () => {
    const events = Array.from({ length: MAX_REMINDER_EVENTS + 5 }, (_, i) =>
      event(String(i), {
        occurrences: [{ label: "開催", deadline_at: "2026-08-16T23:59:59+09:00" }],
      })
    );

    expect(selectEventsForReminder(events, TODAY, DAYS_BEFORE)).toHaveLength(
      MAX_REMINDER_EVENTS
    );
  });
});
