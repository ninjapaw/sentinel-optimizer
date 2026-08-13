/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { INTERNAL_CONFIG } from "../config/internal.config.js";
import { isFiniteNumber, isRecord } from "../utils/guards.js";

export type SummaryStyle = "executive" | "technical" | "board";

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
