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

export interface EntraClaims extends JWTPayload {
  roles?: string[];
  name?: string;
  email?: string;
  oid?: string;
  preferred_username?: string;
}

export type AuthorizationResult =
  | { ok: true; claims: EntraClaims }
  | { ok: false; status: 401 | 403 | 503; error: string };

interface AuthorizationRequest {
  headers: Headers;
}

function bearerToken(request: AuthorizationRequest): string | undefined {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer ")) return undefined;
  return value.slice("Bearer ".length).trim() || undefined;
}

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getKeySet(jwksUri: string): ReturnType<typeof createRemoteJWKSet> {
  let keySet = keySets.get(jwksUri);
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(jwksUri));
    keySets.set(jwksUri, keySet);
  }
  return keySet;
}

export async function authorizeUser(
  request: AuthorizationRequest,
  environment: EntraEnvironment = process.env,
): Promise<AuthorizationResult> {
  const issuer = environment.ENTRA_EXTERNAL_ID_ISSUER?.trim();
  const audience = environment.ENTRA_EXTERNAL_ID_AUDIENCE?.trim();
  const jwksUri = environment.ENTRA_EXTERNAL_ID_JWKS_URI?.trim();

  if (!issuer || !audience || !jwksUri) {
    return { ok: false, status: 503, error: "User identity is not configured." };
  }

  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: "Bearer token required." };

  try {
    const result = await jwtVerify<EntraClaims>(token, getKeySet(jwksUri), {
      issuer,
      audience,
    });
    return { ok: true, claims: result.payload };
  } catch {
    return { ok: false, status: 401, error: "Invalid bearer token." };
  }
}

export async function authorizeAdmin(
  request: AuthorizationRequest,
  environment: EntraEnvironment = process.env,
): Promise<AuthorizationResult> {
  const requiredRole =
    environment.ENTRA_EXTERNAL_ID_ADMIN_ROLE?.trim() || "SentinelOptimizer.Admin";

  const authorization = await authorizeUser(request, environment);
  if (!authorization.ok) return authorization;
  if (!authorization.claims.roles?.includes(requiredRole)) {
    return { ok: false, status: 403, error: "Admin role required." };
  }
  return authorization;
}
