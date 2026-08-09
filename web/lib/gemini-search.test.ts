import { describe, expect, it, vi } from "vitest";

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

describe("searchGroundingUrls", () => {
  it("resolves groundingChunks redirect URLs to real URLs, deduped", async () => {
    mockCallGenerateContent.mockResolvedValue({
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: "https://redirect/a", title: "a.example" } },
              { web: { uri: "https://redirect/b", title: "b.example" } },
              { web: { uri: "https://redirect/a-dup", title: "a.example again" } },
            ],
          },
        },
      ],
    });
    mockResolveGroundingUrl.mockImplementation(async (u: string) => {
      if (u === "https://redirect/a" || u === "https://redirect/a-dup") {
        return "https://real-a.example/page";
      }
      return "https://real-b.example/page";
    });

    const result = await searchGroundingUrls(env, "鬼滅の刃");

    expect(result).toEqual(["https://real-a.example/page", "https://real-b.example/page"]);
  });

  it("calls Vertex AI with the googleSearch tool enabled", async () => {
    mockCallGenerateContent.mockResolvedValue({ candidates: [{}] });

    await searchGroundingUrls(env, "鬼滅の刃");

    const [, body] = mockCallGenerateContent.mock.calls.at(-1)!;
    expect(body.tools).toEqual([{ googleSearch: {} }]);
    expect(body.contents[0].parts[0].text).toContain("鬼滅の刃");
  });

  it("returns an empty array when there is no grounding metadata", async () => {
    mockCallGenerateContent.mockResolvedValue({ candidates: [{}] });

    expect(await searchGroundingUrls(env, "鬼滅の刃")).toEqual([]);
  });

  it("caps the number of URLs returned", async () => {
    const chunks = Array.from({ length: 10 }, (_, i) => ({
      web: { uri: `https://redirect/${i}` },
    }));
    mockCallGenerateContent.mockResolvedValue({
      candidates: [{ groundingMetadata: { groundingChunks: chunks } }],
    });
    mockResolveGroundingUrl.mockImplementation(async (u: string) => u.replace("redirect", "real"));

    const result = await searchGroundingUrls(env, "鬼滅の刃");

    expect(result.length).toBeLessThanOrEqual(6);
  });
});
