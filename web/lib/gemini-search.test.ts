import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockCallGenerateContent, mockResolveGroundingUrl } = vi.hoisted(() => ({
  mockCallGenerateContent: vi.fn(),
  mockResolveGroundingUrl: vi.fn(),
}));

vi.mock("./gemini-client", () => ({ callGenerateContent: mockCallGenerateContent }));
vi.mock("./fetch-page", () => ({ resolveGroundingUrl: mockResolveGroundingUrl }));

const { searchGroundingUrls } = await import("./gemini-search");

const env = {
  projectId: "p",
  location: "us-central1",
  model: "gemini-2.5-flash",
  serviceAccountKeyJson: "{}",
};

function chunksResponse(urls: string[]) {
  return {
    candidates: [
      { groundingMetadata: { groundingChunks: urls.map((uri) => ({ web: { uri } })) } },
    ],
  };
}

describe("searchGroundingUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveGroundingUrl.mockImplementation(async (u: string) => u.replace("redirect", "real"));
  });

  it("makes two calls (core query prompt + expansion prompt) and merges/dedupes results", async () => {
    mockCallGenerateContent
      .mockResolvedValueOnce(chunksResponse(["https://redirect/a", "https://redirect/b"]))
      .mockResolvedValueOnce(chunksResponse(["https://redirect/b", "https://redirect/c"]));

    const result = await searchGroundingUrls(env, "バイオハザード");

    expect(mockCallGenerateContent).toHaveBeenCalledTimes(2);
    expect(result).toEqual(["https://real/a", "https://real/b", "https://real/c"]);
  });

  it("includes the literal 'keyword イベント' query in the core-query call", async () => {
    mockCallGenerateContent.mockResolvedValue(chunksResponse([]));

    await searchGroundingUrls(env, "バイオハザード");

    const [, coreBody] = mockCallGenerateContent.mock.calls[0];
    expect(coreBody.contents[0].parts[0].text).toContain("バイオハザード イベント");
    expect(coreBody.tools).toEqual([{ googleSearch: {} }]);
  });

  it("still returns results if one of the two calls fails", async () => {
    mockCallGenerateContent
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(chunksResponse(["https://redirect/x"]));

    const result = await searchGroundingUrls(env, "バイオハザード");

    expect(result).toEqual(["https://real/x"]);
  });

  it("caps the total number of URLs returned", async () => {
    const many = Array.from({ length: 8 }, (_, i) => `https://redirect/${i}`);
    mockCallGenerateContent
      .mockResolvedValueOnce(chunksResponse(many))
      .mockResolvedValueOnce(chunksResponse([]));

    const result = await searchGroundingUrls(env, "バイオハザード");

    expect(result.length).toBeLessThanOrEqual(12);
  });
});
