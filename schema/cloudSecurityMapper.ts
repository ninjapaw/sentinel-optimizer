export type TelemetryRole =
  | "Native security alert or finding"
  | "Detection-ready security telemetry"
  | "Raw investigative evidence"
  | "Identity activity"
  | "Network or edge security telemetry"
  | "Workload audit telemetry"
  | "Administrative or control-plane activity"
  | "Policy or compliance activity"
  | "Operational, health, metric, or diagnostic telemetry"
  | "Unknown or requires validation";
export type SecurityValue =
  "High" | "Medium" | "Contextual" | "Operational" | "Unknown";
export type DetectionReadiness =
  | "Native alert"
  | "Direct detection input"
  | "Requires analytic rule"
  | "Hunting or forensic value"
  | "Operational only"
  | "Requires validation";
export type SentinelTreatment =
  | "Analytics candidate"
  | "Data Lake candidate"
  | "Summary or transformed Analytics candidate"
  | "Alert-only ingestion candidate"
  | "Retain outside Sentinel candidate"
  | "Validate before changing"
  | "Unknown";

export interface MapperRow {
  sourceName: string;
  date?: string;
  volumeGB?: number;
  eventCount?: number;
  notes?: string;
  currentRecommendation?: string;
  workspace?: string;
  currentTier?: string;
}
export interface MapperIssue {
  message: string;
  affectedRows: number;
  field?: string;
}
export interface FieldMapping {
  sourceName?: string;
  date?: string;
  volume?: string;
  eventCount?: string;
  notes?: string;
  currentRecommendation?: string;
  workspace?: string;
  currentTier?: string;
}
export interface ParsedMapperInput {
  rows: MapperRow[];
  headers: string[];
  mapping: FieldMapping;
  issues: MapperIssue[];
  sheetNames?: string[];
  selectedSheet?: string;
}
export interface DefenderCandidate {
  plan: string;
  rationale: string;
  provides: string;
  doesNotProve: string;
  validate: string;
  confidence: "High" | "Medium" | "Low";
}
export interface MappedSource extends MapperRow {
  normalizedSourceName: string;
  sourceFamily: string;
  observedGBPerDay: number;
  sharePct: number;
  roles: TelemetryRole[];
  securityValue: SecurityValue;
  detectionReadiness: DetectionReadiness;
  recommendedSentinelTreatment: SentinelTreatment;
  rationale: string;
  evidence: string;
  confidence: "High" | "Medium" | "Low";
  assumptions: string[];
  validationQuestions: string[];
  pocScenario: string;
  candidateDefenderPlans: DefenderCandidate[];
}
export interface MapperAnalysis {
  sources: MappedSource[];
  totalGBPerDay: number;
  analysisWindowDays: number;
  concentrationPct: number;
  unknownCount: number;
  highConfidenceOpportunityCount: number;
  generatedAt: string;
}

const aliases: Record<keyof FieldMapping, string[]> = {
  sourceName: [
    "source",
    "sourcename",
    "table",
    "tablename",
    "datatype",
    "data type",
    "logtype",
    "log type",
    "name",
  ],
  date: ["date", "eventdate", "timegenerated", "timestamp", "day"],
  volume: [
    "volume",
    "volumegb",
    "volume gb",
    "volume mb",
    "volume tb",
    "volume bytes",
    "bytes",
    "mb",
    "gb",
    "tb",
    "quantitymb",
    "quantity",
  ],
  eventCount: ["eventcount", "event count", "events", "count", "records"],
  notes: ["notes", "note", "comment", "comments"],
  currentRecommendation: [
    "currentrecommendation",
    "current recommendation",
    "recommendation",
    "action",
  ],
  workspace: ["workspace", "workspaceid", "workspace name"],
  currentTier: ["currenttier", "current tier", "tier", "plan", "retention"],
};

