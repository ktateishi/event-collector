import { describe, expect, it, vi } from "vitest";
import { ingestEvents, type CandidateEvent } from "./ingest";
import type { SupabaseClient } from "@supabase/supabase-js";

function fakeClient(
  existingRows: { title: string }[],
  insertBehavior?: (row: unknown) => { data: unknown; error: { message: string } | null }
) {
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockResolvedValue({ data: existingRows, error: null }),
    insert: vi.fn().mockImplementation((row) => ({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(
          insertBehavior ? insertBehavior(row) : { data: { id: "generated-id", ...(row as object) }, error: null }
        ),
      }),
    })),
  });
  return { from } as unknown as SupabaseClient;
}

const validCandidate: CandidateEvent = {
  title: "鬼滅の刃 ライブイベント",
  source: "x.com/kimetsu_off",
  url: "https://x.com/kimetsu_off/status/1",
  matched_keyword: "鬼滅の刃",
  matched_via: "direct",
  confidence: "confirmed",
  event_date: "2026-09-15",
};

describe("ingestEvents", () => {
  it("inserts new events not present in the DB", async () => {
    const client = fakeClient([]);

    const result = await ingestEvents(client, [validCandidate], { dryRun: false });

    expect(result.inserted).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
    expect(client.from).toHaveBeenCalledWith("events");
  });

  it("skips events that already exist (same title, regardless of source)", async () => {
    const client = fakeClient([{ title: validCandidate.title }]);

    const result = await ingestEvents(client, [validCandidate], { dryRun: false });

    expect(result.inserted).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toBe("duplicate");
  });

  it("treats the same title from a different source as a duplicate (the reported bug)", async () => {
    const client = fakeClient([{ title: validCandidate.title }]);
    const sameTitleDifferentSource = { ...validCandidate, source: "another-site.example" };

    const result = await ingestEvents(client, [sameTitleDifferentSource], { dryRun: false });

    expect(result.inserted).toHaveLength(0);
    expect(result.skipped[0].reason).toBe("duplicate");
  });

  it("skips duplicates within the same batch too", async () => {
    const client = fakeClient([]);

    const result = await ingestEvents(client, [validCandidate, { ...validCandidate }], {
      dryRun: false,
    });

    expect(result.inserted).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
  });

  it("rejects candidates missing required fields without inserting", async () => {
    const client = fakeClient([]);
    const invalid = { ...validCandidate, title: "" };

    const result = await ingestEvents(client, [invalid], { dryRun: false });

    expect(result.inserted).toHaveLength(0);
    expect(result.skipped[0].reason).toBe("invalid");
  });

  it("rejects an unknown matched_via/confidence value", async () => {
    const client = fakeClient([]);
    const invalid = { ...validCandidate, confidence: "maybe" } as unknown as CandidateEvent;

    const result = await ingestEvents(client, [invalid], { dryRun: false });

    expect(result.skipped[0].reason).toBe("invalid");
  });

  it("dry-run mode does not call insert and reports would-be inserts", async () => {
    const client = fakeClient([]);

    const result = await ingestEvents(client, [validCandidate], { dryRun: true });

    expect(result.inserted).toHaveLength(0);
    expect(result.wouldInsert).toHaveLength(1);
  });
});
