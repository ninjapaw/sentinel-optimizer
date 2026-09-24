import { describe, expect, it } from "vitest";
import { isProtectionSummary } from "../shared/contracts/ai.js";
import {
  analyzeMapper,
  buildBoundedAiPayload,
  parseMapperText,
  parseMapperRows,
  parseMapperWorkbookSheets,
  PROTECTION_CATALOG,
  SYNTHETIC_MAPPER_EXAMPLE,
} from "../schema/cloudSecurityMapper.js";

describe("Cloud Security Value Mapper", () => {
  it("does not mistake product names or arbitrary alert labels for native alerts", () => {
    const analysis = analyzeMapper([
      { sourceName: "Defender configuration diagnostics" },
      { sourceName: "customer-alert-backup" },
      { sourceName: "SecurityAlert" },
    ], 30);
    expect(analysis.sources[0]?.detectionReadiness).toBe("Operational only");
    expect(analysis.sources[0]?.candidateDefenderPlans).toEqual([]);
    expect(analysis.sources[1]?.detectionReadiness).toBe("Requires validation");
    expect(analysis.sources[2]?.detectionReadiness).toBe("Native alert");
    expect(analysis.highConfidenceOpportunityCount).toBe(1);
  });

  it("finds deduplicated protection opportunities without claiming gaps or using volume as risk", () => {
    const analysis = analyzeMapper([
      { sourceName: "SigninLogs", volumeGB: 1 },
      { sourceName: "AKS audit", volumeGB: 2 },
      { sourceName: "AKS audit admin", volumeGB: 999 },
      { sourceName: "AppServiceHTTPLogs" },
      { sourceName: "ApiManagementGatewayLogs" },
      { sourceName: "PostgreSQLLogs" },
      { sourceName: "CDBDataPlaneRequests" },
      { sourceName: "DeviceProcessEvents" },
      { sourceName: "OfficeActivity" },
    ], 30);
    const opportunities = analysis.protectionOpportunities;
    expect(opportunities[0]?.id).toBe("identity");
    expect(opportunities.find((entry) => entry.id === "containers")?.sourceCount).toBe(2);
    expect(opportunities.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "apps", "apis", "databases", "endpoint", "m365", "posture", "correlation",
    ]));
    expect(opportunities.every((entry) => entry.coverage === "Not verified")).toBe(true);
    expect(analysis.sources.filter((source) => ["Open-source databases", "Cosmos DB"].includes(source.sourceFamily))
      .every((source) => source.candidateDefenderPlans.every((candidate) => !candidate.plan.includes("for SQL")))).toBe(true);
  });

  it("does not propose workload plans for unknown, generic, or identity-only data", () => {
    expect(analyzeMapper([], 30).protectionOpportunities).toEqual([]);
    expect(analyzeMapper([{ sourceName: "Mystery feed" }, { sourceName: "Diagnostics" }], 30).protectionOpportunities).toEqual([]);
    const identity = analyzeMapper([{ sourceName: "SigninLogs" }], 30);
    expect(identity.sources[0]?.candidateDefenderPlans).toEqual([]);
    expect(identity.protectionOpportunities.map((entry) => entry.id)).toEqual(["identity", "correlation"]);
    const edge = analyzeMapper([{ sourceName: "App Gateway access" }], 30);
    expect(edge.protectionOpportunities.map((entry) => entry.id)).not.toContain("apis");
  });

  it("exposes reviewed catalog provenance and conservative evidence classes", () => {
    expect(PROTECTION_CATALOG.entries.length).toBeGreaterThanOrEqual(9);
    expect(PROTECTION_CATALOG.notice).toContain("planning aid");
    expect(
      PROTECTION_CATALOG.entries.every((entry) =>
        entry.sourceUrl.startsWith("https://learn.microsoft.com/"),
      ),
    ).toBe(true);
    expect(
      PROTECTION_CATALOG.entries
        .filter((entry) => entry.evidenceClass !== "explicit-alert-description")
        .every((entry) => entry.confidence !== "High"),
    ).toBe(true);
  });
  it("parses CSV, TSV, JSON, and normalizes a window without treating missing volume as zero", () => {
    const csv = parseMapperText(
      "Source,Volume MB\nAKS audit,1000\nUnknown source,",
      "csv",
    );
    expect(csv.rows[0]?.volumeGB).toBe(1);
    expect(csv.rows[1]?.volumeGB).toBeUndefined();
    expect(
      parseMapperText("Source\tVolume TB\nStorage\t2", "tsv").rows[0]?.volumeGB,
    ).toBe(2000);
    expect(parseMapperText(SYNTHETIC_MAPPER_EXAMPLE, "json").rows).toHaveLength(
      8,
    );
    const quoted = parseMapperText(
      'Source,Volume GB,Notes\n"App Gateway access",2,"edge, WAF evidence"',
      "csv",
    );
    expect(quoted.rows[0]?.sourceName).toBe("App Gateway access");
    expect(quoted.rows[0]?.notes).toBe("edge, WAF evidence");
    const remapped = parseMapperRows(
      [{ Label: "AKS audit", Amount: 1000, Units: "MB" }],
      ["Label", "Amount", "Units"],
      { sourceName: "Label", volume: "Amount", unit: "Units" },
    );
    expect(remapped.rows[0]?.volumeGB).toBe(1);
  });
  it("handles a blank workbook title row and repeated headers", () => {
    const parsed = parseMapperWorkbookSheets([
      {
        sheet: "Usage",
        data: [
          ["Synthetic export"],
          [],
          ["Source", "Volume GB"],
          ["AKS audit", 3],
          ["Source", "Volume GB"],
          ["App Gateway access", 2],
        ],
      },
    ]);
    expect(parsed.selectedSheet).toBe("Usage");
    expect(parsed.rows.map((row) => row.sourceName)).toEqual([
      "AKS audit",
      "App Gateway access",
    ]);
  });
  it("maps App Gateway, AKS, identity, and unknown sources deterministically", () => {
    const analysis = analyzeMapper(
      parseMapperText(SYNTHETIC_MAPPER_EXAMPLE, "json").rows,
      30,
    );
    expect(
      analysis.sources.find(
        (source) => source.sourceName === "App Gateway firewall",
      )?.sourceFamily,
    ).toBe("Application Gateway / WAF");
    expect(
      analysis.sources.find((source) => source.sourceName === "AKS audit")
        ?.candidateDefenderPlans[0]?.plan,
    ).toBe("Microsoft Defender for Containers");
    expect(
      analysis.sources.find(
        (source) => source.sourceName === "Microsoft Graph activity",
      )?.roles,
    ).toContain("Identity activity");
    expect(
      analysis.sources.find(
        (source) => source.sourceName === "App Gateway access",
      )?.evidence,
    ).toContain("GB/day after window normalization");
    expect(
      analysis.sources.find((source) => source.sourceName === "AKS audit")
        ?.candidateProtectionMapping[0]?.evidenceClass,
    ).toBe("public-category-guidance");
    const unknown = analyzeMapper(
      [{ sourceName: "Mystery feed", volumeGB: 2 }],
      1,
    ).sources[0];
    expect(unknown?.detectionReadiness).toBe("Requires validation");
    expect(unknown?.recommendedSentinelTreatment).toBe(
      "Validate before changing",
    );
  });
  it("does not include raw rows or customer identifiers in the bounded AI contract", () => {
    // Privacy is part of the contract, so assert that sensitive fields stay out.
    const analysis = analyzeMapper(
      [
        {
          sourceName: "Entra sign-in customer-secret.example.com",
          volumeGB: 4,
          notes: "raw secret content",
          workspace: "customer-workspace",
        },
      ],
      30,
    );
    const payload = buildBoundedAiPayload(analysis, "CISO");
    expect(isProtectionSummary(payload)).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("raw secret content");
    expect(JSON.stringify(payload)).not.toContain("customer-workspace");
    expect(JSON.stringify(payload)).not.toContain("customer-secret.example.com");
    expect(payload.recommendations[0]).not.toHaveProperty("notes");
    expect(payload.recommendations[0]).not.toHaveProperty("workspace");
  });
});
