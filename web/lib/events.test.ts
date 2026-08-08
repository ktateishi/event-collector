import { describe, expect, it, vi } from "vitest";
import { getEventCount } from "./events";
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
