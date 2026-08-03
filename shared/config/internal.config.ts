/**
 * Application invariants and compatibility identifiers.
 *
 * These values are shared to prevent protocol drift. They are not supported
 * customization points; change them only alongside migrations and tests.
 */
export const INTERNAL_CONFIG = Object.freeze({
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
    azureTokenScope: "https://ai.azure.com/.default",
  }),
});
