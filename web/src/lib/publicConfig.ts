/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { USER_CONFIG } from "@shared/config/user.config.js";

function readPublicString(value: string | undefined, fallback: string): string {
  const configured = value?.trim();
  return configured || fallback;
}

export const PUBLIC_CONFIG = Object.freeze({
  site: Object.freeze({
    ...USER_CONFIG.site,
    name: readPublicString(import.meta.env.PUBLIC_SITE_NAME, USER_CONFIG.site.name),
    tagline: readPublicString(import.meta.env.PUBLIC_SITE_TAGLINE, USER_CONFIG.site.tagline),
    owner: readPublicString(import.meta.env.PUBLIC_SITE_OWNER, USER_CONFIG.site.owner),
    repository: readPublicString(
      import.meta.env.PUBLIC_SITE_REPOSITORY,
      USER_CONFIG.site.repository,
    ),
    productionUrl: readPublicString(
      import.meta.env.PUBLIC_SITE_URL,
      USER_CONFIG.site.productionUrl,
    ),
    defaultDescription: readPublicString(
      import.meta.env.PUBLIC_SITE_DESCRIPTION,
      USER_CONFIG.site.defaultDescription,
    ),
  }),
  brand: USER_CONFIG.brand,
});