function key(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u005f\u002d]/g, " ")
    .replace(/\s+/g, " ");
}
function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value.replace(/,/g, "").replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}
function headerMapping(headers: string[]): FieldMapping {
  const result: FieldMapping = {};
  for (const header of headers) {
    const normalized = key(header);
    for (const field of Object.keys(aliases) as (keyof FieldMapping)[]) {
      if (aliases[field].some((alias) => key(alias) === normalized)) {
        result[field] ??= header;
        break;
      }
    }
  }
  return result;
}
function headerIndex(lines: string[][]): number {
  // Exported workbooks often put a title or blank rows before the real header.
  const found = lines.findIndex((line) => {
    const mapping = headerMapping(line);
    return Boolean(
      mapping.sourceName && (mapping.volume || mapping.eventCount),
    );
  });
  return found >= 0 ? found : 0;
}
function cell(
  row: Record<string, unknown>,
  header: string | undefined,
): unknown {
  return header === undefined ? undefined : row[header];
}
function volumeGB(
  value: unknown,
  header: string | undefined,
): number | undefined {
  const n = numberValue(value);
  if (n === undefined) return undefined;
  // Keep missing values missing instead of silently converting them to zero.
  const h = key(header ?? "");
  if (h.includes("byte")) return n / 1_000_000_000;
  if (h === "mb" || h.includes("mb")) return n / 1_000;
  if (h === "tb" || h.includes("tb")) return n * 1_000;
  return n;
}

export function parseMapperRows(
  rows: Record<string, unknown>[],
  headers = Object.keys(rows[0] ?? {}),
): ParsedMapperInput {
  const mapping = headerMapping(headers);
  const issues: MapperIssue[] = [];
  if (!mapping.sourceName)
    issues.push({
      message: "A source or table column is required.",
      affectedRows: rows.length,
      field: "sourceName",
    });
  if (!mapping.volume && !mapping.eventCount)
    issues.push({
      message:
        "Add a volume column (bytes, MB, GB, or TB) or an event count column.",
      affectedRows: rows.length,
      field: "volume",
    });
  const parsed = rows.map((row) => {
    const source = cell(row, mapping.sourceName);
    const volume = volumeGB(cell(row, mapping.volume), mapping.volume);
    const events = numberValue(cell(row, mapping.eventCount));
    return {
      sourceName:
        typeof source === "string" ? source.trim() : String(source ?? ""),
      ...(typeof cell(row, mapping.date) === "string" && cell(row, mapping.date)
        ? { date: String(cell(row, mapping.date)) }
        : {}),
      ...(volume !== undefined ? { volumeGB: volume } : {}),
      ...(events !== undefined ? { eventCount: events } : {}),
      ...(cell(row, mapping.notes) !== undefined
        ? { notes: String(cell(row, mapping.notes)) }
        : {}),
      ...(cell(row, mapping.currentRecommendation) !== undefined
        ? {
            currentRecommendation: String(
              cell(row, mapping.currentRecommendation),
            ),
          }
        : {}),
      ...(cell(row, mapping.workspace) !== undefined
        ? { workspace: String(cell(row, mapping.workspace)) }
        : {}),
      ...(cell(row, mapping.currentTier) !== undefined
        ? { currentTier: String(cell(row, mapping.currentTier)) }
        : {}),
    } satisfies MapperRow;
  });
  const missingSource = parsed.filter((row) => !row.sourceName).length;
  const missingVolume = parsed.filter(
    (row) => row.volumeGB === undefined && row.eventCount === undefined,
  ).length;
  if (missingSource)
    issues.push({
      message: "Some rows have no source name and were kept for review.",
      affectedRows: missingSource,
      field: "sourceName",
    });
  if (missingVolume)
    issues.push({
      message:
        "Some rows have no volume or event count; they were not treated as zero.",
      affectedRows: missingVolume,
      field: "volume",
    });
  return { rows: parsed, headers, mapping, issues };
}

