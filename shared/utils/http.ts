/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { INTERNAL_CONFIG } from "../config/internal.config.js";

export function apiResponseHeaders(origin?: string): Record<string, string> {
  return {
    "cache-control": INTERNAL_CONFIG.api.headers.cacheControl,
    "content-type": INTERNAL_CONFIG.api.headers.contentType,
    "referrer-policy": INTERNAL_CONFIG.api.headers.referrerPolicy,
    "x-content-type-options": INTERNAL_CONFIG.api.headers.contentTypeOptions,
    ...(origin
      ? {
          "access-control-allow-origin": origin,
          "access-control-allow-headers": "content-type",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          vary: "Origin",
        }
      : {}),
  };
}
