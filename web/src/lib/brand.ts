/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { CONFIG } from "./config.js";
import { withoutHash } from "@shared/utils/config.js";

export const BRAND = {
  name: CONFIG.name,
  tagline: CONFIG.tagline,
  owner: CONFIG.owner,
  repo: CONFIG.repo,

  navy: withoutHash(CONFIG.colors.sentinelNavy),
  teal: withoutHash(CONFIG.colors.sentinelTeal),
  blue: withoutHash(CONFIG.colors.blue),
  cyan: withoutHash(CONFIG.colors.cyan),
  green: withoutHash(CONFIG.colors.green),
  lime: withoutHash(CONFIG.colors.lime),
  amber: withoutHash(CONFIG.colors.amber),
  purple: withoutHash(CONFIG.colors.purple),
  ink: withoutHash(CONFIG.colors.ink),
  grey: withoutHash(CONFIG.colors.grey),
  light: withoutHash(CONFIG.colors.light),
  white: withoutHash(CONFIG.colors.white),

  sentinelTeal: CONFIG.colors.sentinelTeal,
  sentinelNavy: CONFIG.colors.sentinelNavy,
  colorBlue: CONFIG.colors.blue,
  colorCyan: CONFIG.colors.cyan,
  colorGreen: CONFIG.colors.green,
  colorAmber: CONFIG.colors.amber,
} as const;
