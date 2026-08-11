/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { HttpHandler, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { handleSessionLoad, handleSessionDelete } from "../../../../core/session.js";
import { apiResponseHeaders, getSessionStorage } from "../../../../../../shared/index.js";

function extractUserIdentity(request: HttpRequest): {
  userId: string | undefined;
} {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (!token) {
    return { userId: undefined };
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) {
      return { userId: undefined };
    }
    const encoded = parts[1];
    const decoded = JSON.parse(atob(encoded));
    return { userId: (decoded.sub as string | undefined) || (decoded.oid as string | undefined) };
  } catch {
    return { userId: undefined };
  }
}

function getSessionIdFromRoute(pathname: string): string | null {
  const match = pathname.match(/\/api\/session\/([^/]+)$/);
  return match ? (match[1] as string) : null;
}

export const sessionManage: HttpHandler = async (
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> => {
  try {
    const { userId } = extractUserIdentity(request);
    const sessionId = getSessionIdFromRoute(new URL(request.url).pathname);

    if (!sessionId) {
      return {
        status: 400,
        body: JSON.stringify({ error: "Invalid session ID." }),
        headers: apiResponseHeaders(),
      };
    }

    const storage = getSessionStorage(process.env);

    let apiResult;
    if (request.method === "GET") {
      apiResult = await handleSessionLoad(userId, sessionId, storage);
    } else if (request.method === "DELETE") {
      apiResult = await handleSessionDelete(userId, sessionId, storage);
    } else {
      return {
        status: 405,
        body: JSON.stringify({ error: "Method not allowed." }),
        headers: apiResponseHeaders(),
      };
    }

    return {
      status: apiResult.status,
      body: JSON.stringify(apiResult.body),
      headers: apiResponseHeaders(),
    };
  } catch (error) {
    context.error("Session manage error:", error);
    return {
      status: 500,
      body: JSON.stringify({ error: "Internal server error." }),
      headers: apiResponseHeaders(),
    };
  }
};

export default sessionManage;
