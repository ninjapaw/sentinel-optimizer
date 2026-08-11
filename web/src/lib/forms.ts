/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

export function parseOptionalNumber(
  value: string,
  minimum = Number.NEGATIVE_INFINITY,
): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : undefined;
}
