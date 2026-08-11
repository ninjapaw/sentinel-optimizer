/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { HttpHandler, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { handleSessionSave } from "../../../../core/session.js";
import { apiResponseHeaders, getSessionStorage } from "../../../../../../shared/index.js";

function extractUserIdentity(request: HttpRequest): {
  userId: string | undefined;
  userEmail: string | undefined;
  displayName: string | undefined;
} {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (!token) {
    return { userId: undefined, userEmail: undefined, displayName: undefined };
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) {
      return { userId: undefined, userEmail: undefined, displayName: undefined };
    }
    const encoded = parts[1];
    const decoded = JSON.parse(atob(encoded));
    return {
      userId: (decoded.sub as string | undefined) || (decoded.oid as string | undefined),
      userEmail: (decoded.preferred_username as string | undefined) || (decoded.email as string | undefined),
      displayName: decoded.name as string | undefined,
    };
  } catch {
    return { userId: undefined, userEmail: undefined, displayName: undefined };
  }
}

export const sessionSave: HttpHandler = async (
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> => {
  try {
    if (request.method !== "POST") {
      return {
        status: 405,
        body: JSON.stringify({ error: "Method not allowed." }),
        headers: apiResponseHeaders(),
      };
    }

    const { userId, userEmail, displayName } = extractUserIdentity(request);

    if (!userId) {
      return {
        status: 401,
        body: JSON.stringify({ error: "Unauthorized. User identity required." }),
        headers: apiResponseHeaders(),
      };
    }

    const rawBody = await request.text();
    const storage = getSessionStorage(process.env);
    const { status, body: responseBody } = await handleSessionSave(
      rawBody,
      userId,
      userEmail,
      displayName,
      storage,
    );

    return {
      status,
      body: JSON.stringify(responseBody),
      headers: apiResponseHeaders(),
    };
  } catch (error) {
    context.error("Session save error:", error);
    return {
      status: 500,
      body: JSON.stringify({ error: "Internal server error." }),
      headers: apiResponseHeaders(),
    };
  }
};

export default sessionSave;