export function parseMapperText(
  text: string,
  format: "csv" | "tsv" | "json",
): ParsedMapperInput {
  if (format === "json") {
    const value: unknown = JSON.parse(text);
    const rows = Array.isArray(value)
      ? value
      : value && typeof value === "object"
        ? Object.values(value as Record<string, unknown>).find(Array.isArray)
        : undefined;
    if (
      !Array.isArray(rows) ||
      !rows.every(
        (row) => row && typeof row === "object" && !Array.isArray(row),
      )
    )
      throw new Error("Expected a JSON array of usage objects.");
    return parseMapperRows(rows as Record<string, unknown>[]);
  }
  const separator = format === "tsv" ? "\t" : ",";
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 2)
    throw new Error("Expected a header row and at least one data row.");
  const split = (line: string): string[] => {
    const values: string[] = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === separator && !quoted) {
        values.push(value.trim());
        value = "";
      } else {
        value += character;
      }
    }
    values.push(value.trim());
    return values;
  };
  const parts = lines.map(split);
  const start = headerIndex(parts);
  const headers = parts[start] ?? [];
  const rows = parts
    .slice(start + 1)
    .filter(
      (values) =>
        !values.every((value) => !value) &&
        values.join("\u0001") !== headers.join("\u0001"),
    )
    .map((values) =>
      Object.fromEntries(
        headers.map((header, index) => [header, values[index] ?? ""]),
      ),
    );
  return parseMapperRows(rows, headers);
}

export interface MapperWorkbookSheet {
  sheet: string;
  data: unknown[][];
}

export function parseMapperWorkbookSheets(
  sheets: MapperWorkbookSheet[],
  sheetName?: string,
): ParsedMapperInput {
  const sheetNames = sheets.map((sheet) => sheet.sheet);
  const selected = sheetName ?? sheetNames[0];
  if (!selected) throw new Error("The workbook has no worksheets.");
  const sheet = sheets.find((candidate) => candidate.sheet === selected);
  if (!sheet) throw new Error(`Worksheet '${selected}' was not found.`);
  const values: unknown[][] = sheet.data.map((row) => [...row]);
  const start = headerIndex(
    values.map((row) => row.map((value) => String(value ?? ""))),
  );
  const headers = (values[start] ?? []).map((value) => String(value ?? ""));
  const rows = values
    .slice(start + 1)
    .filter(
      (row) =>
        row.some((value) => value !== undefined && value !== "") &&
        row.map((value) => String(value ?? "")).join("\u0001") !==
          headers.join("\u0001"),
    )
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index]])),
    );
  const parsed = parseMapperRows(rows);
  return { ...parsed, sheetNames, selectedSheet: selected };
}

