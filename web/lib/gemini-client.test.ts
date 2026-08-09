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

const { callGenerateContent } = await import("./gemini-client");

const env = {
  projectId: "test-project",
  location: "us-central1",
  model: "gemini-2.5-flash",
  serviceAccountKeyJson: JSON.stringify({ client_email: "x@y.iam.gserviceaccount.com" }),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("callGenerateContent", () => {
  it("authenticates and posts the given body to the Vertex AI endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callGenerateContent(env, { contents: [] });

    expect(result.candidates[0].content.parts[0].text).toBe("ok");
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toContain("test-project");
    expect(calledUrl).toContain("gemini-2.5-flash");
    expect(calledInit.headers.Authorization).toBe("Bearer fake-access-token");
    expect(JSON.parse(calledInit.body)).toEqual({ contents: [] });
  });

  it("throws a friendly error on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403 })
    );

    await expect(callGenerateContent(env, { contents: [] })).rejects.toThrow(
      "Vertex AI呼び出しに失敗しました (status 403)"
    );
  });
});
