import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const catalogPath = resolve("config/cloud-security-mapper/catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const errors = [];
const evidenceClasses = new Set([
  "explicit-alert-description",
  "documented-detection-context",
  "public-category-guidance",
  "analyst-reasoned",
  "prior-guide-reference",
  "product-context-reasoned",
  "unknown",
]);
const confidenceValues = new Set(["High", "Medium", "Low", "Unknown"]);
const required = [
  "planOrProtection",
  "alertCategory",
  "alertName",
  "alertDescription",
  "severityValues",
  "previewStatus",
  "telemetryPlanes",
  "signalSources",
  "mappingBasis",
  "evidenceClass",
  "sourceUrl",
  "sourceTitle",
  "sourceTypes",
  "sourceLastReviewed",
  "confidence",
  "caveat",
  "normalizedWorkloadFamilies",
  "normalizedSourceFamilies",
  "applicableClouds",
];
const seenRows = new Set();
const seenNames = new Set();
for (const [index, entry] of (catalog.entries ?? []).entries()) {
  const label = `entry ${index + 1}`;
  for (const field of required) {
    if (
      entry[field] === undefined ||
      entry[field] === "" ||
      (Array.isArray(entry[field]) && entry[field].length === 0)
    ) {
      errors.push(`${label}: missing ${field}`);
    }
  }
  if (!evidenceClasses.has(entry.evidenceClass))
    errors.push(`${label}: unsupported evidenceClass`);
  if (!confidenceValues.has(entry.confidence))
    errors.push(`${label}: unsupported confidence`);
  if (!/^https:\/\/learn\.microsoft\.com\//.test(entry.sourceUrl ?? ""))
    errors.push(`${label}: sourceUrl must be Microsoft Learn HTTPS`);
  if (
    entry.evidenceClass !== "explicit-alert-description" &&
    entry.confidence === "High"
  ) {
    errors.push(
      `${label}: reasoned/non-explicit mapping cannot be High confidence without a reviewed override`,
    );
  }
  const rowKey = JSON.stringify([
    entry.planOrProtection,
    entry.alertCategory,
    entry.alertName,
    entry.sourceUrl,
  ]);
  if (seenRows.has(rowKey)) errors.push(`${label}: exact duplicate row`);
  seenRows.add(rowKey);
  const nameKey = `${entry.planOrProtection}|${entry.alertCategory}|${entry.alertName}`;
  if (seenNames.has(nameKey))
    errors.push(`${label}: duplicate alert name within plan/category`);
  seenNames.add(nameKey);
  if (
    /\b(very very|the the|alert alert|plan plan)\b/i.test(
      entry.alertDescription ?? "",
    )
  )
    errors.push(`${label}: repeated-word quality issue`);
}
if (
  !catalog.notice?.includes("planning aid") ||
  !catalog.notice?.includes("private detection implementation")
) {
  errors.push(
    "catalog notice must explain planning-aid and private-implementation limitations",
  );
}
if (errors.length) {
  console.error(
    `Cloud Security Value Mapper catalog validation failed:\n- ${errors.join("\n- ")}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${catalog.entries.length} catalog entries (${catalog.catalogVersion}).`,
  );
}
