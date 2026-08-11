/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { describe, expect, it } from "vitest";
import { parseOptionalNumber } from "../web/src/lib/forms.js";

describe("web form utilities", () => {
  it("parses finite optional numbers", () => {
    expect(parseOptionalNumber(" 12.5 ")).toBe(12.5);
    expect(parseOptionalNumber(" ")).toBeUndefined();
    expect(parseOptionalNumber("not-a-number")).toBeUndefined();
  });

  it("enforces an optional minimum", () => {
    expect(parseOptionalNumber("0", 0)).toBe(0);
    expect(parseOptionalNumber("-1", 0)).toBeUndefined();
  });
});
