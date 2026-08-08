import { describe, expect, it, vi } from "vitest";
import { addKeyword, deleteKeyword, listKeywords } from "./keywords";
import type { SupabaseClient } from "@supabase/supabase-js";

function fakeClient(overrides: {
  selectResult?: { data: unknown; error: { message: string } | null };
  insertResult?: { data: unknown; error: { message: string; code?: string } | null };
  deleteResult?: { error: { message: string } | null };
}) {
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue(
        overrides.selectResult ?? { data: [], error: null }
      ),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(
          overrides.insertResult ?? { data: { id: "1", keyword: "test" }, error: null }
        ),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(overrides.deleteResult ?? { error: null }),
    }),
  });
  return { from } as unknown as SupabaseClient;
}

describe("listKeywords", () => {
  it("returns keywords ordered by created_at", async () => {
    const client = fakeClient({
      selectResult: {
        data: [{ id: "1", keyword: "鬼滅の刃", created_at: "2026-08-01" }],
        error: null,
      },
    });

    const result = await listKeywords(client);

    expect(result).toEqual([{ id: "1", keyword: "鬼滅の刃", created_at: "2026-08-01" }]);
  });
});

describe("addKeyword", () => {
  it("rejects an empty (whitespace-only) keyword without touching the DB", async () => {
    const client = fakeClient({});

    await expect(addKeyword(client, "   ")).rejects.toThrow("キーワードを入力してください");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("inserts a trimmed keyword", async () => {
    const client = fakeClient({
      insertResult: { data: { id: "1", keyword: "鬼滅の刃" }, error: null },
    });

    const result = await addKeyword(client, "  鬼滅の刃  ");

    expect(result).toEqual({ id: "1", keyword: "鬼滅の刃" });
  });

  it("raises a friendly error on duplicate keyword", async () => {
    const client = fakeClient({
      insertResult: { data: null, error: { message: "duplicate key value", code: "23505" } },
    });

    await expect(addKeyword(client, "鬼滅の刃")).rejects.toThrow(
      "このキーワードはすでに登録されています"
    );
  });
});

describe("deleteKeyword", () => {
  it("deletes by id", async () => {
    const client = fakeClient({ deleteResult: { error: null } });

    await expect(deleteKeyword(client, "1")).resolves.toBeUndefined();
  });

  it("throws when Supabase returns an error", async () => {
    const client = fakeClient({ deleteResult: { error: { message: "not found" } } });

    await expect(deleteKeyword(client, "1")).rejects.toThrow("not found");
  });
});
