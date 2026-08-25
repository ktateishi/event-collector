import { describe, expect, it } from "vitest";
import { clusterEventsByVenue } from "./venue-groups";
import type { Event } from "./events";

function event(id: string, title: string, occurrences: Event["occurrences"]): Event {
  return {
    id,
    title,
    source: "example.com",
    matched_keyword: "テスト",
    matched_via: "direct",
    confidence: "confirmed",
    occurrences,
    created_at: "2026-08-01T00:00:00Z",
  };
}

describe("clusterEventsByVenue", () => {
  it("groups two single-occurrence events that share the same venue label", () => {
    const events = [
      event("1", "三鷹の森ジブリ美術館 土星座上映作品『毛虫のボロ』", [
        { label: "三鷹の森ジブリ美術館", event_date: "2026-08-01" },
      ]),
      event("2", "三鷹の森ジブリ美術館 企画展示『山脇百合子の仕事部屋』展", [
        { label: "三鷹の森ジブリ美術館", event_date: "2025-11-01" },
      ]),
    ];

    const clusters = clusterEventsByVenue(events);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].map((e) => e.id)).toEqual(["1", "2"]);
  });

  it("normalizes labels before comparing (whitespace/bracket differences)", () => {
    const events = [
      event("1", "『Lines of EVANGELION』台北展 前売券発売", [
        { label: "台北展前売券", registration_opens_at: "2026-07-09T00:00:00" },
      ]),
      event("2", "『Lines of EVANGELION』台北展", [
        { label: "台北展 前売券", registration_opens_at: "2026-07-09T00:00:00" },
      ]),
    ];

    const clusters = clusterEventsByVenue(events);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].map((e) => e.id)).toEqual(["1", "2"]);
  });

  it("keeps unrelated events as separate, single-item clusters", () => {
    const events = [
      event("1", "イベントA", [{ label: "東京会場サンシャイン水族館", event_date: "2026-08-01" }]),
      event("2", "イベントB", [{ label: "大阪会場", event_date: "2026-08-02" }]),
    ];

    const clusters = clusterEventsByVenue(events);

    expect(clusters).toEqual([[events[0]], [events[1]]]);
  });

  it("does not group events on the generic default label '開催'", () => {
    const events = [
      event("1", "イベントA", [{ label: "開催", event_date: "2026-08-01" }]),
      event("2", "イベントB", [{ label: "開催", event_date: "2026-08-02" }]),
    ];

    const clusters = clusterEventsByVenue(events);

    expect(clusters).toEqual([[events[0]], [events[1]]]);
  });

  it("does not group events on short, generic venue labels (e.g. plain regional names)", () => {
    const events = [
      event("1", "巡回展A 東京会場", [{ label: "東京会場", event_date: "2026-08-01" }]),
      event("2", "巡回展B 東京会場", [{ label: "東京会場", event_date: "2026-09-01" }]),
    ];

    const clusters = clusterEventsByVenue(events);

    expect(clusters).toEqual([[events[0]], [events[1]]]);
  });

  it("excludes multi-occurrence events from clustering (already resolved as one event, Task 18)", () => {
    const events = [
      event("1", "巡回展 全国会場", [
        { label: "三鷹の森ジブリ美術館", event_date: "2026-08-01" },
        { label: "別会場", event_date: "2026-09-01" },
      ]),
      event("2", "単独イベント", [{ label: "三鷹の森ジブリ美術館", event_date: "2026-08-05" }]),
    ];

    const clusters = clusterEventsByVenue(events);

    expect(clusters).toEqual([[events[0]], [events[1]]]);
  });

  it("passes through events with no occurrences as their own cluster", () => {
    const events = [event("1", "日程未定イベント", [])];

    expect(clusterEventsByVenue(events)).toEqual([[events[0]]]);
  });

  it("groups three or more events sharing the same venue label", () => {
    const events = [
      event("1", "A", [{ label: "三鷹の森ジブリ美術館" }]),
      event("2", "B", [{ label: "三鷹の森ジブリ美術館" }]),
      event("3", "C", [{ label: "三鷹の森ジブリ美術館" }]),
    ];

    const clusters = clusterEventsByVenue(events);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(3);
  });
});
