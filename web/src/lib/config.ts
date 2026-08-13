/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { PUBLIC_CONFIG } from "./publicConfig.js";

export const CONFIG = Object.freeze({
  ...PUBLIC_CONFIG.site,
  repo: PUBLIC_CONFIG.site.repository,
  colors: PUBLIC_CONFIG.brand.colors,
});
