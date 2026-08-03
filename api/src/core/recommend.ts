import type { AiProvider, ApiResult } from "./contracts.js";
import { isFiniteNumber, isRecord, readJson, result } from "./http.js";
import { USER_CONFIG } from "../../../shared/index.js";

export interface AggregatedSummary {
  vendor: string;
  summaryStyle?: "executive" | "technical" | "board";
  totalGbPerDay: number;
  sourceCount: number;
  topSources: { name: string; sharePct: number }[];
  monthlyCost: number;
  breakdown: Record<string, number>;
  billableAnalyticsGbPerDay: number;
  benefitGbPerDay: number;
  recommendations: { title: string; severity: string; monthlySavings?: number }[];
}

export const RECOMMEND_MAX_BODY_BYTES = USER_CONFIG.api.recommend.maxBodyBytes;

function isAggregatedSummary(value: unknown): value is AggregatedSummary {
  if (!isRecord(value)) return false;
  if (
    typeof value.vendor !== "string" ||
    value.vendor.length > 100 ||
    !isFiniteNumber(value.totalGbPerDay) ||
    !isFiniteNumber(value.sourceCount) ||
    !isFiniteNumber(value.monthlyCost) ||
    !isFiniteNumber(value.billableAnalyticsGbPerDay) ||
    !isFiniteNumber(value.benefitGbPerDay) ||
    !isRecord(value.breakdown) ||
    !Array.isArray(value.topSources) ||
    value.topSources.length > 5 ||
    !Array.isArray(value.recommendations) ||
    value.recommendations.length > 100
  ) {
    return false;
  }

  const validStyle =
    value.summaryStyle === undefined ||
    value.summaryStyle === "executive" ||
    value.summaryStyle === "technical" ||
    value.summaryStyle === "board";
  const validBreakdown =
    Object.keys(value.breakdown).length <= 50 &&
    Object.values(value.breakdown).every(isFiniteNumber);
  const validSources = value.topSources.every(
    (source) =>
      isRecord(source) &&
      typeof source.name === "string" &&
      source.name.length <= 200 &&
      isFiniteNumber(source.sharePct),
  );
  const validRecommendations = value.recommendations.every(
    (recommendation) =>
      isRecord(recommendation) &&
      typeof recommendation.title === "string" &&
      recommendation.title.length <= 300 &&
      typeof recommendation.severity === "string" &&
      recommendation.severity.length <= 50 &&
      (recommendation.monthlySavings === undefined ||
        isFiniteNumber(recommendation.monthlySavings)),
  );

  return validStyle && validBreakdown && validSources && validRecommendations;
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
  if (!isAggregatedSummary(parsed.value)) {
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
        { role: "user", content: buildPrompt(parsed.value) },
      ],
      maxTokens: USER_CONFIG.api.recommend.maxTokens,
      temperature: USER_CONFIG.api.recommend.temperature,
    });
    return result({ text: completion.text, model: completion.model });
  } catch {
    return result({ error: "The AI service failed to generate a summary." }, 502);
  }
}
