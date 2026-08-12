import { describe, expect, it, vi } from "vitest";
import { getLatestReminderSetting, setReminderDays } from "./reminder-settings";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("getLatestReminderSetting", () => {
  it("returns the most recent setting row", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "1", days_before: 3, created_at: "2026-08-01T00:00:00Z" },
                error: null,
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await getLatestReminderSetting(client);

    expect(result).toEqual({ id: "1", days_before: 3, created_at: "2026-08-01T00:00:00Z" });
    expect(client.from).toHaveBeenCalledWith("reminder_settings");
  });

  it("returns null when no setting has ever been saved", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    expect(await getLatestReminderSetting(client)).toBeNull();
  });

  it("throws when Supabase returns an error", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(getLatestReminderSetting(client)).rejects.toThrow("boom");
  });
});

describe("setReminderDays", () => {
  function fakeClient() {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "2", days_before: 5, created_at: "2026-08-13T00:00:00Z" },
          error: null,
        }),
      }),
    });
    return { from: vi.fn().mockReturnValue({ insert }) } as unknown as SupabaseClient;
  }

  it("inserts a new setting row with the given days", async () => {
    const client = fakeClient();

    const result = await setReminderDays(client, 5);

    expect(result).toEqual({ id: "2", days_before: 5, created_at: "2026-08-13T00:00:00Z" });
    expect(client.from).toHaveBeenCalledWith("reminder_settings");
  });

  it("rejects a negative number without touching the DB", async () => {
    const client = fakeClient();

    await expect(setReminderDays(client, -1)).rejects.toThrow("0以上の整数");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects a non-integer number without touching the DB", async () => {
    const client = fakeClient();

    await expect(setReminderDays(client, 2.5)).rejects.toThrow("0以上の整数");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects NaN without touching the DB", async () => {
    const client = fakeClient();

    await expect(setReminderDays(client, Number.NaN)).rejects.toThrow("0以上の整数");
    expect(client.from).not.toHaveBeenCalled();
  });
});