const sourceCatalog: Array<{
  match: RegExp;
  family: string;
  roles: TelemetryRole[];
  plans: string[];
}> = [
  {
    match: /applicationgateway|app gateway|frontdoor|waf/,
    family: "Application Gateway / WAF",
    roles: ["Network or edge security telemetry"],
    plans: ["Defender for APIs", "Defender for Servers"],
  },
  {
    match: /kube|kubernetes|aks/,
    family: "AKS / Kubernetes",
    roles: ["Workload audit telemetry"],
    plans: ["Defender for Containers"],
  },
  {
    match:
      /graph|signin|sign-in|serviceprincipal|managedidentity|auditlogs|entra|aad/,
    family: "Identity and Microsoft Graph",
    roles: ["Identity activity"],
    plans: ["Defender for Resource Manager", "Defender for APIs"],
  },
  {
    match: /keyvault|key vault/,
    family: "Key Vault",
    roles: ["Administrative or control-plane activity"],
    plans: ["Defender for Key Vault"],
  },
  {
    match: /sql|database|mysql|postgres|cosmos/,
    family: "Database",
    roles: ["Workload audit telemetry"],
    plans: ["Defender for SQL or applicable database plans"],
  },
  {
    match: /storage|blob|file/,
    family: "Storage",
    roles: ["Workload audit telemetry"],
    plans: ["Defender for Storage"],
  },
  {
    match: /server|vm|syslog|windows|securityevent/,
    family: "Servers",
    roles: ["Detection-ready security telemetry"],
    plans: ["Defender for Servers"],
  },
  {
    match: /policy|compliance|resourcegraph/,
    family: "Policy and compliance",
    roles: ["Policy or compliance activity"],
    plans: ["Defender for Resource Manager"],
  },
  {
    match: /metric|diagnostic|health|performance/,
    family: "Operational diagnostics",
    roles: ["Operational, health, metric, or diagnostic telemetry"],
    plans: ["Validate before mapping"],
  },
];
function questions(family: string): string[] {
  if (family === "Application Gateway / WAF")
    return [
      "Which analytics rules consume these logs?",
      "Which incidents were generated from them during the selected period?",
      "What resources sit behind the gateway?",
      "Which workload protections are currently enabled?",
    ];
  if (family === "AKS / Kubernetes")
    return [
      "Which audit-event detections are deployed?",
      "Is runtime container protection enabled?",
      "Are image-vulnerability, posture, identity, and runtime findings correlated?",
      "What percentage of the source supports deployed detections?",
    ];
  if (family === "Identity and Microsoft Graph")
    return [
      "Which unusual identity and high-risk Graph detections are deployed?",
      "How are service-principal events correlated with cloud-resource changes?",
      "Which workload findings are joined to identity activity?",
    ];
  return [
    "Which detections consume this source?",
    "What customer control or workload does it represent?",
    "What finding or incident evidence should be validated before changing treatment?",
  ];
}
function classify(row: MapperRow, sharePct: number): MappedSource {
  const normalized = row.sourceName.trim();
  const catalog = sourceCatalog.find((entry) =>
    entry.match.test(normalized.toLowerCase()),
  );
  // Unknown sources stay conservative instead of inheriting meaning from a keyword.
  const family = catalog?.family ?? "Unknown source";
  const roles = catalog?.roles ?? ["Unknown or requires validation"];
  const native = /alert|incident|securityfinding|defender/i.test(normalized);
  const securityValue: SecurityValue = native
    ? "High"
    : catalog
      ? roles.includes("Operational, health, metric, or diagnostic telemetry")
        ? "Operational"
        : "Contextual"
      : "Unknown";
  const detectionReadiness: DetectionReadiness = native
    ? "Native alert"
    : catalog
      ? roles.includes("Operational, health, metric, or diagnostic telemetry")
        ? "Operational only"
        : "Requires analytic rule"
      : "Requires validation";
  const treatment: SentinelTreatment = native
    ? "Alert-only ingestion candidate"
    : catalog
      ? detectionReadiness === "Operational only"
        ? "Data Lake candidate"
        : "Analytics candidate"
      : "Validate before changing";
  const confidence: "High" | "Medium" | "Low" = catalog
    ? native
      ? "High"
      : "Medium"
    : "Low";
  const plans = (catalog?.plans ?? []).map((plan) => ({
    plan,
    rationale: `The ${family} source suggests a possible workload protection conversation.`,
    provides:
      "Workload-aware posture, detection, or findings may complement the observed telemetry.",
    doesNotProve:
      "Telemetry collection does not prove that this plan is enabled or disabled, nor that a finding exists.",
    validate:
      "Verify protected resources, plan status, coverage, and existing detections with the customer.",
    confidence,
  }));
  return {
    ...row,
    normalizedSourceName: normalized,
    sourceFamily: family,
    observedGBPerDay: row.volumeGB ?? 0,
    sharePct,
    roles,
    securityValue,
    detectionReadiness,
    recommendedSentinelTreatment: treatment,
    rationale: `${treatment} is a candidate based on ${family} classification and observed volume; it is not an automatic production change.`,
    evidence: `${row.volumeGB === undefined ? "No volume was supplied" : `${row.volumeGB.toFixed(2)} GB/day after window normalization`} and ${row.eventCount === undefined ? "no event count" : `${row.eventCount} events`}.`,
    confidence,
    assumptions: [
      "Source name is a usable log-family or table label.",
      "Observed volume is representative of the selected analysis window.",
    ],
    validationQuestions: questions(family),
    pocScenario:
      family === "Application Gateway / WAF"
        ? "Correlate a WAF event with identity, API, server, container, database, or workload security evidence."
        : family === "AKS / Kubernetes"
          ? "Correlate suspicious Kubernetes control-plane behavior with container, identity, vulnerability, and runtime evidence."
          : family === "Identity and Microsoft Graph"
            ? "Correlate unusual identity or Graph activity with cloud-resource changes and workload findings."
            : "Select a representative event and verify its correlation with a security finding or incident.",
    candidateDefenderPlans: plans,
  };
}
export function analyzeMapper(
  rows: MapperRow[],
  analysisWindowDays: number,
): MapperAnalysis {
  const days = Math.max(1, Math.round(analysisWindowDays));
  const total = rows.reduce((sum, row) => sum + (row.volumeGB ?? 0), 0);
  const sources = rows
    .map((row) => {
      const normalizedRow: MapperRow =
        row.volumeGB === undefined
          ? { ...row }
          : { ...row, volumeGB: row.volumeGB / days };
      return classify(
        normalizedRow,
        total > 0 ? ((row.volumeGB ?? 0) / total) * 100 : 0,
      );
    })
    .sort((a, b) => b.observedGBPerDay - a.observedGBPerDay);
  return {
    sources,
    totalGBPerDay: total / days,
    analysisWindowDays: days,
    concentrationPct: sources
      .slice(0, 3)
      .reduce((sum, source) => sum + source.sharePct, 0),
    unknownCount: sources.filter((source) => source.confidence === "Low")
      .length,
    highConfidenceOpportunityCount: sources.filter(
      (source) =>
        source.confidence === "High" ||
        source.candidateDefenderPlans.length > 0,
    ).length,
    generatedAt: new Date().toISOString(),
  };
}
export const SYNTHETIC_MAPPER_EXAMPLE = JSON.stringify(
  [
    {
      Source: "App Gateway access",
      "Volume GB": 18,
      "Event Count": 240000,
      Notes: "Synthetic example",
    },
    { Source: "App Gateway firewall", "Volume GB": 7, "Event Count": 42000 },
    { Source: "AKS audit", "Volume GB": 12, "Event Count": 110000 },
    { Source: "AKS audit admin", "Volume GB": 4, "Event Count": 19000 },
    { Source: "Microsoft Graph activity", "Volume GB": 2, "Event Count": 8000 },
    { Source: "Entra sign-in", "Volume GB": 6, "Event Count": 76000 },
    { Source: "Key Vault audit", "Volume GB": 3, "Event Count": 17000 },
    { Source: "Azure Policy activity", "Volume GB": 1, "Event Count": 3000 },
  ],
  null,
  2,
);
export function buildBoundedAiPayload(
  analysis: MapperAnalysis,
  audience: "CISO" | "SOC leader" | "Security architect",
) {
  // Rebuild the contract from derived fields; never serialize the original rows.
  return {
    version: "1",
    audience,
    tone: "clear and cautious",
    totalGBPerDay: Number(analysis.totalGBPerDay.toFixed(2)),
    sourceCount: analysis.sources.length,
    telemetryRoleAggregates: Object.fromEntries(
      [...new Set(analysis.sources.flatMap((source) => source.roles))].map(
        (role) => [
          role,
          analysis.sources.filter((source) => source.roles.includes(role))
            .length,
        ],
      ),
    ),
    recommendations: analysis.sources.slice(0, 10).map((source) => ({
      sourceName: source.normalizedSourceName,
      treatment: source.recommendedSentinelTreatment,
      defenderPlans: source.candidateDefenderPlans.map(
        (candidate) => candidate.plan,
      ),
      evidence: source.evidence,
      confidence: source.confidence,
      assumptions: source.assumptions,
    })),
    windowDays: analysis.analysisWindowDays,
  };
}
