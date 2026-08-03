import { describe, expect, it, vi } from "vitest";
import type { AiProvider } from "./contracts.js";
import { handleExample } from "./example.js";
import { handleRecommend } from "./recommend.js";
import { routeApiRequest } from "./router.js";

const summary = JSON.stringify({
  vendor: "Example",
  totalGbPerDay: 10,
  sourceCount: 1,
  topSources: [{ name: "Firewall", sharePct: 100 }],
  monthlyCost: 1000,
  breakdown: { analytics: 1000 },
  billableAnalyticsGbPerDay: 10,
  benefitGbPerDay: 0,
  recommendations: [],
});

function provider(text: string): AiProvider {
  return {
    complete: vi.fn().mockResolvedValue({ text, model: "test-model" }),
  };
}

describe("portable API core", () => {
  it("reports liveness without disclosing provider configuration", async () => {
    expect(await routeApiRequest("GET", "/api/health", "", provider("unused"))).toEqual({
      status: 200,
      body: { status: "ok" },
    });
  });

  it("returns 501 when no provider is configured", async () => {
    expect(await handleRecommend(summary)).toEqual({
      status: 501,
      body: { error: "AI enhancement is not enabled for this deployment." },
    });
  });

  it("validates request JSON before invoking the provider", async () => {
    const ai = provider("unused");
    expect((await handleRecommend("{}", ai)).status).toBe(400);
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it("returns a provider completion for a valid summary", async () => {
    const ai = provider("Executive summary");
    expect(await handleRecommend(summary, ai)).toEqual({
      status: 200,
      body: { text: "Executive summary", model: "test-model" },
    });
    expect(ai.complete).toHaveBeenCalledOnce();
  });

  it("normalizes a JSON example returned in a code fence", async () => {
    const ai = provider('```json\n{"sources":[{"name":"Firewall"}]}\n```');
    const response = await handleExample(
      JSON.stringify({
        vendor: "generic",
        label: "Generic",
        schemaHint: "sources array",
        template: '{"sources":[]}',
      }),
      ai,
    );

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body.text as string)).toEqual({
      sources: [{ name: "Firewall" }],
    });
  });

  it("rejects malformed model JSON", async () => {
    const response = await handleExample(
      JSON.stringify({
        vendor: "generic",
        label: "Generic",
        schemaHint: "sources array",
        template: '{"sources":[]}',
      }),
      provider("not json"),
    );

    expect(response.status).toBe(502);
  });
});
