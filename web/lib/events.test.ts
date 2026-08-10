import { describe, expect, it, vi } from "vitest";
import {
  getEventById,
  getEventCount,
  groupEventsByKeyword,
  listEvents,
  type Event,
} from "./events";
import type { SupabaseClient } from "@supabase/supabase-js";

function fakeSupabaseClient(count: number | null, error: { message: string } | null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ count, error }),
    }),
  } as unknown as SupabaseClient;
}

describe("getEventCount", () => {
  it("returns the row count from the events table", async () => {
    const client = fakeSupabaseClient(42, null);

    const result = await getEventCount(client);

    expect(result).toBe(42);
    expect(client.from).toHaveBeenCalledWith("events");
  });

  it("throws when Supabase returns an error", async () => {
    const client = fakeSupabaseClient(null, { message: "connection failed" });

    await expect(getEventCount(client)).rejects.toThrow("connection failed");
  });
});

const sampleEvent = {
  id: "1",
  title: "鬼滅の刃 ライブイベント",
  source: "kimetsu.com",
  matched_keyword: "鬼滅の刃",
  matched_via: "direct",
  confidence: "confirmed",
  event_date: "2026-09-15",
  created_at: "2026-08-01T00:00:00Z",
};

describe("listEvents", () => {
  it("returns events ordered by created_at descending", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [sampleEvent], error: null }),
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await listEvents(client);

    expect(result).toEqual([sampleEvent]);
    expect(client.from).toHaveBeenCalledWith("events");
  });

  it("throws when Supabase returns an error", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(listEvents(client)).rejects.toThrow("boom");
  });
});

describe("getEventById", () => {
  it("returns a single event by id", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: sampleEvent, error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await getEventById(client, "1");

    expect(result).toEqual(sampleEvent);
  });

  it("returns null when no event matches", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    expect(await getEventById(client, "missing")).toBeNull();
  });
});

describe("groupEventsByKeyword", () => {
  function event(id: string, source_keyword?: string): Event {
    return {
      id,
      title: `event ${id}`,
      source: "example.com",
      matched_keyword: "x",
      source_keyword,
      matched_via: "direct",
      confidence: "confirmed",
      created_at: "2026-08-01T00:00:00Z",
    };
  }

  it("groups events by their source_keyword", () => {
    const result = groupEventsByKeyword([
      event("1", "エヴァンゲリオン"),
      event("2", "バイオハザード"),
      event("3", "エヴァンゲリオン"),
    ]);

    expect(result).toHaveLength(2);
    const eva = result.find((g) => g.keyword === "エヴァンゲリオン");
    expect(eva?.events.map((e) => e.id)).toEqual(["1", "3"]);
  });

  it("puts events without a source_keyword into 未分類, listed last", () => {
    const result = groupEventsByKeyword([event("1"), event("2", "バイオハザード")]);

    expect(result.map((g) => g.keyword)).toEqual(["バイオハザード", "未分類"]);
  });

  it("returns an empty array for no events", () => {
    expect(groupEventsByKeyword([])).toEqual([]);
  });
});
