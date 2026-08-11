/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { describe, expect, it } from "vitest";
import { INTERNAL_CONFIG, USER_CONFIG } from "../shared/index.js";
import {
  ensureTrailingSlash,
  parseCommaSeparated,
  parsePort,
  trimTrailingSlashes,
  withoutHash,
} from "../shared/utils/config.js";

describe("shared project configuration", () => {
  it("keeps the public repository identity and API routes consistent", () => {
    expect(USER_CONFIG.site.repository).toBe("ninjapaw/sentinel-optimizer");
    expect(INTERNAL_CONFIG.api.routes.recommend).toBe("/api/recommend");
    expect(Object.isFrozen(USER_CONFIG.api)).toBe(true);
    expect(Object.isFrozen(INTERNAL_CONFIG.api.routes)).toBe(true);
  });

  it("normalizes comma-separated environment values", () => {
    expect(parseCommaSeparated(" one, two ,,three ")).toEqual([
      "one",
      "two",
      "three",
    ]);
    expect(parseCommaSeparated(undefined)).toEqual([]);
  });

  it("accepts valid ports and falls back for invalid values", () => {
    expect(parsePort("8080", 7071)).toBe(8080);
    expect(parsePort("0", 7071)).toBe(7071);
    expect(parsePort("70000", 7071)).toBe(7071);
    expect(parsePort("invalid", 7071)).toBe(7071);
  });

  it("converts CSS hex colors for document exporters", () => {
    expect(withoutHash("#30E5D0")).toBe("30E5D0");
    expect(withoutHash("30E5D0")).toBe("30E5D0");
  });

  it("normalizes URL boundary slashes", () => {
    expect(ensureTrailingSlash("https://example.test/api")).toBe(
      "https://example.test/api/",
    );
    expect(ensureTrailingSlash("/")).toBe("/");
    expect(trimTrailingSlashes(" https://example.test/api/// ")).toBe(
      "https://example.test/api",
    );
  });
});
