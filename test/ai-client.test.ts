/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { describe, expect, it } from "vitest";
import {
  rankSourcesWithoutNames,
  redactSourceNames,
} from "../shared/utils/privacy.js";

describe("AI client privacy boundary", () => {
  it("replaces source names with ranked placeholders", () => {
    const topSources = rankSourcesWithoutNames(
      [
        { name: "Customer-Secret-Firewall", gbPerDay: 3 },
        { name: "Private-Domain-Controller", gbPerDay: 7 },
      ],
      10,
    );

    expect(topSources).toEqual([
      { name: "Source 1", sharePct: 70 },
      { name: "Source 2", sharePct: 30 },
    ]);
    expect(JSON.stringify(topSources)).not.toContain("Customer-Secret");
    expect(JSON.stringify(topSources)).not.toContain("Private-Domain");
  });

  it("redacts source names embedded in recommendation titles", () => {
    const title = '"Customer-Secret-Firewall" drives 70% of your ingest';
    expect(
      redactSourceNames(title, [
        { name: "Customer-Secret-Firewall", gbPerDay: 7 },
        { name: "", gbPerDay: 0 },
      ]),
    ).toBe('"source" drives 70% of your ingest');
  });
});
