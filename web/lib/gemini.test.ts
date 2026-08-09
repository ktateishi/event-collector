import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSearchGroundingUrls, mockFetchPageText, mockExtractEventsFromPages } = vi.hoisted(
  () => ({
    mockSearchGroundingUrls: vi.fn(),
    mockFetchPageText: vi.fn(),
    mockExtractEventsFromPages: vi.fn(),
  })
);

vi.mock("./gemini-search", () => ({ searchGroundingUrls: mockSearchGroundingUrls }));
vi.mock("./fetch-page", () => ({ fetchPageText: mockFetchPageText }));
vi.mock("./gemini-extract", () => ({ extractEventsFromPages: mockExtractEventsFromPages }));

const { collectEventsForKeyword } = await import("./gemini");

const env = {
  projectId: "p",
  location: "us-central1",
  model: "gemini-2.5-flash",
  serviceAccountKeyJson: "{}",
};

describe("collectEventsForKeyword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wires search -> fetch -> extract in order, skipping failed fetches", async () => {
    mockSearchGroundingUrls.mockResolvedValue(["https://a.example", "https://b.example"]);
    mockFetchPageText.mockImplementation(async (url: string) =>
      url === "https://a.example" ? { url, text: "本文A" } : null
    );
    mockExtractEventsFromPages.mockResolvedValue([{ title: "event" }]);

    const result = await collectEventsForKeyword(env, "鬼滅の刃");

    expect(mockSearchGroundingUrls).toHaveBeenCalledWith(env, "鬼滅の刃");
    expect(mockExtractEventsFromPages).toHaveBeenCalledWith(env, "鬼滅の刃", [
      { url: "https://a.example", text: "本文A" },
    ]);
    expect(result).toEqual([{ title: "event" }]);
  });

  it("returns an empty array without fetching/extracting when no URLs are found", async () => {
    mockSearchGroundingUrls.mockResolvedValue([]);

    const result = await collectEventsForKeyword(env, "鬼滅の刃");

    expect(result).toEqual([]);
    expect(mockFetchPageText).not.toHaveBeenCalled();
    expect(mockExtractEventsFromPages).not.toHaveBeenCalled();
  });
});
