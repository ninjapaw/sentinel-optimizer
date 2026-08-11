/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
