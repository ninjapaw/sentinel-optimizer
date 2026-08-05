import { describe, expect, it } from "vitest";
import {
  isAggregatedSummary,
  isAiTextResponse,
  isApiErrorResponse,
  isExampleRequest,
  roundTo,
  utf8ByteLength,
  USER_CONFIG,
} from "../shared/index.js";

const validSummary = {
  vendor: "Example",
  summaryStyle: "executive",
  totalGbPerDay: 10,
  sourceCount: 1,
  topSources: [{ name: "Source 1", sharePct: 100 }],
  monthlyCost: 1000,
  breakdown: { analytics: 1000 },
  billableAnalyticsGbPerDay: 10,
  benefitGbPerDay: 0,
  recommendations: [{ title: "Tune collection", severity: "med" }],
};

describe("shared AI contracts", () => {
  it("accepts bounded aggregate summaries", () => {
    expect(isAggregatedSummary(validSummary)).toBe(true);
  });

  it("rejects invalid styles and non-finite nested values", () => {
    expect(isAggregatedSummary({ ...validSummary, summaryStyle: "raw" })).toBe(false);
    expect(
      isAggregatedSummary({
        ...validSummary,
        topSources: [{ name: "Source 1", sharePct: Number.NaN }],
      }),
    ).toBe(false);
  });

  it("enforces the configured example template limit", () => {
    const request = {
      vendor: "generic",
      label: "Generic",
      schemaHint: "sources array",
      template: "x".repeat(USER_CONFIG.api.example.maxTemplateCharacters),
    };
    expect(isExampleRequest(request)).toBe(true);
    expect(isExampleRequest({ ...request, template: `${request.template}x` })).toBe(false);
  });

  it("distinguishes successful and error responses", () => {
    expect(isAiTextResponse({ text: "Summary", model: "test" })).toBe(true);
    expect(isAiTextResponse({ text: "" })).toBe(false);
    expect(isApiErrorResponse({ error: "Unavailable" })).toBe(true);
    expect(isApiErrorResponse({ message: "Unavailable" })).toBe(false);
  });
});

describe("shared utilities", () => {
  it("counts UTF-8 bytes rather than UTF-16 code units", () => {
    expect(utf8ByteLength("abc")).toBe(3);
    expect(utf8ByteLength("é")).toBe(2);
    expect(utf8ByteLength("😀")).toBe(4);
  });

  it("rounds to the requested decimal places", () => {
    expect(roundTo(12.345, 2)).toBe(12.35);
    expect(roundTo(12.345, 1)).toBe(12.3);
  });
});
