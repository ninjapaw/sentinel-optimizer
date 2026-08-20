/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { HttpHandler, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { authorizeUser } from "../../../../auth/entra.js";
import { handleSessionSave } from "../../../../core/session.js";
import { apiResponseHeaders, getSessionStorage } from "../../../../../../shared/index.js";

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

    const authorization = await authorizeUser(request);
    if (!authorization.ok) {
      return {
        status: authorization.status,
        body: JSON.stringify({ error: authorization.error }),
        headers: apiResponseHeaders(),
      };
    }

    const claims = authorization.claims;
    const userId = claims.sub || claims.oid;
    const userEmail = claims.preferred_username || claims.email;

    const rawBody = await request.text();
    const storage = getSessionStorage(process.env);
    const { status, body: responseBody } = await handleSessionSave(
      rawBody,
      userId,
      userEmail,
      claims.name,
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
