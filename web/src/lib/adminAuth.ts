/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import {
  PublicClientApplication,
  type AccountInfo,
  type AuthenticationResult,
  type Configuration,
} from "@azure/msal-browser";
import { IDENTITY_CONFIG } from "./identityConfig.js";

const { clientId, authority, apiScope } = IDENTITY_CONFIG;

export const adminAuthConfigured = IDENTITY_CONFIG.configured;
export const adminRole = IDENTITY_CONFIG.adminRole;

function getConfiguration(): Configuration | undefined {
  if (!adminAuthConfigured) return undefined;

  return {
    auth: {
      clientId,
      authority,
      redirectUri: typeof window !== "undefined" ? window.location.origin + "/admin" : "",
      postLogoutRedirectUri: typeof window !== "undefined" ? window.location.origin + "/admin" : "",
    },
    cache: {
      cacheLocation: "sessionStorage",
    },
  };
}

let application: PublicClientApplication | undefined = undefined;

function getApplication(): PublicClientApplication | undefined {
  if (!application && adminAuthConfigured) {
    const config = getConfiguration();
    if (config) {
      application = new PublicClientApplication(config);
    }
  }
  return application;
}

export interface AdminSession {
  account: AccountInfo;
  accessToken?: string;
  hasAdminRole: boolean;
}

export async function initializeAdminAuth(): Promise<AccountInfo | null> {
  const app = getApplication();
  if (!app) return null;
  await app.initialize();
  const result = await app.handleRedirectPromise();
  if (result?.account) app.setActiveAccount(result.account);
  return app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
}

export async function signInAdmin(): Promise<void> {
  const app = getApplication();
  if (!app) throw new Error("External ID admin authentication is not configured.");
  await app.loginRedirect({
    scopes: ["openid", "profile", "email"],
  });
}

export async function signOutAdmin(): Promise<void> {
  const app = getApplication();
  if (!app) return;
  await app.logoutRedirect();
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const app = getApplication();
  if (!app) return null;
  const account = app.getActiveAccount() ?? app.getAllAccounts()[0];
  if (!account) return null;

  const roles = Array.isArray(account.idTokenClaims?.roles)
    ? account.idTokenClaims.roles
    : [];
  const session: AdminSession = {
    account,
    hasAdminRole: roles.includes(adminRole),
  };

  if (apiScope) {
    const result: AuthenticationResult = await app.acquireTokenSilent({
      account,
      scopes: [apiScope],
    });
    session.accessToken = result.accessToken;
  }
  return session;
}
