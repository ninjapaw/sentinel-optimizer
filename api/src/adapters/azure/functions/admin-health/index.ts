/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { HttpHandler, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { authorizeAdmin } from "../../../../auth/entra.js";
import { apiResponseHeaders } from "../../../../../../shared/index.js";

export const adminHealth: HttpHandler = async (
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> => {
  try {
    const authorization = await authorizeAdmin(request);
    if (!authorization.ok) {
      const response: HttpResponseInit = {
        status: authorization.status,
        body: JSON.stringify({ error: authorization.error }),
        headers: apiResponseHeaders(),
      };
      if (authorization.status === 401) {
        response.headers = { ...apiResponseHeaders(), "www-authenticate": "Bearer" };
      }
      return response;
    }

    return {
      status: 200,
      body: JSON.stringify({
        status: "ok",
        subject: authorization.claims.sub,
        timestamp: new Date().toISOString(),
      }),
      headers: apiResponseHeaders(),
    };
  } catch (error) {
    context.error("Admin health check error:", error);
    return {
      status: 500,
      body: JSON.stringify({ error: "Internal server error." }),
      headers: apiResponseHeaders(),
    };
  }
};

export default adminHealth;
