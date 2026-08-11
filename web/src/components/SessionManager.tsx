/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { useState, useEffect } from "react";
import { isAuthenticated } from "../lib/auth.js";
import {
  saveSession,
  listSessions,
  loadSession,
  deleteSession,
  type SessionListItem,
} from "../lib/session-client.js";

export interface SessionManagerProps {
  optimizerState: unknown;
  costBreakdown?: Record<string, unknown>;
  recommendations?: unknown[];
  onLoadSession?: (state: unknown) => void;
}

export function SessionManager({
  optimizerState,
  costBreakdown,
  recommendations,
  onLoadSession,
}: SessionManagerProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [sessionName, setSessionName] = useState("");
  const [sessionDescription, setSessionDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (showPanel && isAuthenticated()) {
      loadSessions();
    }
  }, [showPanel]);

  const loadSessions = async () => {
    setLoading(true);
    const result = await listSessions();
    if (result) {
      setSessions(result);
    }
    setLoading(false);
  };

  const handleSaveSession = async () => {
    if (!sessionName.trim()) {
      setMessage("Session name is required");
      return;
    }

    setSaving(true);
    setMessage("");

    const result = await saveSession({
      name: sessionName,
      description: sessionDescription,
      optimizerState,
      costBreakdown,
      recommendations,
    });

    if (result) {
      setMessage("✓ Session saved successfully");
      setSessionName("");
      setSessionDescription("");
      await loadSessions();
      setTimeout(() => setMessage(""), 3000);
    } else {
      setMessage("✗ Failed to save session");
    }
    setSaving(false);
  };

  const handleLoadSession = async (sessionId: string) => {
    const session = await loadSession(sessionId);
    if (session && onLoadSession) {
      onLoadSession(session.optimizerState);
      setShowPanel(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this session?")) return;
    const success = await deleteSession(sessionId);
    if (success) {
      await loadSessions();
    }
  };

  if (!isAuthenticated()) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        width: "400px",
        maxWidth: "100%",
        height: "100vh",
        backgroundColor: "var(--color-white, #fff)",
        boxShadow: "-2px 0 8px rgba(0,0,0,0.1)",
        transform: showPanel ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s ease",
        zIndex: 999,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "1rem", borderBottom: "1px solid #eee" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.25rem" }}>My Sessions</h2>
          <button
            onClick={() => setShowPanel(false)}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Save Current State</h3>
          <input
            type="text"
            placeholder="Session name (e.g., 'Production estimate')"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              marginBottom: "0.5rem",
              border: "1px solid #ddd",
              borderRadius: "4px",
              boxSizing: "border-box",
            }}
          />
          <textarea
            placeholder="Optional description"
            value={sessionDescription}
            onChange={(e) => setSessionDescription(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              marginBottom: "0.5rem",
              border: "1px solid #ddd",
              borderRadius: "4px",
              boxSizing: "border-box",
              minHeight: "60px",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={handleSaveSession}
            disabled={saving}
            style={{
              width: "100%",
              padding: "0.5rem",
              backgroundColor: "var(--color-teal, #30E5D0)",
              color: "var(--color-navy, #243A5E)",
              border: "none",
              borderRadius: "4px",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: "bold",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Session"}
          </button>
          {message && (
            <div
              style={{
                marginTop: "0.5rem",
                padding: "0.5rem",
                backgroundColor: message.includes("✗") ? "#fee" : "#efe",
                color: message.includes("✗") ? "#c33" : "#3c3",
                borderRadius: "4px",
                fontSize: "0.9rem",
              }}
            >
              {message}
            </div>
          )}
        </div>

        <div>
          <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
            Saved Sessions ({sessions.length})
          </h3>
          {loading ? (
            <p style={{ color: "#999" }}>Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p style={{ color: "#999" }}>No saved sessions yet</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "0.5rem",
              }}
            >
              {sessions.map((session) => (
                <div
                  key={session.sessionId}
                  style={{
                    padding: "0.75rem",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    backgroundColor: "#f9f9f9",
                  }}
                >
                  <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>
                    {session.name}
                  </div>
                  {session.description && (
                    <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "0.25rem" }}>
                      {session.description}
                    </div>
                  )}
                  <div style={{ fontSize: "0.8rem", color: "#999", marginBottom: "0.5rem" }}>
                    Updated: {new Date(session.updatedAt).toLocaleDateString()}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => handleLoadSession(session.sessionId)}
                      style={{
                        flex: 1,
                        padding: "0.4rem",
                        backgroundColor: "var(--color-blue, #0078D4)",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDeleteSession(session.sessionId)}
                      style={{
                        flex: 1,
                        padding: "0.4rem",
                        backgroundColor: "#fee",
                        color: "#c33",
                        border: "1px solid #fcc",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SessionManagerToggle() {
  return (
    <div style={{ display: "inline-block" }}>
      <button
        onClick={() => {
          const panel = document.querySelector("[data-session-panel]");
          if (panel) {
            const style = panel.getAttribute("style");
            panel.setAttribute(
              "style",
              (style || "").includes("translateX(0)") ? "transform: translateX(100%)" : "",
            );
          }
        }}
        style={{
          padding: "0.5rem 1rem",
          backgroundColor: "var(--color-teal, #30E5D0)",
          color: "var(--color-navy, #243A5E)",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        📁 Sessions
      </button>
    </div>
  );
}
