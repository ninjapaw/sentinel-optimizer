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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
