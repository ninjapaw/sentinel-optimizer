/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { useEffect, useState } from "react";
import { login, logout, isAuthenticated, getUserDisplayName, hasAdminRole } from "../lib/auth.js";

export function LoginButton() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    setLoggedIn(isAuthenticated());
    if (isAuthenticated()) {
      setDisplayName(getUserDisplayName());
      hasAdminRole().then(setIsAdmin);
    }
  }, []);

  const handleLogin = async () => {
    const result = await login();
    if (result) {
      setLoggedIn(true);
      setDisplayName(getUserDisplayName());
      hasAdminRole().then(setIsAdmin);
    }
  };

  const handleLogout = async () => {
    await logout();
    setLoggedIn(false);
    setDisplayName("");
    setIsAdmin(false);
    setShowMenu(false);
  };

  if (!loggedIn) {
    return (
      <button onClick={handleLogin} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>
        Sign in
      </button>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        style={{
          padding: "0.5rem 1rem",
          cursor: "pointer",
          backgroundColor: "var(--color-teal, #30E5D0)",
          color: "var(--color-navy, #243A5E)",
          border: "none",
          borderRadius: "4px",
          fontWeight: "bold",
        }}
      >
        {displayName}
      </button>
      {showMenu && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            backgroundColor: "var(--color-white, #fff)",
            border: "1px solid var(--color-grey, #737373)",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            zIndex: 1000,
            minWidth: "180px",
          }}
        >
          <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #eee" }}>
            <div style={{ fontSize: "0.9rem", color: "#666" }}>{displayName}</div>
            <div style={{ fontSize: "0.8rem", color: "#999" }}>
              {isAdmin ? "Admin User" : "Regular User"}
            </div>
          </div>
          {isAdmin && (
            <a
              href="/admin"
              style={{
                display: "block",
                padding: "0.5rem 1rem",
                textDecoration: "none",
                color: "var(--color-blue, #0078D4)",
                borderBottom: "1px solid #eee",
                fontSize: "0.9rem",
              }}
              onClick={() => setShowMenu(false)}
            >
              Admin Console
            </a>
          )}
          <a
            href="/sessions"
            style={{
              display: "block",
              padding: "0.5rem 1rem",
              textDecoration: "none",
              color: "var(--color-blue, #0078D4)",
              borderBottom: "1px solid #eee",
              fontSize: "0.9rem",
            }}
            onClick={() => setShowMenu(false)}
          >
            My Sessions
          </a>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "0.5rem 1rem",
              border: "none",
              backgroundColor: "transparent",
              color: "var(--color-blue, #0078D4)",
              cursor: "pointer",
              textAlign: "left",
              fontSize: "0.9rem",
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
