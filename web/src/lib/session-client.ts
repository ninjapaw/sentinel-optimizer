/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { getAccessToken } from "./auth.js";
import { API_BASE, IDENTITY_CONFIG } from "./identityConfig.js";
import type {
  UserSession,
  SessionListItem,
  SessionSaveRequest,
  SessionSaveResponse,
} from "../../../shared/contracts/session.js";

// Re-export types for convenience
export type { UserSession, SessionListItem, SessionSaveRequest, SessionSaveResponse };

const SCOPES = [IDENTITY_CONFIG.apiScope];

async function getApiHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken(SCOPES);
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function saveSession(
  data: SessionSaveRequest,
): Promise<SessionSaveResponse | null> {
  try {
    const headers = await getApiHeaders();
    const response = await fetch(`${API_BASE}/session/save`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Save session failed:", error);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("Save session error:", error);
    return null;
  }
}

export async function listSessions(
  limit = 50,
  offset = 0,
): Promise<SessionListItem[] | null> {
  try {
    const headers = await getApiHeaders();
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const response = await fetch(`${API_BASE}/session/list?${params}`, {
      headers,
    });

    if (!response.ok) {
      console.error("List sessions failed:", response.status);
      return null;
    }

    const data = await response.json();
    return data.sessions || [];
  } catch (error) {
    console.error("List sessions error:", error);
    return null;
  }
}

export async function loadSession(sessionId: string): Promise<UserSession | null> {
  try {
    const headers = await getApiHeaders();
    const response = await fetch(`${API_BASE}/session/${sessionId}`, {
      headers,
    });

    if (!response.ok) {
      console.error("Load session failed:", response.status);
      return null;
    }

    const data = await response.json();
    return data.session;
  } catch (error) {
    console.error("Load session error:", error);
    return null;
  }
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const headers = await getApiHeaders();
    const response = await fetch(`${API_BASE}/session/${sessionId}`, {
      method: "DELETE",
      headers,
    });

    return response.ok;
  } catch (error) {
    console.error("Delete session error:", error);
    return false;
  }
}

export async function listAllUsers(limit = 50, offset = 0): Promise<unknown[] | null> {
  try {
    const headers = await getApiHeaders();
    const token = headers.Authorization?.split(" ")[1];
    if (!token) return null;

    // Check if admin
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const decoded = JSON.parse(atob(parts[1]));
    if (!decoded.roles?.includes("admin")) return null;

    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const response = await fetch(`${API_BASE}/admin/users?${params}`, {
      headers,
    });

    if (!response.ok) {
      console.error("List users failed:", response.status);
      return null;
    }

    const data = await response.json();
    return data.users || [];
  } catch (error) {
    console.error("List users error:", error);
    return null;
  }
}

export async function deleteUserSession(userId: string, sessionId: string): Promise<boolean> {
  try {
    const headers = await getApiHeaders();
    const token = headers.Authorization?.split(" ")[1];
    if (!token) return false;

    // Check if admin
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const decoded = JSON.parse(atob(parts[1]));
    if (!decoded.roles?.includes("admin")) return false;

    const response = await fetch(`${API_BASE}/admin/session/${userId}/${sessionId}`, {
      method: "DELETE",
      headers,
    });

    return response.ok;
  } catch (error) {
    console.error("Delete user session error:", error);
    return false;
  }
}
