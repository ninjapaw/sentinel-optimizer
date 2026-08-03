import type {
  HttpHandler,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import type { ApiResult } from "../../core/contracts.js";
import { result } from "../../core/http.js";
import { routeApiRequest } from "../../core/router.js";
import { createOpenAiProvider } from "../../providers/openai.js";
import { INTERNAL_CONFIG } from "../../../../shared/index.js";

const provider = createOpenAiProvider();

export function declaredBodyTooLarge(
  request: HttpRequest,
  maxBytes: number,
): boolean {
  const value = request.headers.get("content-length");
  if (!value) return false;
  const bytes = Number(value);
  return Number.isFinite(bytes) && bytes > maxBytes;
}

export function createAzureHandler(
  pathname: string,
  maxBodyBytes?: number,
): HttpHandler {
  return async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    if (
      maxBodyBytes !== undefined &&
      declaredBodyTooLarge(request, maxBodyBytes)
    ) {
      return toAzureResponse(
        result({ error: "Payload too large." }, 413),
        context,
      );
    }

    const rawBody = request.method === "POST" ? await request.text() : "";
    return toAzureResponse(
      await routeApiRequest(request.method, pathname, rawBody, provider),
      context,
    );
  };
}

export function toAzureResponse(
  result: ApiResult,
  context?: InvocationContext,
): HttpResponseInit {
  if (result.status >= 500 && context) {
    context.warn(`API request completed with status ${result.status}.`);
  }
  return {
    status: result.status,
    jsonBody: result.body,
    headers: {
      "cache-control": INTERNAL_CONFIG.api.headers.cacheControl,
      "content-type": INTERNAL_CONFIG.api.headers.contentType,
      "referrer-policy": INTERNAL_CONFIG.api.headers.referrerPolicy,
      "x-content-type-options": INTERNAL_CONFIG.api.headers.contentTypeOptions,
    },
  };
}
