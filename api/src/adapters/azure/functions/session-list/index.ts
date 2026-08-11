/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { HttpHandler, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { handleSessionList } from "../../../../core/session.js";
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

export const sessionList: HttpHandler = async (
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

    const { userId } = extractUserIdentity(request);
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 10), offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10), 0);

    const storage = getSessionStorage(process.env);
    const { status, body } = await handleSessionList(userId, limit, offset, storage);

    return {
      status,
      body: JSON.stringify(body),
      headers: apiResponseHeaders(),
    };
  } catch (error) {
    context.error("Session list error:", error);
    return {
      status: 500,
      body: JSON.stringify({ error: "Internal server error." }),
      headers: apiResponseHeaders(),
    };
  }
};

export default sessionList;
