/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { useEffect, useState } from "react";
import {
  adminAuthConfigured,
  adminRole,
  getAdminSession,
  initializeAdminAuth,
  signInAdmin,
  signOutAdmin,
  type AdminSession,
} from "../lib/adminAuth.js";

const adminApiBase =
  import.meta.env.PUBLIC_ADMIN_API_BASE?.trim().replace(/\/+$/, "") || "";

export default function AdminConsole() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [status, setStatus] = useState("Checking authentication...");
  const [apiStatus, setApiStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void initializeAdminAuth()
      .then(() => getAdminSession())
      .then((value) => {
        if (!active) return;
        setSession(value);
        setStatus(value ? "Signed in" : "Not signed in");
      })
      .catch(() => {
        if (active) setStatus("Authentication could not be initialized.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function checkAdminApi() {
    if (!session?.accessToken || !adminApiBase) {
      setApiStatus("Configure the admin API scope and URL before testing access.");
      return;
    }
    const response = await fetch(`${adminApiBase}/api/admin/health`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    setApiStatus(response.ok ? "Admin API authorization succeeded." : "Admin API denied access.");
  }

  if (!adminAuthConfigured) {
    return <p>External ID admin authentication is not configured for this build.</p>;
  }

  if (!session) {
    return (
      <section>
        <p>{status}</p>
        <button type="button" onClick={() => void signInAdmin()}>
          Sign in with External ID
        </button>
      </section>
    );
  }

  return (
    <section>
      <p>{session.account.username || session.account.name || "Authenticated user"}</p>
      {session.hasAdminRole ? (
        <>
          <p>Admin role confirmed: {adminRole}</p>
          <button type="button" onClick={() => void checkAdminApi()}>
            Check admin API access
          </button>
          {apiStatus && <p>{apiStatus}</p>}
        </>
      ) : (
        <p>Your account is authenticated but does not have the required admin role.</p>
      )}
      <button type="button" onClick={() => void signOutAdmin()}>
        Sign out
      </button>
    </section>
  );
}
