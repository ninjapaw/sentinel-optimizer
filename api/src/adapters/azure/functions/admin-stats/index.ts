/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { HttpHandler, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { handleAdminStats } from "../../../../core/session.js";
import { apiResponseHeaders, getSessionStorage } from "../../../../../../shared/index.js";

function extractUserIdentity(request: HttpRequest): {
  userId: string | undefined;
  role: string | undefined;
} {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (!token) {
    return { userId: undefined, role: undefined };
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) {
      return { userId: undefined, role: undefined };
    }
    const encoded = parts[1];
    const decoded = JSON.parse(atob(encoded));
    const roles = decoded.roles as string[] | undefined;
    const role = roles?.[0];
    return {
      userId: (decoded.sub as string | undefined) || (decoded.oid as string | undefined),
      role: role as string | undefined,
    };
  } catch {
    return { userId: undefined, role: undefined };
  }
}

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

    const { userId, role } = extractUserIdentity(request);
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
