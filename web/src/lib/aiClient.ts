/**
 * Optional AI enhancement client.
 *
 * IMPORTANT — zero-trust boundary: this NEVER sends raw logs, exported JSON, or
 * source-level detail. It sends only an aggregated, non-identifying numeric
 * summary (total GB/day, monthly cost, the cost breakdown by category, and the
 * deterministic recommendation titles) to a same-origin Cloudflare Pages
 * Function, which calls Workers AI server-side and returns prose. The raw paste
 * never leaves the browser.
 */

import type { Recommendation } from "./recommendations.js";

const CONFIGURED_AI_API_BASE = readConfiguredAiApiBase();
const AZURE_OPENAI_LS_KEY = "sentinel_optimizer_aoai";
const AZURE_OPENAI_DEFAULT_API_VERSION = "2024-12-01-preview";

/** The ONLY shape that crosses the network for AI enhancement. */
export interface AggregatedSummary {
  vendor: string;
  summaryStyle?: "executive" | "technical" | "board";
  totalGbPerDay: number;
  sourceCount: number;
  /** Top sources by GB/day — names + share only, no raw values/bytes. */
  topSources: { name: string; sharePct: number }[];
  monthlyCost: number;
  breakdown: Record<string, number>;
  billableAnalyticsGbPerDay: number;
  benefitGbPerDay: number;
  recommendations: { title: string; severity: string; monthlySavings?: number }[];
}

export interface AiResult {
  text: string;
  model?: string;
}

/** Azure OpenAI credentials stored in localStorage — never transmitted to any first-party server. */
export interface AzureOpenAiConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
}

export function getAiSummaryEndpoint(): string {
  return resolveApiEndpoint("recommend");
}

export function getAiExampleEndpoint(): string {
  return resolveApiEndpoint("example");
}

export function buildSummary(args: {
  vendor: string;
  summaryStyle?: "executive" | "technical" | "board";
  totalGbPerDay: number;
  sources: { name: string; gbPerDay?: number }[];
  monthlyCost: number;
  breakdown: Record<string, number>;
  billableAnalyticsGbPerDay: number;
  benefitGbPerDay: number;
  recommendations: Recommendation[];
}): AggregatedSummary {
  const total = args.totalGbPerDay || 1;
  const topSources = [...args.sources]
    .sort((a, b) => (b.gbPerDay ?? 0) - (a.gbPerDay ?? 0))
    .slice(0, 5)
    .map((s) => ({
      name: s.name,
      sharePct: Math.round(((s.gbPerDay ?? 0) / total) * 1000) / 10,
    }));

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
      title: r.title,
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

  let serverUnavailable = false;
  try {
    const res = await fetchWithFallback(endpoints, init, "Your deterministic recommendations above are unaffected.");
    if (res.status === 501 || res.status === 404) {
      serverUnavailable = true;
    } else {
      if (!res.ok) throw new Error(`AI service returned an error (HTTP ${res.status}).`);
      const data = (await res.json()) as Partial<AiResult> & { error?: string };
      if (data.error) throw new Error(data.error);
      if (!data.text) throw new Error("AI service returned an empty response.");
      return { text: data.text, ...(data.model ? { model: data.model } : {}) };
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Could not reach")) {
      serverUnavailable = true;
    } else {
      throw err;
    }
  }

  if (serverUnavailable) {
    const cfg = getAzureOpenAiConfig();
    if (cfg) {
      return callAzureOpenAiChat(
        cfg,
        "You are a precise, vendor-neutral cloud security and cost advisor. Optimize for executive clarity, migration practicality, and measurable outcomes.",
        buildSummaryPrompt(summary),
        { maxTokens: 700, temperature: 0.2 },
        signal,
      );
    }
  }

  throw new Error("AI enhancement isn't enabled for this deployment. The deterministic recommendations above are fully usable.");
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Ask the server to generate a realistic EXAMPLE paste for a vendor, shaped
 * like that vendor's expected export. Sends only app-owned, non-sensitive
 * strings (vendor label, schema hint, canonical template). Throws with a
 * friendly message when AI isn't enabled so the UI can fall back to its
 * built-in static example.
 */
export async function requestAiExample(
  req: { vendor: string; label: string; schemaHint: string; template: string },
  signal?: AbortSignal,
): Promise<string> {
  const endpoints = resolveApiEndpoints("example");
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    ...(signal ? { signal } : {}),
  };

  let serverUnavailable = false;
  try {
    const res = await fetchWithFallback(endpoints, init);
    if (res.status === 501 || res.status === 404) {
      serverUnavailable = true;
    } else {
      if (!res.ok) throw new Error(`AI service returned an error (HTTP ${res.status}).`);
      const data = (await res.json()) as { text?: string; error?: string };
      if (data.error) throw new Error(data.error);
      if (!data.text) throw new Error("AI service returned an empty example.");
      return data.text;
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Could not reach")) {
      serverUnavailable = true;
    } else {
      throw err;
    }
  }

  if (serverUnavailable) {
    const cfg = getAzureOpenAiConfig();
    if (cfg) {
      const result = await callAzureOpenAiChat(
        cfg,
        "You output only valid JSON that matches the requested structure. Never include prose or code fences.",
        buildExamplePrompt(req),
        { maxTokens: 1200, temperature: 0.5 },
        signal,
      );
      // Validate the model returned parseable JSON
      const candidate = extractFirstJson(result.text);
      if (!candidate) throw new Error("Azure OpenAI did not return usable JSON for the example.");
      try {
        return JSON.stringify(JSON.parse(candidate), null, 2);
      } catch {
        throw new Error("Azure OpenAI returned malformed JSON for the example.");
      }
    }
  }

  throw new Error("AI example generation isn't enabled for this deployment.");
}

