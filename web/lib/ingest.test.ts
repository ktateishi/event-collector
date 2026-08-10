import { describe, expect, it, vi } from "vitest";
import { ingestEvents, type CandidateEvent } from "./ingest";
import type { SupabaseClient } from "@supabase/supabase-js";

type ExistingRow = {
  id: string;
  title: string;
  occurrences?: { label: string; event_date?: string; url?: string }[];
};

function fakeClient(existingRows: ExistingRow[]) {
  const updateCalls: { id: string; payload: Record<string, unknown> }[] = [];
  const insertCalls: Record<string, unknown>[] = [];

  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockResolvedValue({ data: existingRows, error: null }),
    insert: vi.fn().mockImplementation((row) => {
      insertCalls.push(row as Record<string, unknown>);
      return {
        select: vi.fn().mockReturnValue({
          single: vi
            .fn()
            .mockResolvedValue({ data: { id: "generated-id", ...(row as object) }, error: null }),
        }),
      };
    }),
    update: vi.fn().mockImplementation((payload) => ({
      eq: vi.fn().mockImplementation((_col: string, id: string) => {
        updateCalls.push({ id, payload: payload as Record<string, unknown> });
        return Promise.resolve({ error: null });
      }),
    })),
  });

  return { client: { from } as unknown as SupabaseClient, updateCalls, insertCalls };
}

const validCandidate: CandidateEvent = {
  title: "鬼滅の刃 ライブイベント",
  source: "kimetsu.com",
  url: "https://kimetsu.com/1",
  matched_keyword: "鬼滅の刃",
  source_keyword: "鬼滅の刃",
  matched_via: "direct",
  confidence: "confirmed",
  event_date: "2026-09-15",
  occurrences: [{ label: "東京会場", event_date: "2026-09-15" }],
};

describe("ingestEvents", () => {
  it("inserts new events not present in the DB, carrying source_keyword and occurrences", async () => {
    const { client, insertCalls } = fakeClient([]);

    const result = await ingestEvents(client, [validCandidate], { dryRun: false });

    expect(result.inserted).toHaveLength(1);
    expect(insertCalls[0].source_keyword).toBe("鬼滅の刃");
    expect(insertCalls[0].occurrences).toEqual([{ label: "東京会場", event_date: "2026-09-15" }]);
  });

  it("merges occurrences into an existing event instead of skipping it", async () => {
    const { client, updateCalls, insertCalls } = fakeClient([
      {
        id: "existing-id",
        title: "鬼滅の刃 ライブイベント",
        occurrences: [{ label: "東京会場", event_date: "2026-09-15" }],
      },
    ]);

    const withNewVenue: CandidateEvent = {
      ...validCandidate,
      occurrences: [
        { label: "東京会場", event_date: "2026-09-15" },
        { label: "大阪会場", event_date: "2026-10-01" },
      ],
    };

    const result = await ingestEvents(client, [withNewVenue], { dryRun: false });

    expect(insertCalls).toHaveLength(0);
    expect(result.merged).toHaveLength(1);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].id).toBe("existing-id");
    expect(updateCalls[0].payload.occurrences).toEqual([
      { label: "東京会場", event_date: "2026-09-15" },
      { label: "大阪会場", event_date: "2026-10-01" },
    ]);
  });

  it("does not update when the incoming occurrences add nothing new", async () => {
    const { client, updateCalls } = fakeClient([
      {
        id: "existing-id",
        title: "鬼滅の刃 ライブイベント",
        occurrences: [{ label: "東京会場", event_date: "2026-09-15" }],
      },
    ]);

    const result = await ingestEvents(client, [validCandidate], { dryRun: false });

    expect(updateCalls).toHaveLength(0);
    expect(result.skipped[0].reason).toBe("duplicate");
  });

  it("skips duplicates within the same batch too", async () => {
    const { client, insertCalls } = fakeClient([]);

    await ingestEvents(client, [validCandidate, { ...validCandidate }], { dryRun: false });

    expect(insertCalls).toHaveLength(1);
  });

  it("rejects candidates missing required fields without inserting", async () => {
    const { client } = fakeClient([]);
    const invalid = { ...validCandidate, title: "" };

    const result = await ingestEvents(client, [invalid], { dryRun: false });

    expect(result.inserted).toHaveLength(0);
    expect(result.skipped[0].reason).toBe("invalid");
  });

  it("rejects an unknown matched_via/confidence value", async () => {
    const { client } = fakeClient([]);
    const invalid = { ...validCandidate, confidence: "maybe" } as unknown as CandidateEvent;

    const result = await ingestEvents(client, [invalid], { dryRun: false });

    expect(result.skipped[0].reason).toBe("invalid");
  });

  it("dry-run mode does not write and reports would-be inserts", async () => {
    const { client, insertCalls, updateCalls } = fakeClient([]);

    const result = await ingestEvents(client, [validCandidate], { dryRun: true });

    expect(result.inserted).toHaveLength(0);
    expect(result.wouldInsert).toHaveLength(1);
    expect(insertCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(0);
  });
});
