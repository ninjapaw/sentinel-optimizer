/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface EntraEnvironment {
  ENTRA_EXTERNAL_ID_ISSUER?: string;
  ENTRA_EXTERNAL_ID_JWKS_URI?: string;
  ENTRA_EXTERNAL_ID_AUDIENCE?: string;
  ENTRA_EXTERNAL_ID_ADMIN_ROLE?: string;
}

export interface AdminClaims extends JWTPayload {
  roles?: string[];
  name?: string;
  preferred_username?: string;
}

export type AuthorizationResult =
  | { ok: true; claims: AdminClaims }
  | { ok: false; status: 401 | 403 | 503; error: string };

interface AuthorizationRequest {
  headers: Headers;
}

function bearerToken(request: AuthorizationRequest): string | undefined {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) return undefined;
  return value.slice("Bearer ".length).trim() || undefined;
}

export async function authorizeAdmin(
  request: AuthorizationRequest,
  environment: EntraEnvironment = process.env,
): Promise<AuthorizationResult> {
  const issuer = environment.ENTRA_EXTERNAL_ID_ISSUER?.trim();
  const audience = environment.ENTRA_EXTERNAL_ID_AUDIENCE?.trim();
  const jwksUri = environment.ENTRA_EXTERNAL_ID_JWKS_URI?.trim();
  const requiredRole =
    environment.ENTRA_EXTERNAL_ID_ADMIN_ROLE?.trim() || "SentinelOptimizer.Admin";

  if (!issuer || !audience || !jwksUri) {
    return { ok: false, status: 503, error: "Admin identity is not configured." };
  }

  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: "Bearer token required." };

  try {
    const keySet = createRemoteJWKSet(new URL(jwksUri));
    const result = await jwtVerify<AdminClaims>(token, keySet, {
      issuer,
      audience,
    });
    if (!result.payload.roles?.includes(requiredRole)) {
      return { ok: false, status: 403, error: "Admin role required." };
    }
    return { ok: true, claims: result.payload };
  } catch {
    return { ok: false, status: 401, error: "Invalid bearer token." };
  }
}
