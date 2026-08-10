import { describe, expect, it, vi } from "vitest";
import { listNotifiedEventIds, recordNotifications } from "./notifications";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("listNotifiedEventIds", () => {
  it("returns the set of event ids already notified for the given type", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ event_id: "1" }, { event_id: "2" }],
            error: null,
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await listNotifiedEventIds(client, "daily");

    expect(result).toEqual(new Set(["1", "2"]));
    expect(client.from).toHaveBeenCalledWith("notifications");
  });

  it("throws when Supabase returns an error", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(listNotifiedEventIds(client, "daily")).rejects.toThrow("boom");
  });
});

describe("recordNotifications", () => {
  it("does nothing when there are no event ids", async () => {
    const upsert = vi.fn();
    const client = { from: vi.fn().mockReturnValue({ upsert }) } as unknown as SupabaseClient;

    await recordNotifications(client, [], "daily");

    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts one row per event id, ignoring duplicates", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ upsert }) } as unknown as SupabaseClient;

    await recordNotifications(client, ["1", "2"], "daily");

    expect(client.from).toHaveBeenCalledWith("notifications");
    expect(upsert).toHaveBeenCalledWith(
      [
        { event_id: "1", type: "daily" },
        { event_id: "2", type: "daily" },
      ],
      { onConflict: "event_id,type", ignoreDuplicates: true }
    );
  });

  it("throws when Supabase returns an error", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const client = { from: vi.fn().mockReturnValue({ upsert }) } as unknown as SupabaseClient;

    await expect(recordNotifications(client, ["1"], "daily")).rejects.toThrow("boom");
  });
});