/**
 * Compute the AI endpoint URL in this order:
 * 1) PUBLIC_AI_API_BASE override (for split-host or local function dev)
 * 2) App base path + /api/* on the current origin
 */
function resolveApiEndpoint(route: "recommend" | "example"): string {
  return resolveApiEndpoints(route)[0] || `/${route}`;
}

function resolveApiEndpoints(route: "recommend" | "example"): string[] {
  const absolutePath = `api/${route}`;
  const rootRelative = `/api/${route}`;

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

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

async function fetchWithFallback(
  endpoints: string[],
  init: RequestInit,
  suffix = "",
): Promise<Response> {
  let lastError: unknown;
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

// ─── Azure OpenAI config (localStorage) ──────────────────────────────────────

export function getAzureOpenAiConfig(): AzureOpenAiConfig | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(AZURE_OPENAI_LS_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as Partial<AzureOpenAiConfig>;
    if (!cfg.endpoint || !cfg.apiKey || !cfg.deployment) return null;
    return {
      endpoint: cfg.endpoint.replace(/\/$/, ""),
      apiKey: cfg.apiKey,
      deployment: cfg.deployment,
      apiVersion: cfg.apiVersion || AZURE_OPENAI_DEFAULT_API_VERSION,
    };
  } catch {
    return null;
  }
}

export function saveAzureOpenAiConfig(cfg: AzureOpenAiConfig): void {
  localStorage.setItem(AZURE_OPENAI_LS_KEY, JSON.stringify(cfg));
}

export function clearAzureOpenAiConfig(): void {
  localStorage.removeItem(AZURE_OPENAI_LS_KEY);
}

// ─── Direct Azure OpenAI call ─────────────────────────────────────────────────

async function callAzureOpenAiChat(
  cfg: AzureOpenAiConfig,
  systemPrompt: string,
  userPrompt: string,
  options: { maxTokens: number; temperature: number },
  signal?: AbortSignal,
): Promise<AiResult> {
  const url = `${cfg.endpoint}/openai/deployments/${encodeURIComponent(cfg.deployment)}/chat/completions?api-version=${encodeURIComponent(cfg.apiVersion)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "api-key": cfg.apiKey },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    }),
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Azure OpenAI returned HTTP ${res.status}.`);
  }
  const data = (await res.json()) as { choices: { message: { content: string } }[]; model?: string };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Azure OpenAI returned an empty response.");
  return { text, model: data.model ?? cfg.deployment };
}

// ─── Prompt builders (mirrored from api/ — runs client-side for direct path) ─

