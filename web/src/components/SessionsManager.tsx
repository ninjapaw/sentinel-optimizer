/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { useEffect, useState } from "react";
import { isAuthenticated, getUserDisplayName } from "../lib/auth.js";
import {
  listSessions,
  loadSession,
  deleteSession,
  type SessionListItem,
} from "../lib/session-client.js";

export default function SessionsManager() {
  const [authenticated, setAuthenticated] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [pagination, setPagination] = useState({ offset: 0, limit: 50, total: 0 });

  useEffect(() => {
    const auth = isAuthenticated();
    setAuthenticated(auth);
    if (auth) {
      setDisplayName(getUserDisplayName());
      loadSessions();
    } else {
      setLoading(false);
    }
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    const result = await listSessions(pagination.limit, pagination.offset);
    if (result) {
      setSessions(result);
      setPagination((p) => ({ ...p, total: result.length }));
    } else {
      setMessage("Failed to load sessions");
    }
    setLoading(false);
  };

  const handleLoadSession = async (sessionId: string) => {
    const session = await loadSession(sessionId);
    if (session) {
      // Store in sessionStorage so the Optimizer can pick it up
      sessionStorage.setItem("loadSession", JSON.stringify(session));
      window.location.href = "/";
    } else {
      setMessage("Failed to load session");
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this session?")) return;
    if (await deleteSession(sessionId)) {
      setMessage("✓ Session deleted");
      await loadSessions();
      setTimeout(() => setMessage(""), 3000);
    } else {
      setMessage("✗ Failed to delete session");
    }
  };

  if (!authenticated) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
        <p>Please log in to view and manage your sessions.</p>
        <a href="/" style={{ color: "var(--color-blue, #0078D4)", textDecoration: "none" }}>
          Return to Optimizer
        </a>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading sessions...</div>;
  }

  return (
    <div style={{ maxWidth: "900px" }}>
      <div style={{ marginBottom: "2rem", padding: "1rem", backgroundColor: "#f9f9f9", borderRadius: "4px" }}>
        <p style={{ margin: "0 0 0.5rem 0", color: "#666" }}>
          <strong>User:</strong> {displayName}
        </p>
        <p style={{ margin: "0", color: "#666" }}>
          <strong>Total Sessions:</strong> {sessions.length}
        </p>
      </div>

      {message && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1rem",
            backgroundColor: message.includes("✗") ? "#fee" : "#efe",
            color: message.includes("✗") ? "#c33" : "#3c3",
            borderRadius: "4px",
            border: `1px solid ${message.includes("✗") ? "#fcc" : "#cfc"}`,
          }}
        >
          {message}
        </div>
      )}

      {sessions.length === 0 ? (
        <div
          style={{
            padding: "2rem",
            textAlign: "center",
            backgroundColor: "#f9f9f9",
            borderRadius: "4px",
            color: "#999",
          }}
        >
          <p>No saved sessions yet.</p>
          <a href="/" style={{ color: "var(--color-blue, #0078D4)", textDecoration: "none" }}>
            Go to Optimizer to save your first session
          </a>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
          {sessions.map((session) => (
            <div
              key={session.sessionId}
              style={{
                padding: "1rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
                backgroundColor: "#fff",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "start" }}>
                <div>
                  <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem" }}>{session.name}</h3>
                  {session.description && (
                    <p style={{ margin: "0 0 0.5rem 0", color: "#666", fontSize: "0.95rem" }}>
                      {session.description}
                    </p>
                  )}
                  <div style={{ fontSize: "0.85rem", color: "#999" }}>
                    <div>Created: {new Date(session.createdAt).toLocaleString()}</div>
                    <div>Updated: {new Date(session.updatedAt).toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", minWidth: "120px" }}>
                  <button
                    onClick={() => handleLoadSession(session.sessionId)}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "var(--color-blue, #0078D4)",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                    }}
                  >
                    Load
                  </button>
                  <button
                    onClick={() => handleDeleteSession(session.sessionId)}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "#fee",
                      color: "#c33",
                      border: "1px solid #fcc",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
