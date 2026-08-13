/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

/**
 * Application invariants and compatibility identifiers.
 *
 * These values are shared to prevent protocol drift. They are not supported
 * customization points; change them only alongside migrations and tests.
 */
export const INTERNAL_CONFIG = Object.freeze({
  input: Object.freeze({
    maxBytes: 5 * 1024 * 1024,
  }),
  api: Object.freeze({
    routes: Object.freeze({
      health: "/api/health",
      recommend: "/api/recommend",
      example: "/api/example",
    }),
    headers: Object.freeze({
      cacheControl: "no-store",
      contentType: "application/json; charset=utf-8",
      contentTypeOptions: "nosniff",
      referrerPolicy: "no-referrer",
    }),
    nodeServer: Object.freeze({
      headersTimeoutMs: 15_000,
      keepAliveTimeoutMs: 5_000,
      maxRequestsPerSocket: 1_000,
      requestTimeoutMs: 35_000,
      shutdownTimeoutMs: 10_000,
    }),
    azureTokenScope: "https://ai.azure.com/.default",
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
    session: Object.freeze({
      maxBodyBytes: 256 * 1024,
    }),
  }),
});
