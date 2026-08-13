/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { routeApiRequest } from "../../core/router.js";
import {
  createWorkersAiProvider,
  type WorkersAiBinding,
} from "../../providers/cloudflare.js";
import {
  apiResponseHeaders,
  INTERNAL_CONFIG,
  parseCommaSeparated,
} from "../../../../shared/index.js";

interface Env {
  AI?: WorkersAiBinding;
  AI_API_ENABLED?: string;
  AI_MODEL?: string;
  ALLOWED_ORIGINS?: string;
}

function corsHeaders(request: Request, environment: Env): Headers {
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set(
    environment.ALLOWED_ORIGINS
      ? parseCommaSeparated(environment.ALLOWED_ORIGINS)
      : INTERNAL_CONFIG.api.cloudflare.allowedOrigins,
  );
  if (origin && allowedOrigins.has(origin)) {
    return new Headers(apiResponseHeaders(origin));
  }
  return new Headers(apiResponseHeaders());
}

export default {
  async fetch(request: Request, environment: Env): Promise<Response> {
    const headers = corsHeaders(request, environment);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    const provider = environment.AI_API_ENABLED === "true"
      ? createWorkersAiProvider(environment.AI, environment.AI_MODEL)
      : undefined;
    const response = await routeApiRequest(
      request.method,
      url.pathname,
      request.method === "POST" ? await request.text() : "",
      provider,
    );
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers,
    });
  },
};
