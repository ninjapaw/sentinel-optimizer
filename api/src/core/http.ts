/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { ApiResult } from "./contracts.js";
import { utf8ByteLength } from "../../../shared/index.js";

export type JsonReadResult =
  | { ok: true; value: unknown }
  | { ok: false; result: ApiResult };

export function result(body: Record<string, unknown>, status = 200): ApiResult {
  return { status, body };
}

export function readJson(rawBody: string, maxBytes: number): JsonReadResult {
  if (utf8ByteLength(rawBody) > maxBytes) {
    return { ok: false, result: result({ error: "Payload too large." }, 413) };
  }

  try {
    return { ok: true, value: JSON.parse(rawBody) as unknown };
  } catch {
    return { ok: false, result: result({ error: "Invalid JSON." }, 400) };
  }
}
