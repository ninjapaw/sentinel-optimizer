/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { HttpHandler, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { authorizeAdmin } from "../../../../auth/entra.js";
import { handleAdminStats } from "../../../../core/session.js";
import { apiResponseHeaders, getSessionStorage } from "../../../../../../shared/index.js";

export const adminStats: HttpHandler = async (
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> => {
  try {
    if (request.method !== "GET") {
      return {
        status: 405,
        body: JSON.stringify({ error: "Method not allowed." }),
        headers: apiResponseHeaders(),
      };
    }

    const authorization = await authorizeAdmin(request);
    if (!authorization.ok) {
      return {
        status: authorization.status,
        body: JSON.stringify({ error: authorization.error }),
        headers: apiResponseHeaders(),
      };
    }
    const userId = authorization.claims.sub || authorization.claims.oid;
    const role = "admin";
    const storage = getSessionStorage(process.env);
    const { status, body } = await handleAdminStats(userId, role, storage);

    return {
      status,
      body: JSON.stringify(body),
      headers: apiResponseHeaders(),
    };
  } catch (error) {
    context.error("Admin stats error:", error);
    return {
      status: 500,
      body: JSON.stringify({ error: "Internal server error." }),
      headers: apiResponseHeaders(),
    };
  }
};

export default adminStats;
