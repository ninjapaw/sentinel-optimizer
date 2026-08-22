const clientId = import.meta.env.PUBLIC_ENTRA_EXTERNAL_ID_CLIENT_ID?.trim() || "";
const authority = import.meta.env.PUBLIC_ENTRA_EXTERNAL_ID_AUTHORITY?.trim() || "";
const apiScope = import.meta.env.PUBLIC_ENTRA_EXTERNAL_ID_API_SCOPE?.trim() || "";

export const IDENTITY_CONFIG = Object.freeze({
  clientId,
  authority,
  apiScope,
  adminRole:
    import.meta.env.PUBLIC_ENTRA_EXTERNAL_ID_ADMIN_ROLE?.trim() ||
    "SentinelOptimizer.Admin",
  configured: Boolean(clientId && authority && apiScope),
});

const configuredApiOrigin =
  import.meta.env.PUBLIC_ADMIN_API_BASE?.trim() ||
  import.meta.env.PUBLIC_AI_API_BASE?.trim() ||
  "";

export const API_BASE = configuredApiOrigin
  ? `${configuredApiOrigin.replace(/\/+$/, "")}/api`
  : "/api";
