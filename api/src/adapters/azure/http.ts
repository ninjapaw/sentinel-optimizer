/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type {
  HttpHandler,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import type { ApiResult } from "../../core/contracts.js";
import { result } from "../../core/http.js";
import { routeApiRequest } from "../../core/router.js";
import { createConfiguredAiProvider } from "../../runtime/provider.js";
import { apiResponseHeaders } from "../../../../shared/index.js";

const provider = createConfiguredAiProvider();

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
    headers: apiResponseHeaders(),
  };
}
