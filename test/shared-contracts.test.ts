/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { describe, expect, it } from "vitest";
import {
  apiResponseHeaders,
  isAggregatedSummary,
  isAiTextResponse,
  isApiErrorResponse,
  isExampleRequest,
  isFiniteNumber,
  isRecord,
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
  it("builds consistent API and CORS headers", () => {
    expect(apiResponseHeaders()).toMatchObject({
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    });
    expect(apiResponseHeaders("https://example.test")).toMatchObject({
      "access-control-allow-origin": "https://example.test",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      vary: "Origin",
    });
  });

  it("identifies records and finite numbers", () => {
    expect(isRecord({ value: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isFiniteNumber(1)).toBe(true);
    expect(isFiniteNumber(Number.NaN)).toBe(false);
  });

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
