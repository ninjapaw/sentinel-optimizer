/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly PUBLIC_ADMIN_API_BASE?: string;
	readonly PUBLIC_AI_API_BASE?: string;
	readonly PUBLIC_ENTRA_EXTERNAL_ID_ADMIN_ROLE?: string;
	readonly PUBLIC_ENTRA_EXTERNAL_ID_API_SCOPE?: string;
	readonly PUBLIC_ENTRA_EXTERNAL_ID_AUTHORITY?: string;
	readonly PUBLIC_ENTRA_EXTERNAL_ID_CLIENT_ID?: string;
	readonly PUBLIC_SITE_BASE?: string;
	readonly PUBLIC_SITE_DESCRIPTION?: string;
	readonly PUBLIC_SITE_NAME?: string;
	readonly PUBLIC_SITE_OWNER?: string;
	readonly PUBLIC_SITE_REPOSITORY?: string;
	readonly PUBLIC_SITE_TAGLINE?: string;
	readonly PUBLIC_SITE_URL?: string;
}
