import { routeApiRequest } from "../../core/router.js";
import {
  createWorkersAiProvider,
  type WorkersAiBinding,
} from "../../providers/cloudflare.js";
import {
  INTERNAL_CONFIG,
  parseCommaSeparated,
  USER_CONFIG,
} from "../../../../shared/index.js";

interface Env {
  AI?: WorkersAiBinding;
  AI_API_ENABLED?: string;
  AI_MODEL?: string;
  ALLOWED_ORIGINS?: string;
}

function corsHeaders(request: Request, environment: Env): Headers {
  const headers = new Headers({
    "cache-control": INTERNAL_CONFIG.api.headers.cacheControl,
    "content-type": INTERNAL_CONFIG.api.headers.contentType,
    "referrer-policy": INTERNAL_CONFIG.api.headers.referrerPolicy,
    "x-content-type-options": INTERNAL_CONFIG.api.headers.contentTypeOptions,
  });
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set(
    environment.ALLOWED_ORIGINS
      ? parseCommaSeparated(environment.ALLOWED_ORIGINS)
      : USER_CONFIG.api.cloudflare.allowedOrigins,
  );
  if (origin && allowedOrigins.has(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-headers", "content-type");
    headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
    headers.set("vary", "Origin");
  }
  return headers;
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
