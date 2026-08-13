/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { readJson } from "./http.js";
import {
  INTERNAL_CONFIG,
  isSessionSaveRequest,
} from "../../../shared/index.js";
import type { SessionStorage } from "../../../shared/utils/session-storage.js";

export const SESSION_MAX_BODY_BYTES = INTERNAL_CONFIG.api.session.maxBodyBytes;

export async function handleSessionSave(
  rawBody: string,
  userId: string | undefined,
  userEmail: string | undefined,
  displayName: string | undefined,
  storage: SessionStorage,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!userId || !userEmail) {
    return { status: 401, body: { error: "Unauthorized. User identity required." } };
  }

  const parsed = readJson(rawBody, SESSION_MAX_BODY_BYTES);
  if (!parsed.ok) return parsed.result as { status: number; body: Record<string, unknown> };
  if (!isSessionSaveRequest(parsed.value)) {
    return { status: 400, body: { error: "Expected a session save request." } };
  }

  try {
    const saveResult = await storage.saveSession(userId, userEmail, displayName, parsed.value);
    return { status: 200, body: saveResult as Record<string, unknown> };
  } catch (error) {
    console.error("Session save failed.", error);
    return { status: 500, body: { error: "Failed to save session." } };
  }
}

export async function handleSessionList(
  userId: string | undefined,
  limit: number = 50,
  offset: number = 0,
  storage: SessionStorage,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!userId) {
    return { status: 401, body: { error: "Unauthorized. User identity required." } };
  }

  if (limit < 1 || limit > 100 || offset < 0) {
    return { status: 400, body: { error: "Invalid pagination parameters." } };
  }

  try {
    const listResult = await storage.listUserSessions(userId, limit, offset);
    return { status: 200, body: listResult as Record<string, unknown> };
  } catch (error) {
    console.error("Session list failed.", error);
    return { status: 500, body: { error: "Failed to list sessions." } };
  }
}

export async function handleSessionLoad(
  userId: string | undefined,
  sessionId: string,
  storage: SessionStorage,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!userId) {
    return { status: 401, body: { error: "Unauthorized. User identity required." } };
  }

  if (!sessionId || sessionId.length === 0) {
    return { status: 400, body: { error: "Invalid session ID." } };
  }

  try {
    const session = await storage.loadSession(userId, sessionId);
    return { status: 200, body: { session } as Record<string, unknown> };
  } catch (error) {
    console.error("Session load failed.", error);
    return { status: 404, body: { error: "Failed to load session or session not found." } };
  }
}

export async function handleSessionDelete(
  userId: string | undefined,
  sessionId: string,
  storage: SessionStorage,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!userId) {
    return { status: 401, body: { error: "Unauthorized. User identity required." } };
  }

  if (!sessionId || sessionId.length === 0) {
    return { status: 400, body: { error: "Invalid session ID." } };
  }

  try {
    const deleted = await storage.deleteSession(userId, sessionId);
    if (!deleted) {
      return { status: 404, body: { error: "Session not found or already deleted." } };
    }
    return { status: 200, body: { deleted: true } as Record<string, unknown> };
  } catch (error) {
    console.error("Session delete failed.", error);
    return { status: 500, body: { error: "Failed to delete session." } };
  }
}

export async function handleAdminUserList(
  adminUserId: string | undefined,
  adminRole: string | undefined,
  limit: number = 50,
  offset: number = 0,
  storage: SessionStorage,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!adminUserId || adminRole !== "admin") {
    return { status: 403, body: { error: "Unauthorized. Admin role required." } };
  }

  if (limit < 1 || limit > 100 || offset < 0) {
    return { status: 400, body: { error: "Invalid pagination parameters." } };
  }

  try {
    const listResult = await storage.listAllUsers(limit, offset);
    return { status: 200, body: listResult as Record<string, unknown> };
  } catch (error) {
    console.error("Admin user list failed.", error);
    return { status: 500, body: { error: "Failed to list users." } };
  }
}

export async function handleAdminSessionDelete(
  adminUserId: string | undefined,
  adminRole: string | undefined,
  targetUserId: string,
  sessionId: string,
  storage: SessionStorage,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!adminUserId || adminRole !== "admin") {
    return { status: 403, body: { error: "Unauthorized. Admin role required." } };
  }

  if (!targetUserId || !sessionId) {
    return { status: 400, body: { error: "Invalid parameters." } };
  }

  try {
    const deleted = await storage.deleteSession(targetUserId, sessionId);
    if (!deleted) {
      return { status: 404, body: { error: "Session not found." } };
    }
    return { status: 200, body: { deleted: true } as Record<string, unknown> };
  } catch (error) {
    console.error("Admin session delete failed.", error);
    return { status: 500, body: { error: "Failed to delete session." } };
  }
}

export async function handleAdminStats(
  adminUserId: string | undefined,
  adminRole: string | undefined,
  storage: SessionStorage,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!adminUserId || adminRole !== "admin") {
    return { status: 403, body: { error: "Unauthorized. Admin role required." } };
  }

  try {
    // Fetch all users with a high limit
    const result = await storage.listAllUsers(1000, 0);
    const users = result.users || [];
    let totalUsers = 0;
    let totalSessions = 0;
    let totalStorageBytes = 0;

    const userStats = [];
    for (const user of users) {
      const userRecord = user as Record<string, unknown> | undefined;
      if (!userRecord) continue;

      totalUsers += 1;
      totalSessions += (userRecord.sessionCount as number | undefined) || 0;
      totalStorageBytes += (userRecord.totalStorageBytes as number | undefined) || 0;
      userStats.push({
        userId: userRecord.userId,
        userEmail: userRecord.userEmail,
        displayName: userRecord.displayName,
        sessionCount: (userRecord.sessionCount as number | undefined) || 0,
        totalStorageBytes: (userRecord.totalStorageBytes as number | undefined) || 0,
        lastActiveAt: userRecord.lastActiveAt,
        createdAt: userRecord.createdAt,
      });
    }

    return {
      status: 200,
      body: {
        summary: {
          totalUsers,
          totalSessions,
          totalStorageBytes,
          storageGB: Math.round((totalStorageBytes / (1024 * 1024 * 1024)) * 100) / 100,
          timestamp: new Date().toISOString(),
        },
        users: userStats,
      } as Record<string, unknown>,
    };
  } catch (error) {
    console.error("Admin stats query failed.", error);
    return { status: 500, body: { error: "Failed to retrieve admin stats." } };
  }
}
