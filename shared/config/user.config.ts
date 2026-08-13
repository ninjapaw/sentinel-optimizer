/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

/**
 * Public fallback configuration.
 *
 * Production builds resolve user-editable values from public GitHub Environment
 * variables. These values keep local development and unconfigured deployments
 * usable. Do not add secrets or safety limits here.
 */
export const USER_CONFIG = Object.freeze({
  site: Object.freeze({
    name: "Sentinel Optimizer",
    tagline: "SIEM cost & migration estimator",
    owner: "Sentinel Optimizer contributors",
    repository: "ninjapaw/sentinel-optimizer",
    productionUrl: "https://sentineloptimizer.com",
    language: "en",
    direction: "ltr" as const,
    titleSeparator: " — ",
    defaultDescription:
      "Analyze SIEM ingestion, estimate Microsoft Sentinel cost, and get optimization recommendations — entirely in your browser. Zero trust, zero credentials, independent community tool.",
  }),
  brand: Object.freeze({
    colors: Object.freeze({
      sentinelTeal: "#30E5D0",
      sentinelNavy: "#243A5E",
      blue: "#0078D4",
      cyan: "#50E6FF",
      green: "#107C10",
      lime: "#9BF00B",
      amber: "#FFB900",
      purple: "#D59DFF",
      ink: "#1B1B1B",
      grey: "#737373",
      light: "#F3F6FB",
      white: "#FFFFFF",
    }),
  }),
});

export type UserConfig = typeof USER_CONFIG;
