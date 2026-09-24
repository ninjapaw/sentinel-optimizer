import type { MapperAnalysis } from "../../../schema/cloudSecurityMapper.js";
import { PROTECTION_CATALOG } from "../../../schema/cloudSecurityMapper.js";

export type MapperReportAudience =
  "CISO" | "SOC leader" | "Technical architecture";

const disclaimer =
  "Independent community planning tool. Not a Microsoft assessment, quote, licensing determination, private detection implementation description, or guaranteed savings statement.";

function linesFor(
  audience: MapperReportAudience,
  analysis: MapperAnalysis,
): string[] {
  const sources = analysis.sources.slice(0, 12);
  const lead =
    audience === "CISO"
      ? "Focus: decision context, risk, unknowns, and validation priorities."
      : audience === "SOC leader"
        ? "Focus: detection dependencies, investigation value, and proof-of-concept motions."
        : "Focus: telemetry planes, Sentinel treatment, workload scope, and control dependencies.";
  return [
    lead,
    `Observed scale: ${analysis.totalGBPerDay.toFixed(2)} GB/day across ${analysis.sources.length} sources.`,
    `Top-three concentration: ${analysis.concentrationPct.toFixed(2)}%. Unknown sources: ${analysis.unknownCount}.`,
    "Required message: collection does not by itself prove that a detection, alert, or incident exists.",
    "",
    "Protection opportunities (suggested review order, not incident severity)",
    "Candidate improvements, not confirmed gaps. Coverage is not verified. Check existing controls, licensing, scope, and cost before enabling anything.",
    ...analysis.protectionOpportunities.flatMap((opportunity) => [
      opportunity.solution,
      `Evidence: ${opportunity.sourceCount} source rows in ${opportunity.evidenceFamilies.join(", ")}.`,
      `Potential benefit: ${opportunity.benefit}`,
      `Next step: ${opportunity.nextStep}`,
      `Validate: ${opportunity.validation}`,
      `Coverage: ${opportunity.coverage}; mapping confidence: ${opportunity.confidence}.`,
      `Reference: ${opportunity.sourceUrl}`,
      "",
    ]),
    "Leading telemetry and candidate mappings",
    ...sources.flatMap((source) => [
      `${source.normalizedSourceName} | ${source.sourceFamily} | ${source.volumeGB === undefined ? "Volume not supplied" : `${source.observedGBPerDay.toFixed(2)} GB/day`} | ${source.securityValue} | ${source.detectionReadiness}`,
      `Treatment: ${source.recommendedSentinelTreatment}; confidence: ${source.confidence}; validation: ${source.validationState}.`,
      `Evidence: ${source.evidence}`,
      `Discovery: ${source.discoveryQuestions.join("; ")}`,
      `POC: ${source.pocScenarios.join(" ")}`,
      "",
    ]),
    "Catalog provenance",
    `Catalog version: ${PROTECTION_CATALOG.catalogVersion}; snapshot: ${PROTECTION_CATALOG.snapshotDate}.`,
    PROTECTION_CATALOG.notice,
    "Public alert references may omit recently added alerts. Alerts depend on protected resources and services and their configuration. Validate current availability, preview/deprecated status, severity, plan status, and resource scope.",
    "",
    disclaimer,
  ];
}

export async function exportCloudSecurityReport(
  analysis: MapperAnalysis,
  audience: MapperReportAudience,
  customerLabel = "",
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const title =
    audience === "CISO"
      ? "Cloud Security Value Assessment"
      : `Cloud Security Value Mapper - ${audience} Report`;
  doc.setFontSize(18);
  doc.text(title, 20, 24);
  doc.setFontSize(9);
  doc.text(
    customerLabel
      ? `Report label: ${customerLabel}`
      : "Report label: not provided",
    20,
    32,
  );
  doc.text(`Generated: ${new Date().toISOString().slice(0, 10)}`, 20, 38);
  doc.setFontSize(8);
  let y = 50;
  for (const line of linesFor(audience, analysis)) {
    const wrapped = doc.splitTextToSize(line, 170) as string[];
    for (const part of wrapped) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(part, 20, y);
      y += 5;
    }
    y += 1;
  }
  const slug = audience.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  doc.save(`cloud-security-value-${slug}-report.pdf`);
}
