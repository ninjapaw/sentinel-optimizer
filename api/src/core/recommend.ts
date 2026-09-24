/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { AiProvider, ApiResult } from "./contracts.js";
import { readJson, result } from "./http.js";
import {
  isAggregatedSummary,
  isProtectionSummary,
  INTERNAL_CONFIG,
  type AggregatedSummary,
  type ProtectionSummary,
} from "../../../shared/index.js";
import { findProtectionOpportunities } from "../../../shared/config/protection.config.js";

export const RECOMMEND_MAX_BODY_BYTES = INTERNAL_CONFIG.api.recommend.maxBodyBytes;

function buildProtectionPrompt(summary: ProtectionSummary): string {
  const opportunities = findProtectionOpportunities(summary.families);
  return [
    `Write a concise protection improvement brief for a ${summary.audience}. Use plain text, at most 250 words.`,
    "Use only the supplied source-family counts and app-owned guidance. Source counts are telemetry rows, not protected assets or security risk scores.",
    "Select up to three relevant opportunities in the supplied review order. For each, explain the observed evidence, potential benefit, and next validation step. End with the information still needed.",
    "These are candidate opportunities, not confirmed protection gaps. Current coverage is Not verified for every solution. Never infer that a plan is enabled or disabled, that an attack occurred, or that a license is owned. Do not invent inventory, alerts, risk scores, prices, savings, or coverage percentages.",
    "Evaluate existing protections and licensing before recommending expansion. Do not recommend enabling paid plans, enforcing access policies, deleting logs, changing tiers, or automating responses without scope validation, testing, and approval. Preserve existing detection dependencies.",
    "Do not introduce solutions or URLs outside the supplied guidance. If no opportunities match, ask for a recognizable source inventory instead of inventing recommendations.",
    `Analysis window: ${summary.windowDays} days; source rows: ${summary.sourceCount}.`,
    `Observed source families: ${JSON.stringify(summary.families)}`,
    `App-owned guidance: ${JSON.stringify(opportunities.map((opportunity) => ({
      solution: opportunity.solution,
      evidenceFamilies: opportunity.evidenceFamilies,
      sourceCount: opportunity.sourceCount,
      benefit: opportunity.benefit,
      nextStep: opportunity.nextStep,
      validation: opportunity.validation,
      sourceUrl: opportunity.sourceUrl,
    })))}`,
  ].join("\n\n");
}

function buildPrompt(summary: AggregatedSummary): string {
  const style = summary.summaryStyle ?? "executive";
  const styleInstruction =
    style === "technical"
      ? "Use six short technical sections covering assumptions, current state, target state, a 30/60/90-day plan, risks, and validation metrics."
      : style === "board"
        ? "Use six board-ready lines covering business impact, risk posture, investment, execution confidence, fallback, and the decision ask."
        : "Write one concise executive paragraph for CISO and SOC leadership.";
  const sources = summary.topSources
    .map((source) => `- ${source.name}: ${source.sharePct}% of ingest`)
    .join("\n");
  const breakdown = Object.entries(summary.breakdown)
    .filter(([, amount]) => amount > 0)
    .map(([category, amount]) => `- ${category}: $${amount.toFixed(2)}/mo`)
    .join("\n");
  const recommendations = summary.recommendations
    .map(
      (recommendation) =>
        `- [${recommendation.severity}] ${recommendation.title}${
          recommendation.monthlySavings
            ? ` (~$${recommendation.monthlySavings}/mo)`
            : ""
        }`,
    )
    .join("\n");

  return [
    "You are a Microsoft Sentinel migration and cost-optimization advisor.",
    "Use only the aggregated figures below. Do not invent log contents or customer names.",
    styleInstruction,
    `SIEM: ${summary.vendor}`,
    `Total ingest: ${summary.totalGbPerDay} GB/day across ${summary.sourceCount} sources`,
    `Billable analytics: ${summary.billableAnalyticsGbPerDay} GB/day (benefits cover ${summary.benefitGbPerDay} GB/day)`,
    `Estimated monthly cost: $${summary.monthlyCost}`,
    `Top sources:\n${sources || "- (none)"}`,
    `Cost breakdown:\n${breakdown || "- (none)"}`,
    `Detected opportunities:\n${recommendations || "- (none)"}`,
    "Recommend a phased migration, the top three cost actions, operational cautions, a parallel-run fallback with success criteria, and validation against billing and detection outcomes.",
  ].join("\n\n");
}

export async function handleRecommend(
  rawBody: string,
  provider?: AiProvider,
): Promise<ApiResult> {
  if (!provider) {
    return result({ error: "AI enhancement is not enabled for this deployment." }, 501);
  }

  const parsed = readJson(rawBody, RECOMMEND_MAX_BODY_BYTES);
  if (!parsed.ok) return parsed.result;
  const protection = isProtectionSummary(parsed.value);
  if (!protection && !isAggregatedSummary(parsed.value)) {
    return result({ error: "Expected an aggregated summary payload." }, 400);
  }

  try {
    const completion = await provider.complete({
      messages: [
        {
          role: "system",
          content:
            "You are a precise, vendor-neutral cloud security and cost advisor. Optimize for executive clarity, migration practicality, and measurable outcomes.",
        },
        { role: "user", content: protection
          ? buildProtectionPrompt(parsed.value as ProtectionSummary)
          : buildPrompt(parsed.value as AggregatedSummary) },
      ],
      maxTokens: INTERNAL_CONFIG.api.recommend.maxTokens,
      temperature: INTERNAL_CONFIG.api.recommend.temperature,
    });
    return result({ text: completion.text, model: completion.model });
  } catch {
    return result({ error: "The AI service failed to generate a summary." }, 502);
  }
}
