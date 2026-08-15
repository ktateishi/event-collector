import { describe, expect, it, vi } from "vitest";
import { addExcludedExample, listRecentExcludedExamples } from "./excluded-examples";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("listRecentExcludedExamples", () => {
  it("returns the titles of the most recently excluded examples", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ title: "フィギュア発売" }, { title: "ポスター発売" }],
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const result = await listRecentExcludedExamples(client);

    expect(result).toEqual(["フィギュア発売", "ポスター発売"]);
    expect(client.from).toHaveBeenCalledWith("excluded_examples");
  });

  it("limits to 10 by default", async () => {
    const limitMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({ limit: limitMock }),
        }),
      }),
    } as unknown as SupabaseClient;

    await listRecentExcludedExamples(client);

    expect(limitMock).toHaveBeenCalledWith(10);
  });

  it("throws when Supabase returns an error", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(listRecentExcludedExamples(client)).rejects.toThrow("boom");
  });
});

describe("addExcludedExample", () => {
  it("inserts a title and source_keyword", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ insert }) } as unknown as SupabaseClient;

    await addExcludedExample(client, "フィギュア発売", "エヴァンゲリオン");

    expect(client.from).toHaveBeenCalledWith("excluded_examples");
    expect(insert).toHaveBeenCalledWith({
      title: "フィギュア発売",
      source_keyword: "エヴァンゲリオン",
    });
  });

  it("throws when Supabase returns an error", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: { message: "boom" } }),
      }),
    } as unknown as SupabaseClient;

    await expect(addExcludedExample(client, "t", undefined)).rejects.toThrow("boom");
  });
});
