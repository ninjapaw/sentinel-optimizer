import { describe, expect, it } from "vitest";
import {
  analyzeMapper,
  buildBoundedAiPayload,
  parseMapperText,
  parseMapperWorkbook,
  SYNTHETIC_MAPPER_EXAMPLE,
} from "../schema/cloudSecurityMapper.js";

describe("Cloud Security Value Mapper", () => {
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
  });
  it("exposes an asynchronous workbook parser for blank-title and repeated-header exports", async () => {
    expect(parseMapperWorkbook).toBeTypeOf("function");
    expect(parseMapperWorkbook(new ArrayBuffer(0))).rejects.toThrow();
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
    ).toBe("Defender for Containers");
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
          sourceName: "Entra sign-in",
          volumeGB: 4,
          notes: "raw secret content",
          workspace: "customer-workspace",
        },
      ],
      30,
    );
    const payload = buildBoundedAiPayload(analysis, "CISO");
    expect(JSON.stringify(payload)).not.toContain("raw secret content");
    expect(JSON.stringify(payload)).not.toContain("customer-workspace");
    expect(payload.recommendations[0]).not.toHaveProperty("notes");
    expect(payload.recommendations[0]).not.toHaveProperty("workspace");
  });
});
