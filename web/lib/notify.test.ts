import { afterEach, describe, expect, it, vi } from "vitest";
import { runDailyNotify } from "./notify";
import { todayInJst } from "./today";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Event } from "./events";

// runDailyNotify内部の「今日」判定はJST基準（lib/today.ts）のため、テストの
// created_atもJST基準で揃える必要がある（UTC基準だと07:00-09:00 JSTの間だけ失敗する）
const TODAY = todayInJst();

function todaysEvent(id: string, confidence: Event["confidence"]): Event {
  return {
    id,
    title: `イベント${id}`,
    source: "example.com",
    matched_keyword: "テスト",
    matched_via: "direct",
    confidence,
    created_at: `${TODAY}T00:00:00Z`,
  };
}

function fakeClient(events: Event[], notifiedEventIds: string[]) {
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "events") {
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: events, error: null }),
        }),
      };
    }
    if (table === "notifications") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: notifiedEventIds.map((event_id) => ({ event_id })),
            error: null,
          }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return { from } as unknown as SupabaseClient;
}

describe("runDailyNotify", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws when the LINE channel access token is missing", async () => {
    const client = fakeClient([], []);

    await expect(runDailyNotify(client, undefined)).rejects.toThrow(
      "LINE_CHANNEL_ACCESS_TOKEN"
    );
  });

  it("skips sending (no LINE call) when there are no candidates for today", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = fakeClient([], []);

    const result = await runDailyNotify(client, "token");

    expect(result).toEqual({ candidates: 0, sent: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends today's new events and records them as notified", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const client = fakeClient([todaysEvent("1", "confirmed")], []);

    const result = await runDailyNotify(client, "token");

    expect(result).toEqual({ candidates: 1, sent: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not re-send events that were already notified today", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = fakeClient([todaysEvent("1", "confirmed")], ["1"]);

    const result = await runDailyNotify(client, "token");

    expect(result).toEqual({ candidates: 0, sent: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
