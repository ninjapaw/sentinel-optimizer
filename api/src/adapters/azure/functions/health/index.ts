/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { HttpHandler, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { apiResponseHeaders } from "../../../../../../shared/index.js";

export const health: HttpHandler = async (
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> => {
  try {
    return {
      status: 200,
      body: JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
      headers: apiResponseHeaders(),
    };
  } catch (error) {
    context.error("Health check error:", error);
    return {
      status: 500,
      body: JSON.stringify({ error: "Internal server error." }),
      headers: apiResponseHeaders(),
    };
  }
};

export default health;
