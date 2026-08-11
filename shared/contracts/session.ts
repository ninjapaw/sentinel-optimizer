/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { isFiniteNumber, isRecord } from "../utils/guards.js";

export interface UserSession {
  sessionId: string;
  userId: string;
  userEmail: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  description?: string;
  optimizerState: unknown;
  costBreakdown?: Record<string, unknown>;
  recommendations?: unknown[];
  exportFormats?: ("pdf" | "pptx" | "json")[];
}

export interface SessionListItem {
  sessionId: string;
  name: string;
  description?: string;
  updatedAt: string;
  createdAt: string;
}

export interface SessionSaveRequest {
  name: string;
  description?: string;
  optimizerState: unknown;
  costBreakdown?: Record<string, unknown>;
  recommendations?: unknown[];
}

export interface SessionSaveResponse {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionLoadResponse {
  session: UserSession;
}

export interface SessionDeleteRequest {
  sessionId: string;
}

export interface AdminUserSession {
  userId: string;
  userEmail: string;
  displayName?: string;
  sessionCount: number;
  totalStorageBytes: number;
  lastActiveAt: string;
  createdAt: string;
}

export interface AdminSessionListRequest {
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface AdminSessionListResponse {
  sessions: UserSession[];
  total: number;
  limit: number;
  offset: number;
}

export function isUserSession(value: unknown): value is UserSession {
  if (
    !isRecord(value) ||
    typeof value.sessionId !== "string" ||
    typeof value.userId !== "string" ||
    typeof value.userEmail !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    typeof value.name !== "string" ||
    !isRecord(value.optimizerState)
  ) {
    return false;
  }
  return true;
}

export function isSessionListItem(value: unknown): value is SessionListItem {
  return (
    isRecord(value) &&
    typeof value.sessionId === "string" &&
    typeof value.name === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.createdAt === "string"
  );
}

export function isSessionSaveRequest(value: unknown): value is SessionSaveRequest {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    value.name.length <= 200 &&
    !isRecord(value.optimizerState)
  );
}

export function isAdminUserSession(value: unknown): value is AdminUserSession {
  return (
    isRecord(value) &&
    typeof value.userId === "string" &&
    typeof value.userEmail === "string" &&
    isFiniteNumber(value.sessionCount) &&
    isFiniteNumber(value.totalStorageBytes)
  );
}
