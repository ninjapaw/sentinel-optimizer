/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { AiProvider, ApiResult } from "./contracts.js";
import { handleExample } from "./example.js";
import { result } from "./http.js";
import { handleRecommend } from "./recommend.js";
import { INTERNAL_CONFIG } from "../../../shared/index.js";

export async function routeApiRequest(
  method: string,
  pathname: string,
  rawBody: string,
  provider?: AiProvider,
): Promise<ApiResult> {
  if (pathname === INTERNAL_CONFIG.api.routes.health && method === "GET") {
    return result({ status: "ok" });
  }

  const handler =
    pathname === INTERNAL_CONFIG.api.routes.recommend
      ? handleRecommend
      : pathname === INTERNAL_CONFIG.api.routes.example
        ? handleExample
        : undefined;

  if (!handler) return result({ error: "Not found." }, 404);
  if (method !== "POST") return result({ error: "Method not allowed." }, 405);
  return handler(rawBody, provider);
}
