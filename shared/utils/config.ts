/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

export function parseCommaSeparated(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535
    ? parsed
    : fallback;
}

export function withoutHash(color: string): string {
  return color.startsWith("#") ? color.slice(1) : color;
}

export function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

export function trimTrailingSlashes(value: string): string {
  return value.trim().replace(/\/+$/, "");
}
