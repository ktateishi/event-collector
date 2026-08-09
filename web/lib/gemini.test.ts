import { describe, expect, it, vi, afterEach } from "vitest";

const { mockGetClient } = vi.hoisted(() => ({
  mockGetClient: vi.fn().mockResolvedValue({
    getAccessToken: vi.fn().mockResolvedValue({ token: "fake-access-token" }),
  }),
}));

vi.mock("google-auth-library", () => ({
  GoogleAuth: vi.fn().mockImplementation(function GoogleAuthMock() {
    return { getClient: mockGetClient };
  }),
}));

const { collectEventsForKeyword } = await import("./gemini");

const env = {
  projectId: "test-project",
  location: "us-central1",
  model: "gemini-3-flash",
  serviceAccountKeyJson: JSON.stringify({ client_email: "x@y.iam.gserviceaccount.com" }),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function fakeGeminiResponse(eventsJsonText: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: eventsJsonText }] } }],
    }),
  };
}

describe("collectEventsForKeyword", () => {
  it("authenticates, calls Vertex AI with the search grounding tool, and returns parsed candidates", async () => {
    const responseText = JSON.stringify({
      events: [
        {
          title: "鬼滅の刃 ライブイベント",
          source: "kimetsu.com",
          url: "https://kimetsu.com/1",
          matched_via: "direct",
          matched_term: "鬼滅の刃",
          event_date: "2026-09-15",
          registration_opens_at: null,
          deadline_at: null,
        },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue(fakeGeminiResponse(responseText));
    vi.stubGlobal("fetch", fetchMock);

    const result = await collectEventsForKeyword(env, "鬼滅の刃");

    expect(result).toHaveLength(1);
    expect(result[0].matched_keyword).toBe("鬼滅の刃");

    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain("test-project");
    expect(calledUrl).toContain("gemini-3-flash");
    expect(calledInit.headers.Authorization).toBe("Bearer fake-access-token");

    const requestBody = JSON.parse(calledInit.body);
    expect(requestBody.tools).toEqual([{ googleSearch: {} }]);
    expect(requestBody.contents[0].parts[0].text).toContain("鬼滅の刃");
  });

  it("throws a friendly error when Vertex AI responds with an error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) })
    );

    await expect(collectEventsForKeyword(env, "鬼滅の刃")).rejects.toThrow(
      "Vertex AI呼び出しに失敗しました (status 403)"
    );
  });

  it("returns an empty array when the response has no usable text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ candidates: [] }) })
    );

    expect(await collectEventsForKeyword(env, "鬼滅の刃")).toEqual([]);
  });
});
