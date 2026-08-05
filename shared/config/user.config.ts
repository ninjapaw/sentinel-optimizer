/**
 * Supported project configuration.
 *
 * Edit values in this file to customize branding, public URLs, local ports,
 * model defaults, and bounded API behavior. Keep secrets in environment
 * variables; this file is bundled into browser and server artifacts.
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
  input: Object.freeze({
    maxBytes: 5 * 1024 * 1024,
  }),
  api: Object.freeze({
    host: "0.0.0.0",
    port: 7071,
    localWebOrigins: Object.freeze([
      "http://localhost:4321",
      "http://127.0.0.1:4321",
    ]),
    openai: Object.freeze({
      requestTimeoutMs: 30_000,
      maxRetries: 1,
    }),
    cloudflare: Object.freeze({
      model: "@cf/meta/llama-3.1-8b-instruct",
      allowedOrigins: Object.freeze([
        "https://sentineloptimizer.com",
        "https://ninjapaw.github.io",
      ]),
    }),
    recommend: Object.freeze({
      maxBodyBytes: 16 * 1024,
      maxTokens: 700,
      temperature: 0.2,
    }),
    example: Object.freeze({
      maxBodyBytes: 8 * 1024,
      maxTemplateCharacters: 4000,
      maxTokens: 1200,
      temperature: 0.5,
    }),
  }),
});

export type UserConfig = typeof USER_CONFIG;
