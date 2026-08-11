/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

export function roundTo(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}
