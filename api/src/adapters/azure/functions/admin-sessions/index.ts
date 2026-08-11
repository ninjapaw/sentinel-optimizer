/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { HttpHandler, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { handleAdminUserList, handleAdminSessionDelete } from "../../../../core/session.js";
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

function parseAdminSessionPath(pathname: string): {
  operation: "users" | "delete" | "unknown";
  userId: string | undefined;
  sessionId: string | undefined;
} {
  const adminUsersMatch = pathname.match(/\/api\/admin\/users$/);
  if (adminUsersMatch) return { operation: "users", userId: undefined, sessionId: undefined };

  const adminSessionMatch = pathname.match(/\/api\/admin\/session\/([^/]+)\/([^/]+)$/);
  if (adminSessionMatch) {
    return {
      operation: "delete",
      userId: adminSessionMatch[1] as string,
      sessionId: adminSessionMatch[2] as string,
    };
  }

  return { operation: "unknown", userId: undefined, sessionId: undefined };
}

export const adminSessions: HttpHandler = async (
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> => {
  try {
    const { userId, role } = extractUserIdentity(request);
    const { operation, userId: targetUserId, sessionId } = parseAdminSessionPath(
      new URL(request.url).pathname,
    );

    if (operation === "unknown") {
      return {
        status: 404,
        body: JSON.stringify({ error: "Not found." }),
        headers: apiResponseHeaders(),
      };
    }

    const storage = getSessionStorage(process.env);

    if (operation === "users") {
      if (request.method !== "GET") {
        return {
          status: 405,
          body: JSON.stringify({ error: "Method not allowed." }),
          headers: apiResponseHeaders(),
        };
      }

      const url = new URL(request.url);
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
      const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10), 0);

      const { status, body } = await handleAdminUserList(userId, role, limit, offset, storage);
      return {
        status,
        body: JSON.stringify(body),
        headers: apiResponseHeaders(),
      };
    }

    if (operation === "delete") {
      if (request.method !== "DELETE") {
        return {
          status: 405,
          body: JSON.stringify({ error: "Method not allowed." }),
          headers: apiResponseHeaders(),
        };
      }

      if (!targetUserId || !sessionId) {
        return {
          status: 400,
          body: JSON.stringify({ error: "Invalid parameters." }),
          headers: apiResponseHeaders(),
        };
      }

      const { status, body } = await handleAdminSessionDelete(
        userId,
        role,
        targetUserId,
        sessionId,
        storage,
      );
      return {
        status,
        body: JSON.stringify(body),
        headers: apiResponseHeaders(),
      };
    }

    return {
      status: 500,
      body: JSON.stringify({ error: "Internal server error." }),
      headers: apiResponseHeaders(),
    };
  } catch (error) {
    context.error("Admin sessions error:", error);
    return {
      status: 500,
      body: JSON.stringify({ error: "Internal server error." }),
      headers: apiResponseHeaders(),
    };
  }
};

export default adminSessions;
