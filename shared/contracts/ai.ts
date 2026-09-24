/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { INTERNAL_CONFIG } from "../config/internal.config.js";
import { isFiniteNumber, isRecord } from "../utils/guards.js";
import {
  findProtectionOpportunities,
  PROTECTION_SOURCE_FAMILIES,
  type ProtectionFamilyCount,
} from "../config/protection.config.js";

export type SummaryStyle = "executive" | "technical" | "board";

export interface ProtectionSummary {
  kind: "protection";
  version: "2";
  audience: "CISO" | "SOC leader" | "Security architect";
  sourceCount: number;
  windowDays: number;
  families: ProtectionFamilyCount[];
  recommendations: { id: string }[];
}

export function isProtectionSummary(value: unknown): value is ProtectionSummary {
  if (!isRecord(value) || value.kind !== "protection" || value.version !== "2") return false;
  const keys = ["kind", "version", "audience", "sourceCount", "windowDays", "families", "recommendations"];
  if (Object.keys(value).some((field) => !keys.includes(field)) ||
    !["CISO", "SOC leader", "Security architect"].includes(String(value.audience)) ||
    !isFiniteNumber(value.sourceCount) || !Number.isInteger(value.sourceCount) || value.sourceCount < 1 || value.sourceCount > 100000 ||
    !isFiniteNumber(value.windowDays) || !Number.isInteger(value.windowDays) || value.windowDays < 1 || value.windowDays > 3650 ||
    !Array.isArray(value.families) || value.families.length < 1 || value.families.length > PROTECTION_SOURCE_FAMILIES.length ||
    !Array.isArray(value.recommendations)
  ) return false;
  if (!value.families.every((entry) => isRecord(entry) &&
    Object.keys(entry).length === 2 &&
    PROTECTION_SOURCE_FAMILIES.some((family) => family === entry.family) &&
    isFiniteNumber(entry.count) && Number.isInteger(entry.count) && entry.count > 0 && entry.count <= 100000
  )) return false;
  const families = value.families as ProtectionFamilyCount[];
  if (new Set(families.map((entry) => entry.family)).size !== families.length ||
    families.reduce((total, entry) => total + entry.count, 0) !== value.sourceCount) return false;
  const expected = findProtectionOpportunities(families);
  return value.recommendations.length === expected.length && value.recommendations.every((entry, index) =>
    isRecord(entry) && Object.keys(entry).length === 1 && entry.id === expected[index]?.id);
}

export interface AggregatedSummary {
  vendor: string;
  summaryStyle?: SummaryStyle;
  totalGbPerDay: number;
  sourceCount: number;
  topSources: { name: string; sharePct: number }[];
  monthlyCost: number;
  breakdown: Record<string, number>;
  billableAnalyticsGbPerDay: number;
  benefitGbPerDay: number;
  recommendations: {
    title: string;
    severity: string;
    monthlySavings?: number;
  }[];
}

export interface ExampleRequest {
  vendor: string;
  label: string;
  schemaHint: string;
  template: string;
}

export interface ExplainKqlRequest {
  /** Which canonical kql/*.md query the pasted result came from, e.g. "defender-for-servers-p2-ingestion-benefit". */
  queryId: string;
  /** The single result row the user copy/pasted from Log Analytics (tab, comma, or JSON — sent as-is to the AI, never parsed as code). Optional if imageDataUrl is provided instead. */
  resultText?: string;
  /** A `data:image/...;base64,...` screenshot of the result row, sent to a vision-capable model to read instead of/alongside resultText. */
  imageDataUrl?: string;
}

export interface AiTextResponse {
  text: string;
  model?: string;
}

export interface ApiErrorResponse {
  error: string;
}

export function isAggregatedSummary(value: unknown): value is AggregatedSummary {
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

export function isExampleRequest(value: unknown): value is ExampleRequest {
  return (
    isRecord(value) &&
    typeof value.vendor === "string" &&
    value.vendor.length <= 100 &&
    typeof value.label === "string" &&
    value.label.length <= 200 &&
    typeof value.schemaHint === "string" &&
    value.schemaHint.length <= 1000 &&
    typeof value.template === "string" &&
    value.template.length <= INTERNAL_CONFIG.api.example.maxTemplateCharacters
  );
}

export function isExplainKqlRequest(value: unknown): value is ExplainKqlRequest {
  if (!isRecord(value)) return false;
  if (typeof value.queryId !== "string" || value.queryId.length === 0 || value.queryId.length > 200) {
    return false;
  }

  const hasText =
    typeof value.resultText === "string" &&
    value.resultText.length > 0 &&
    value.resultText.length <= INTERNAL_CONFIG.api.explainKql.maxResultCharacters;
  const hasImage =
    typeof value.imageDataUrl === "string" &&
    /^data:image\/(png|jpeg|jpg|webp);base64,/.test(value.imageDataUrl) &&
    value.imageDataUrl.length <= INTERNAL_CONFIG.api.explainKql.maxImageDataUrlCharacters;

  return hasText || hasImage;
}

export function isAiTextResponse(value: unknown): value is AiTextResponse {
  return (
    isRecord(value) &&
    typeof value.text === "string" &&
    value.text.length > 0 &&
    (value.model === undefined || typeof value.model === "string")
  );
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return isRecord(value) && typeof value.error === "string";
}
