/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import * as msal from "@azure/msal-browser";

function getMsalConfig(): msal.Configuration {
  return {
    auth: {
      clientId: import.meta.env.PUBLIC_ENTRA_CLIENT_ID || "",
      authority: import.meta.env.PUBLIC_ENTRA_AUTHORITY || "https://sentineloptimizer.ciamlogin.com",
      redirectUri: import.meta.env.PUBLIC_ENTRA_REDIRECT_URI || (typeof window !== "undefined" ? window.location.origin : ""),
      postLogoutRedirectUri: typeof window !== "undefined" ? window.location.origin : "",
    },
    cache: {
      cacheLocation: "localStorage",
    },
  };
}

let msalInstance: msal.IPublicClientApplication | null = null;

export function initializeMsal(): msal.IPublicClientApplication {
  if (!msalInstance) {
    msalInstance = new msal.PublicClientApplication(getMsalConfig());
  }
  return msalInstance;
}

export async function login(): Promise<msal.AuthenticationResult | null> {
  try {
    const instance = initializeMsal();
    const result = await instance.loginPopup({
      scopes: [
        `api://${import.meta.env.PUBLIC_ENTRA_CLIENT_ID}/user-api`,
        "profile",
        "email",
        "openid",
      ],
    });
    return result;
  } catch (error) {
    console.error("Login failed:", error);
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    const instance = initializeMsal();
    await instance.logoutPopup();
  } catch (error) {
    console.error("Logout failed:", error);
  }
}

export function getAccount(): msal.AccountInfo | null {
  const instance = initializeMsal();
  const accounts = instance.getAllAccounts();
  return accounts.length > 0 ? accounts[0] : null;
}

export async function getAccessToken(scopes: string[]): Promise<string | null> {
  try {
    const instance = initializeMsal();
    const account = getAccount();
    if (!account) return null;

    const result = await instance.acquireTokenSilent({
      scopes,
      account,
    });
    return result.accessToken;
  } catch (error) {
    console.error("Token acquisition failed:", error);
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getAccount() !== null;
}

export function getUserDisplayName(): string {
  const account = getAccount();
  return account?.name || account?.username || "User";
}

export function getUserEmail(): string {
  const account = getAccount();
  return account?.username || account?.localAccountId || "";
}

export function getUserId(): string {
  const account = getAccount();
  return account?.localAccountId || "";
}

export async function hasAdminRole(): Promise<boolean> {
  const token = await getAccessToken([
    `api://${import.meta.env.PUBLIC_ENTRA_CLIENT_ID}/admin-api`,
  ]);
  if (!token) return false;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const decoded = JSON.parse(atob(parts[1]));
    return decoded.roles?.includes("admin") ?? false;
  } catch {
    return false;
  }
}
