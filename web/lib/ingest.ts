import type { SupabaseClient } from "@supabase/supabase-js";

export type CandidateEvent = {
  title: string;
  source: string;
  url?: string;
  matched_keyword: string;
  matched_via: "direct" | "expanded";
  confidence: "confirmed" | "exploratory";
  event_date?: string;
  registration_opens_at?: string;
  deadline_at?: string;
};

export type IngestResult = {
  inserted: CandidateEvent[];
  wouldInsert: CandidateEvent[];
  skipped: { candidate: Partial<CandidateEvent>; reason: "duplicate" | "invalid" }[];
};

const VALID_MATCHED_VIA = new Set(["direct", "expanded"]);
const VALID_CONFIDENCE = new Set(["confirmed", "exploratory"]);

function dedupeKey(title: string, source: string): string {
  return `${title.trim().toLowerCase()}|${source.trim().toLowerCase()}`;
}

function isValid(candidate: CandidateEvent): boolean {
  return (
    typeof candidate.title === "string" &&
    candidate.title.trim().length > 0 &&
    typeof candidate.source === "string" &&
    candidate.source.trim().length > 0 &&
    typeof candidate.matched_keyword === "string" &&
    candidate.matched_keyword.trim().length > 0 &&
    VALID_MATCHED_VIA.has(candidate.matched_via) &&
    VALID_CONFIDENCE.has(candidate.confidence)
  );
}

export async function ingestEvents(
  client: SupabaseClient,
  candidates: CandidateEvent[],
  options: { dryRun: boolean }
): Promise<IngestResult> {
  const { data: existingRows, error } = await client.from("events").select("title, source");

  if (error) {
    throw new Error(error.message);
  }

  const seen = new Set(
    ((existingRows ?? []) as { title: string; source: string }[]).map((row) =>
      dedupeKey(row.title, row.source)
    )
  );

  const result: IngestResult = { inserted: [], wouldInsert: [], skipped: [] };

  for (const candidate of candidates) {
    if (!isValid(candidate)) {
      result.skipped.push({ candidate, reason: "invalid" });
      continue;
    }

    const key = dedupeKey(candidate.title, candidate.source);

    if (seen.has(key)) {
      result.skipped.push({ candidate, reason: "duplicate" });
      continue;
    }

    seen.add(key);

    if (options.dryRun) {
      result.wouldInsert.push(candidate);
      continue;
    }

    const { data, error: insertError } = await client
      .from("events")
      .insert(candidate)
      .select("id, title, source, matched_keyword, matched_via, confidence")
      .single();

    if (insertError) {
      result.skipped.push({ candidate, reason: "invalid" });
      continue;
    }

    result.inserted.push(data as CandidateEvent);
  }

  return result;
}
