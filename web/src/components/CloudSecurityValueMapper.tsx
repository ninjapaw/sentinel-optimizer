import { useMemo, useRef, useState } from "react";
import {
  analyzeMapper,
  buildBoundedAiPayload,
  parseMapperRows,
  parseMapperText,
  parseMapperWorkbook,
  SYNTHETIC_MAPPER_EXAMPLE,
  type MappedSource,
  type ParsedMapperInput,
  type FieldMapping,
} from "../lib/cloudSecurityMapper.js";
import {
  exportCloudSecurityReport,
  type MapperReportAudience,
} from "../lib/cloudSecurityMapperReports.js";
import { PROTECTION_CATALOG } from "../../../schema/cloudSecurityMapper.js";

function buildQuery(windowDays: number): string {
  return `Usage\n| where TimeGenerated > ago(${windowDays}d)\n| where IsBillable == true\n| summarize QuantityMB = sum(Quantity) by DataType\n| order by QuantityMB desc`;
}

function format(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const mappingFields: (keyof FieldMapping)[] = [
  "sourceName",
  "date",
  "volume",
  "unit",
  "eventCount",
  "notes",
  "currentRecommendation",
  "workspace",
  "currentTier",
];

export default function CloudSecurityValueMapper() {
  const [parsed, setParsed] = useState<ParsedMapperInput | null>(null);
  const [analysis, setAnalysis] = useState<ReturnType<
    typeof analyzeMapper
  > | null>(null);
  const [windowDays, setWindowDays] = useState(30);
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<MappedSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [customerLabel, setCustomerLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const payloadPreview = useMemo(
    () =>
      analysis
        ? JSON.stringify(buildBoundedAiPayload(analysis, "CISO"), null, 2)
        : "",
    [analysis],
  );

  function accept(next: ParsedMapperInput, message?: string) {
    setParsed(next);
    setAnalysis(null);
    setSelected(null);
    setError(null);
    setNotice(message ?? null);
  }
  function parseText(format: "csv" | "tsv" | "json") {
    try {
      accept(parseMapperText(text, format));
    } catch (cause) {
      setError(`Could not parse this input: ${(cause as Error).message}`);
    }
  }
  function analyze() {
    if (!parsed) {
      setError(
        "Provide a file, paste query results, or load the synthetic example first.",
      );
      return;
    }
    if (
      parsed.issues.some(
        (issue) =>
          issue.field === "sourceName" &&
          issue.affectedRows === parsed.rows.length,
      )
    ) {
      setError("Map a source or table column before analyzing.");
      return;
    }
    setAnalysis(analyzeMapper(parsed.rows, windowDays));
    setNotice(
      "Deterministic analysis complete. Recommendations are candidates for customer validation, not production changes.",
    );
  }
  function updateMapping(field: keyof FieldMapping, value: string) {
    if (!parsed) return;
    const nextMapping = { ...parsed.mapping };
    if (value) nextMapping[field] = value;
    else delete nextMapping[field];
    setParsed(parseMapperRows(parsed.rawRows, parsed.headers, nextMapping));
    setAnalysis(null);
    setSelected(null);
  }
  function clear() {
    // Discard every mapper-owned value; analysis never uses browser persistence.
    setParsed(null);
    setAnalysis(null);
    setSelected(null);
    setText("");
    setError(null);
    setNotice("Analysis cleared from this browser session.");
  }
  async function copyQuery() {
    try {
      await navigator.clipboard.writeText(buildQuery(windowDays));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(
        "Clipboard access was unavailable. Select the query and copy it manually.",
      );
    }
  }
  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5_000_000) {
      setError("Files are limited to 5 MB.");
      return;
    }
    const reader = new FileReader();
    if (/\.xlsx?$/i.test(file.name)) {
      // Read workbook bytes in memory without retaining the File object.
      reader.onload = async () => {
        try {
          accept(await parseMapperWorkbook(reader.result as ArrayBuffer));
        } catch (cause) {
          setError(`Could not read workbook: ${(cause as Error).message}`);
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }
    reader.onload = () => {
      const content = String(reader.result ?? "");
      setText(content);
      const extension = file.name.toLowerCase().split(".").pop();
      if (extension === "json" || extension === "csv" || extension === "tsv") {
        try {
          accept(parseMapperText(content, extension));
        } catch (cause) {
          setError(`Could not parse this file: ${(cause as Error).message}`);
        }
      } else setError("Use XLSX, CSV, TSV, or JSON.");
    };
    reader.readAsText(file);
  }
  async function exportPdf() {
    if (!analysis) return;
    await exportCloudSecurityReport(analysis, "CISO", customerLabel);
  }
  async function exportAudienceReport(audience: MapperReportAudience) {
    if (analysis)
      await exportCloudSecurityReport(analysis, audience, customerLabel);
  }

  return (
    <div className="stack" aria-label="Cloud Security Value Mapper">
      <div className="tool-section-head">
        <div>
          <span className="eyebrow">Cloud Security Value Mapper</span>
          <h2>Map telemetry value before changing tiers or plans.</h2>
          <p>
            Local, deterministic planning for evidence, detection inputs, native
            findings, Sentinel treatment, and complementary Defender for Cloud
            workload opportunities.
          </p>
          <p className="ai-note">
            {PROTECTION_CATALOG.notice} Public alert references may omit
            recently added alerts; validate protected resources, configuration,
            preview status, and current availability.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={clear}>
          Clear analysis
        </button>
      </div>
      <div className="mapper-steps" aria-label="Workflow steps">
        <span className="active">1. Provide environment data</span>
        <span>2. Validate and map fields</span>
        <span>3. Review telemetry value</span>
        <span>4. Review protection opportunities</span>
        <span>5. Generate executive report</span>
      </div>
      <section className="card">
        <h3>1. Provide environment data</h3>
        <p className="ai-note">
          Files are parsed in memory in this browser. Raw rows, identifiers, and
          filenames are not sent to an API, storage, analytics, or logs.
        </p>
        <div className="row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileRef.current?.click()}
          >
            Upload XLSX, CSV, TSV, or JSON
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setText(SYNTHETIC_MAPPER_EXAMPLE);
              accept(
                parseMapperText(SYNTHETIC_MAPPER_EXAMPLE, "json"),
                "Loaded synthetic example; no customer data is included.",
              );
            }}
          >
            Load synthetic example
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept=".xlsx,.xls,.csv,.tsv,.json"
            onChange={onFile}
          />
        </div>
        <label htmlFor="mapper-customer-label">Optional report label</label>
        <input
          id="mapper-customer-label"
          type="text"
          maxLength={120}
          value={customerLabel}
          onChange={(event) => setCustomerLabel(event.target.value)}
          placeholder="Use a non-sensitive label"
        />
        <label htmlFor="mapper-paste">Paste JSON, CSV, or TSV results</label>
        <textarea
          id="mapper-paste"
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste aggregate usage rows here"
        />
        <div className="row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => parseText("json")}
          >
            Parse JSON
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => parseText("csv")}
          >
            Parse CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => parseText("tsv")}
          >
            Parse TSV
          </button>
        </div>
      </section>
      <section className="card">
        <h3>Sentinel customer query workflow</h3>
        <p>
          Run this bounded query for aggregate usage by data type, then paste
          the exported result above. It does not connect to Azure from this
          tool.
        </p>
        <pre className="code-block">
          <code>{buildQuery(windowDays)}</code>
        </pre>
        <button type="button" className="btn btn-secondary" onClick={copyQuery}>
          {copied ? "Copied" : "Copy KQL"}
        </button>
        <label htmlFor="mapper-window">Analysis window (days)</label>
        <input
          id="mapper-window"
          type="number"
          min="1"
          max="3650"
          value={windowDays}
          onChange={(event) => setWindowDays(Number(event.target.value) || 30)}
        />
      </section>
      {parsed && (
        <section className="card">
          <h3>2. Validate and map fields</h3>
          <p>
            {parsed.rows.length} rows detected. Confirm the mapping before
            analysis.
          </p>
          {parsed.sheetNames && (
            <p className="ai-note">
              Worksheet: {parsed.selectedSheet}. Available sheets:{" "}
              {parsed.sheetNames.join(", ")}
            </p>
          )}
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Detected field mapping</caption>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Detected column</th>
                </tr>
              </thead>
              <tbody>
                {mappingFields.map((field) => (
                  <tr key={field}>
                    <th scope="row">{field}</th>
                    <td>
                      <select
                        aria-label={`Map ${field} field`}
                        value={parsed.mapping[field] ?? ""}
                        onChange={(event) =>
                          updateMapping(field, event.target.value)
                        }
                      >
                        <option value="">Missing</option>
                        {parsed.headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.issues.map((issue) => (
            <p className="error-box" key={issue.message}>
              {issue.message} Affected rows: {issue.affectedRows}.
            </p>
          ))}
          <button type="button" className="btn btn-primary" onClick={analyze}>
            Analyze mapped data
          </button>
        </section>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {notice && !error && (
        <p className="ai-note" role="status">
          {notice}
        </p>
      )}
      {analysis && (
        <>
          <section className="card">
            <div className="tool-section-head">
              <div>
                <h3>3-4. Telemetry value and protection opportunities</h3>
                <p>
                  These are deterministic candidate mappings. Collection does
                  not by itself prove that a detection, alert, or incident
                  exists, and it does not prove that a Defender plan is enabled.
                </p>
              </div>
              <div className="row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={exportPdf}
                >
                  Download executive PDF
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => exportAudienceReport("SOC leader")}
                >
                  Download SOC report
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => exportAudienceReport("Technical architecture")}
                >
                  Download architecture report
                </button>
              </div>
            </div>
            <p className="ai-note">
              Catalog {PROTECTION_CATALOG.catalogVersion} from{" "}
              {PROTECTION_CATALOG.snapshotDate}. {PROTECTION_CATALOG.notice}
            </p>
            <div className="metric-grid">
              <div>
                <strong>{format(analysis.totalGBPerDay)}</strong>
                <span>GB/day</span>
              </div>
              <div>
                <strong>{format(analysis.concentrationPct)}%</strong>
                <span>top-three concentration</span>
              </div>
              <div>
                <strong>{analysis.highConfidenceOpportunityCount}</strong>
                <span>opportunity signals</span>
              </div>
              <div>
                <strong>{analysis.unknownCount}</strong>
                <span>unknowns to validate</span>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <caption>Telemetry value matrix</caption>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Observed GB/day</th>
                    <th>Share</th>
                    <th>Roles</th>
                    <th>Security value</th>
                    <th>Detection readiness</th>
                    <th>Sentinel treatment</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.sources.map((source, index) => (
                    <tr key={`${source.normalizedSourceName}-${index}`}>
                      <th scope="row">
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setSelected(source)}
                        >
                          {source.normalizedSourceName}
                        </button>
                      </th>
                      <td>{format(source.observedGBPerDay)}</td>
                      <td>{format(source.sharePct)}%</td>
                      <td>{source.roles.join(", ")}</td>
                      <td>{source.securityValue}</td>
                      <td>{source.detectionReadiness}</td>
                      <td>{source.recommendedSentinelTreatment}</td>
                      <td>{source.confidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card">
            <h3>Bounded AI preview</h3>
            <p>
              Optional AI rewriting is not required for this analysis. Before
              any future AI request, this exact aggregate contract would be
              shown; no raw rows, notes, workspaces, identities, hostnames, or
              resource identifiers are included.
            </p>
            <details>
              <summary>Preview minimized contract</summary>
              <pre className="code-block">
                <code>{payloadPreview}</code>
              </pre>
            </details>
          </section>
        </>
      )}
      {selected && (
        <section className="card" aria-live="polite">
          <div className="tool-section-head">
            <div>
              <h3>Source detail: {selected.normalizedSourceName}</h3>
              <p>{selected.evidence}</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSelected(null)}
            >
              Close detail
            </button>
          </div>
          <p>
            <strong>What it provides:</strong> {selected.rationale}
          </p>
          <p>
            <strong>What it does not prove:</strong> collection does not prove a
            detection, incident, or workload protection plan is enabled.
          </p>
          <p>
            <strong>POC scenario:</strong> {selected.pocScenario}
          </p>
          <p>
            <strong>Validation state:</strong> {selected.validationState}.{" "}
            <strong>Existing detection dependency:</strong>{" "}
            {selected.existingDetectionDependency}
          </p>
          <h4>Candidate Defender for Cloud plans</h4>
          {selected.candidateDefenderPlans.length ? (
            selected.candidateDefenderPlans.map((candidate) => (
              <div className="notice-box" key={candidate.plan}>
                <strong>{candidate.plan}</strong>
                <p>
                  {candidate.rationale} {candidate.provides}
                </p>
                <p>
                  {candidate.doesNotProve} {candidate.validate}
                </p>
                {candidate.evidenceClass && (
                  <p>
                    Evidence: {candidate.evidenceClass};{" "}
                    {candidate.previewStatus}; planes:{" "}
                    {candidate.telemetryPlanes?.join(", ") || "not specified"}.{" "}
                    <a
                      href={candidate.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Source
                    </a>
                  </p>
                )}
                <p>
                  Plan status: {candidate.planStatusQuestion} Resource scope:{" "}
                  {candidate.resourceScopeQuestion} Configuration:{" "}
                  {candidate.configurationQuestion}
                </p>
              </div>
            ))
          ) : (
            <p>
              None mapped deterministically; validate the source family first.
            </p>
          )}
          <h4>Customer validation questions</h4>
          <ul>
            {selected.validationQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
          <p>
            <strong>Assumptions:</strong> {selected.assumptions.join(" ")}
          </p>
        </section>
      )}
    </div>
  );
}
