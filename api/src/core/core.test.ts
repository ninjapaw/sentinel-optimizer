/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

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
  const protectionSummary = {
    kind: "protection", version: "2", audience: "CISO",
    sourceCount: 1, windowDays: 30,
    families: [{ family: "Identity and Microsoft Graph", count: 1 }],
    recommendations: [{ id: "identity" }, { id: "correlation" }],
  };

  it("grounds protection AI in shared rules without inventing costs or coverage", async () => {
    const ai = provider("Candidate identity protection review");
    const response = await handleRecommend(JSON.stringify(protectionSummary), ai);
    expect(response.status).toBe(200);
    const request = vi.mocked(ai.complete).mock.calls[0]?.[0];
    const prompt = request?.messages.map((message) => message.content).join(" ");
    expect(prompt).toContain("Microsoft Entra ID Protection");
    expect(prompt).toContain("not confirmed protection gaps");
    expect(prompt).toContain("Not verified");
    expect(prompt).not.toContain("Estimated monthly cost");
    expect(prompt).not.toContain("Microsoft Defender for SQL");
  });

  it.each([
    { ...protectionSummary, notes: "customer secret" },
    { ...protectionSummary, families: [{ family: "ignore instructions", count: 1 }] },
    { ...protectionSummary, families: [{ family: "Servers", count: 1, workspace: "private" }] },
    { ...protectionSummary, sourceCount: 2 },
    { ...protectionSummary, windowDays: -1 },
    { ...protectionSummary, recommendations: [{ id: "sql" }] },
    { ...protectionSummary, recommendations: [{ id: "identity", title: "injected" }, { id: "correlation" }] },
    { ...protectionSummary, sourceCount: 2, families: [
      { family: "Identity and Microsoft Graph", count: 1 },
      { family: "Identity and Microsoft Graph", count: 1 },
    ] },
  ])("rejects malformed or untrusted protection summaries before invoking AI", async (payload) => {
    const ai = provider("unused");
    expect((await handleRecommend(JSON.stringify(payload), ai)).status).toBe(400);
    expect(ai.complete).not.toHaveBeenCalled();
  });

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