function buildSummaryPrompt(s: AggregatedSummary): string {
  const style = s.summaryStyle ?? "executive";
  const styleInstruction =
    style === "technical"
      ? "Style: technical leadership brief with concrete implementation language, explicit assumptions, and operational dependencies."
      : style === "board"
        ? "Style: board-ready narrative focused on risk, business impact, governance, and decision gates with minimal jargon."
        : "Style: executive summary for CISO/SOC leadership with concise strategic framing and clear next steps.";
  const sources = s.topSources.map((t) => `- ${t.name}: ${t.sharePct}% of ingest`).join("\n");
  const breakdown = Object.entries(s.breakdown)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `- ${k}: $${v.toFixed(2)}/mo`)
    .join("\n");
  const recs = s.recommendations
    .map((r) => `- [${r.severity}] ${r.title}${r.monthlySavings ? ` (~$${r.monthlySavings}/mo)` : ""}`)
    .join("\n");
  const formatInstruction =
    style === "technical"
      ? [
          "Return exactly 6 short sections using these labels and this order:",
          "Assumptions:",
          "Current State:",
          "Target State:",
          "Implementation Plan (30/60/90 days):",
          "Operational Risks + Mitigations:",
          "Validation Metrics:",
          "Use implementation language (DCR, transformations, table plans, retention, commitment tier).",
        ].join("\n")
      : style === "board"
        ? [
            "Return exactly 6 lines total.",
            "Line 1 must begin: [Business Impact]",
            "Line 2 must begin: [Risk Posture]",
            "Line 3 must begin: [Investment Case]",
            "Line 4 must begin: [Execution Confidence]",
            "Line 5 must begin: [Fallback Plan]",
            "Line 6 must begin: Decision Ask:",
            "Each line must be one sentence and <= 24 words.",
            "Keep jargon minimal and emphasize governance, risk, and financial impact.",
          ].join("\n")
        : [
            "Return 1 concise paragraph (170-260 words) for executive leadership.",
            "No section labels, no markdown headers.",
          ].join("\n");
  const flowInstruction =
    style === "board"
      ? [
          "Ensure the 6 lines cover this sequence:",
          "1) business impact now,",
          "2) risk posture if unchanged,",
          "3) phased migration recommendation,",
          "4) top 3 cost actions (highest savings first),",
          "5) fallback parallel-run validation window and success criteria,",
          "6) decision ask with estimate caveat.",
        ].join("\n")
      : [
          "Cover this exact flow:",
          "1) Story + posture: one sentence framing current state and risk/cost pressure.",
          "2) Persona-aware rationale: why a security leader should act now (cost, detection quality, operational control).",
          "3) Migration recommendation: phased approach (pilot high-volume source, validate detections, then expand).",
          "4) Enhancement recommendation: include DCR/workspace transformations, tiering, retention optimization, and commitment tier where relevant.",
          "4a) Cost optimization playbook: include a prioritized list of the top 3 cost actions (highest savings first) with expected impact and operational caution for each.",
          "5) Worst-case fallback: if full migration cannot proceed now, recommend running Microsoft Sentinel in parallel with the current SIEM for a defined validation window, with explicit success criteria and cutover decision point.",
          "6) Close with one sentence that figures are planning estimates and should be validated against actual billing and detection outcomes.",
        ].join("\n");
  return [
    `You are a Microsoft Sentinel migration and cost-optimization advisor.`,
    `Use only the aggregated figures below. Do not invent specific log contents or customer names.`,
    styleInstruction,
    formatInstruction,
    `Write in clear, plain business language with a confident but neutral tone.`,
    ``,
    `SIEM: ${s.vendor}`,
    `Total ingest: ${s.totalGbPerDay} GB/day across ${s.sourceCount} sources`,
    `Billable analytics: ${s.billableAnalyticsGbPerDay} GB/day (benefits cover ${s.benefitGbPerDay} GB/day)`,
    `Estimated monthly cost: $${s.monthlyCost}`,
    ``,
    `Top sources:\n${sources || "- (none)"}`,
    ``,
    `Cost breakdown:\n${breakdown || "- (none)"}`,
    ``,
    `Detected opportunities:\n${recs || "- (none)"}`,
    ``,
    flowInstruction,
  ].join("\n");
}

function buildExamplePrompt(req: { vendor: string; label: string; schemaHint: string; template: string }): string {
  return [
    `You generate sample data for a SIEM cost calculator. Produce ONE realistic EXAMPLE export for "${req.label}".`,
    `It must match the exact JSON structure and field names of the template below — only change the values.`,
    ``,
    `Schema notes: ${req.schemaHint}`,
    ``,
    `Template (copy this structure exactly):`,
    req.template,
    ``,
    `Rules:`,
    `- Output ONLY valid JSON. No prose, no markdown, no code fences.`,
    `- Keep the same keys and nesting as the template.`,
    `- Use 4-6 plausible, well-known log source names for this platform (e.g. firewalls, identity, EDR, cloud audit).`,
    `- Use realistic byte/volume magnitudes (a busy enterprise: hundreds of MB to tens of GB per day per source).`,
    `- Keep "windowDays" at 30 if present.`,
    `- Do not include comments or trailing commas.`,
  ].join("\n");
}

function extractFirstJson(raw: string): string | null {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) s = fence[1].trim();
  const firstObj = s.indexOf("{");
  const firstArr = s.indexOf("[");
  const starts = [firstObj, firstArr].filter((i) => i >= 0);
  if (!starts.length) return null;
  const start = Math.min(...starts);
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  const end = s.lastIndexOf(close);
  if (end <= start) return null;
  return s.slice(start, end + 1);
}
