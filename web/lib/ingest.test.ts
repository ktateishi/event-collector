import { describe, expect, it, vi } from "vitest";
import { ingestEvents, type CandidateEvent } from "./ingest";
import type { SupabaseClient } from "@supabase/supabase-js";

type ExistingRow = {
  id: string;
  title: string;
  occurrences?: { label: string; event_date?: string; url?: string }[];
  category?: string;
  summary?: string;
  image_url?: string;
  excluded_at?: string;
  excluded_reason?: string;
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

  it("backfills category/summary/image_url on an existing event that lacks them, even with no new occurrences", async () => {
    const { client, updateCalls } = fakeClient([
      {
        id: "existing-id",
        title: "鬼滅の刃 ライブイベント",
        occurrences: [{ label: "東京会場", event_date: "2026-09-15" }],
      },
    ]);

    const withMetadata: CandidateEvent = {
      ...validCandidate,
      category: "concert",
      summary: "大盛況のライブイベント",
      image_url: "https://kimetsu.com/og.jpg",
    };

    const result = await ingestEvents(client, [withMetadata], { dryRun: false });

    expect(result.merged).toHaveLength(1);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].payload.category).toBe("concert");
    expect(updateCalls[0].payload.summary).toBe("大盛況のライブイベント");
    expect(updateCalls[0].payload.image_url).toBe("https://kimetsu.com/og.jpg");
  });

  it("does not overwrite an existing category/summary/image_url with new candidate values", async () => {
    const { client, updateCalls } = fakeClient([
      {
        id: "existing-id",
        title: "鬼滅の刃 ライブイベント",
        occurrences: [{ label: "東京会場", event_date: "2026-09-15" }],
        category: "movie",
        summary: "既存の要約",
        image_url: "https://kimetsu.com/existing.jpg",
      },
    ]);

    const withNewVenueAndMetadata: CandidateEvent = {
      ...validCandidate,
      occurrences: [
        { label: "東京会場", event_date: "2026-09-15" },
        { label: "大阪会場", event_date: "2026-10-01" },
      ],
      category: "concert",
      summary: "新しい要約",
      image_url: "https://kimetsu.com/new.jpg",
    };

    await ingestEvents(client, [withNewVenueAndMetadata], { dryRun: false });

    expect(updateCalls[0].payload.category).toBe("movie");
    expect(updateCalls[0].payload.summary).toBe("既存の要約");
    expect(updateCalls[0].payload.image_url).toBe("https://kimetsu.com/existing.jpg");
  });

  it("auto-excludes a newly inserted event whose category is collab", async () => {
    const { client, insertCalls } = fakeClient([]);

    const collabCandidate: CandidateEvent = { ...validCandidate, category: "collab" };

    await ingestEvents(client, [collabCandidate], { dryRun: false });

    expect(insertCalls[0].excluded_reason).toBe("category");
    expect(insertCalls[0].excluded_at).toBeTruthy();
  });

  it("does not exclude a newly inserted event whose category is not collab", async () => {
    const { client, insertCalls } = fakeClient([]);

    const movieCandidate: CandidateEvent = { ...validCandidate, category: "movie" };

    await ingestEvents(client, [movieCandidate], { dryRun: false });

    expect(insertCalls[0].excluded_at).toBeUndefined();
    expect(insertCalls[0].excluded_reason).toBeUndefined();
  });

  it("auto-excludes an existing event when its category is backfilled to collab", async () => {
    const { client, updateCalls } = fakeClient([
      {
        id: "existing-id",
        title: "鬼滅の刃 ライブイベント",
        occurrences: [{ label: "東京会場", event_date: "2026-09-15" }],
      },
    ]);

    const collabCandidate: CandidateEvent = { ...validCandidate, category: "collab" };

    await ingestEvents(client, [collabCandidate], { dryRun: false });

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].payload.excluded_reason).toBe("category");
    expect(updateCalls[0].payload.excluded_at).toBeTruthy();
  });

  it("never un-excludes an already-excluded event, even if its category is not collab", async () => {
    const { client, updateCalls } = fakeClient([
      {
        id: "existing-id",
        title: "鬼滅の刃 ライブイベント",
        occurrences: [{ label: "東京会場", event_date: "2026-09-15" }],
        category: "movie",
        excluded_at: "2026-08-01T00:00:00Z",
        excluded_reason: "manual",
      },
    ]);

    const withNewVenue: CandidateEvent = {
      ...validCandidate,
      occurrences: [
        { label: "東京会場", event_date: "2026-09-15" },
        { label: "大阪会場", event_date: "2026-10-01" },
      ],
    };

    await ingestEvents(client, [withNewVenue], { dryRun: false });

    expect(updateCalls[0].payload.excluded_at).toBe("2026-08-01T00:00:00Z");
    expect(updateCalls[0].payload.excluded_reason).toBe("manual");
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

  it("rejects a candidate whose occurrences are already fully over (does not re-add deleted stale events)", async () => {
    const { client, insertCalls } = fakeClient([]);
    const alreadyOver: CandidateEvent = {
      ...validCandidate,
      occurrences: [
        { label: "東京会場", event_date: "2026-01-01", event_end_date: "2026-01-31" },
      ],
    };

    const result = await ingestEvents(client, [alreadyOver], {
      dryRun: false,
      today: "2026-08-10",
    });

    expect(insertCalls).toHaveLength(0);
    expect(result.skipped[0].reason).toBe("already_over");
  });

  it("treats titles that differ only in decorative brackets as duplicates", async () => {
    const { client, insertCalls } = fakeClient([
      { id: "existing-id", title: "ホラー・メイズ「バイオハザード レクイエム」ザ・ダイブ", occurrences: [] },
    ]);

    const reworded: CandidateEvent = {
      ...validCandidate,
      title: "ホラー・メイズ「『バイオハザード レクイエム』ザ・ダイブ」",
    };

    const result = await ingestEvents(client, [reworded], { dryRun: false });

    expect(insertCalls).toHaveLength(0);
    // occurrencesが増えるのでmergeされるが、新規insertはされない
    expect(result.inserted).toHaveLength(0);
  });
});
