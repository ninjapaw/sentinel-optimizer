/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

/**
 * Sends only aggregated analysis or app-owned templates to the configured API.
 * Raw logs and exported JSON never cross this boundary.
 */

import type { Recommendation } from "./recommendations.js";
import {
  ensureTrailingSlash,
  INTERNAL_CONFIG,
  isAiTextResponse,
  isApiErrorResponse,
  rankSourcesWithoutNames,
  redactSourceNames,
  roundTo,
  type AggregatedSummary as SharedAggregatedSummary,
  type AiTextResponse,
  type ExampleRequest,
  type ExplainKqlRequest,
  type SummaryStyle,
} from "@shared/index.js";

const CONFIGURED_AI_API_BASE = readConfiguredAiApiBase();

export type AggregatedSummary = SharedAggregatedSummary;
export type AiResult = AiTextResponse;

export function getAiSummaryEndpoint(): string {
  return resolveApiEndpoint("recommend");
}

export function getAiExampleEndpoint(): string {
  return resolveApiEndpoint("example");
}

export function buildSummary(args: {
  vendor: string;
  summaryStyle?: SummaryStyle;
  totalGbPerDay: number;
  sources: { name: string; gbPerDay?: number }[];
  monthlyCost: number;
  breakdown: Record<string, number>;
  billableAnalyticsGbPerDay: number;
  benefitGbPerDay: number;
  recommendations: Recommendation[];
}): AggregatedSummary {
  const topSources = rankSourcesWithoutNames(args.sources, args.totalGbPerDay);

  return {
    vendor: args.vendor,
    summaryStyle: args.summaryStyle ?? "executive",
    totalGbPerDay: round(args.totalGbPerDay),
    sourceCount: args.sources.length,
    topSources,
    monthlyCost: round(args.monthlyCost),
    breakdown: args.breakdown,
    billableAnalyticsGbPerDay: round(args.billableAnalyticsGbPerDay),
    benefitGbPerDay: round(args.benefitGbPerDay),
    recommendations: args.recommendations.map((r) => ({
      title: redactSourceNames(r.title, args.sources),
      severity: r.severity,
      ...(r.monthlySavings !== undefined ? { monthlySavings: r.monthlySavings } : {}),
    })),
  };
}

/**
 * Request an AI-written executive summary. Resolves with prose, or throws with
 * a friendly message the UI can surface (e.g. when AI isn't configured for the
 * deployment, in which case the deterministic recommendations still stand).
 */
export async function requestAiSummary(summary: AggregatedSummary, signal?: AbortSignal): Promise<AiResult> {
  const endpoints = resolveApiEndpoints("recommend");
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(summary),
    ...(signal ? { signal } : {}),
  };

  const res = await fetchWithFallback(
    endpoints,
    init,
    "Your deterministic recommendations above are unaffected.",
  );
  if (res.status === 501 || res.status === 404) {
    throw new Error("AI enhancement isn't enabled for this deployment. The deterministic recommendations above are fully usable.");
  }
  if (!res.ok) throw new Error(`AI service returned an error (HTTP ${res.status}).`);
  const data: unknown = await res.json();
  if (isApiErrorResponse(data)) throw new Error(data.error);
  if (!isAiTextResponse(data)) {
    throw new Error("AI service returned an empty response.");
  }
  return data;
}

function round(n: number): number {
  return roundTo(n, 2);
}

/**
 * Ask the server to generate a realistic EXAMPLE paste for a vendor, shaped
 * like that vendor's expected export. Sends only app-owned, non-sensitive
 * strings (vendor label, schema hint, canonical template). Throws with a
 * friendly message when AI isn't enabled so the UI can fall back to its
 * built-in static example.
 */
export async function requestAiExample(
  req: ExampleRequest,
  signal?: AbortSignal,
): Promise<string> {
  const endpoints = resolveApiEndpoints("example");
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    ...(signal ? { signal } : {}),
  };

  const res = await fetchWithFallback(endpoints, init);
  if (res.status === 501 || res.status === 404) {
    throw new Error("AI example generation isn't enabled for this deployment.");
  }
  if (!res.ok) throw new Error(`AI service returned an error (HTTP ${res.status}).`);
  const data: unknown = await res.json();
  if (isApiErrorResponse(data)) throw new Error(data.error);
  if (!isAiTextResponse(data)) {
    throw new Error("AI service returned an empty example.");
  }
  return data.text;
}

/**
 * Ask the server to explain a single pasted KQL result row in plain language.
 * Sends only the query id and the pasted text (never parsed/executed) —
 * throws with a friendly message when AI isn't enabled so the UI can fall
 * back to the deterministic, per-column explanation instead.
 */
export async function requestAiExplanation(
  req: ExplainKqlRequest,
  signal?: AbortSignal,
): Promise<string> {
  const endpoints = resolveApiEndpoints("explainKql");
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    ...(signal ? { signal } : {}),
  };

  const res = await fetchWithFallback(endpoints, init);
  if (res.status === 501 || res.status === 404) {
    throw new Error("AI explanation isn't enabled for this deployment. Use the plain-language column guide above instead.");
  }
  if (!res.ok) throw new Error(`AI service returned an error (HTTP ${res.status}).`);
  const data: unknown = await res.json();
  if (isApiErrorResponse(data)) throw new Error(data.error);
  if (!isAiTextResponse(data)) {
    throw new Error("AI service returned an empty explanation.");
  }
  return data.text;
}

/**
 * Compute the AI endpoint URL in this order:
 * 1) PUBLIC_AI_API_BASE override (for split-host or local function dev)
 * 2) App base path + /api/* on the current origin
 */
function resolveApiEndpoint(route: "recommend" | "example" | "explainKql"): string {
  return resolveApiEndpoints(route)[0] || INTERNAL_CONFIG.api.routes[route];
}

function resolveApiEndpoints(route: "recommend" | "example" | "explainKql"): string[] {
  const rootRelative = INTERNAL_CONFIG.api.routes[route];
  const absolutePath = rootRelative.replace(/^\/+/, "");

  const resolved = new Set<string>();

  if (CONFIGURED_AI_API_BASE) {
    resolved.add(new URL(absolutePath, ensureTrailingSlash(CONFIGURED_AI_API_BASE)).toString());
  }

  if (typeof window !== "undefined") {
    const baseUrl = readBaseUrl();
    resolved.add(new URL(absolutePath, new URL(baseUrl, window.location.origin)).toString());
    resolved.add(new URL(rootRelative, window.location.origin).toString());
    resolved.add(rootRelative);
    return [...resolved];
  }

  resolved.add(rootRelative);
  return [...resolved];
}

function readConfiguredAiApiBase(): string | null {
  const raw = (import.meta.env.PUBLIC_AI_API_BASE ?? "").trim();
  return raw ? raw : null;
}

function readBaseUrl(): string {
  const raw = (import.meta.env.BASE_URL ?? "/").trim();
  return ensureTrailingSlash(raw || "/");
}

async function fetchWithFallback(
  endpoints: string[],
  init: RequestInit,
  suffix = "",
): Promise<Response> {  let lastError: unknown;
  for (const endpoint of endpoints) {
    try {
      return await fetch(endpoint, init);
    } catch (err) {
      lastError = err;
    }
  }

  const detail =
    lastError instanceof Error && lastError.message
      ? ` ${lastError.name}: ${lastError.message}`
      : "";
  const tail = suffix ? ` ${suffix}` : "";
  throw new Error(`Could not reach the AI service at ${endpoints.join(" or ")}.${detail}${tail}`);
}
