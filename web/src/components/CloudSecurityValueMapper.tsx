import { useEffect, useMemo, useRef, useState } from "react";
import { requestAiSummary, type AiResult } from "../lib/aiClient.js";
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
  const [showAll, setShowAll] = useState(false);
  const [audience, setAudience] = useState<"CISO" | "SOC leader" | "Security architect">("CISO");
  const [aiConsent, setAiConsent] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiRequest = useRef<AbortController | null>(null);
  const aiRevision = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    aiRevision.current += 1;
    aiRequest.current?.abort();
  }, []);

  const payloadPreview = useMemo(
    () =>
      analysis
        ? JSON.stringify(buildBoundedAiPayload(analysis, audience), null, 2)
        : "",
    [analysis, audience],
  );

  function resetAi() {
    aiRevision.current += 1;
    aiRequest.current?.abort();
    aiRequest.current = null;
    setAiBusy(false);
    setAiResult(null);
    setAiError(null);
    setAiConsent(false);
  }

  async function explainOpportunities() {
    if (!analysis || !aiConsent || aiBusy) return;
    const revision = ++aiRevision.current;
    const controller = new AbortController();
    aiRequest.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    setAiBusy(true);
    setAiResult(null);
    setAiError(null);
    try {
      const result = await requestAiSummary(buildBoundedAiPayload(analysis, audience), controller.signal);
      if (revision === aiRevision.current) setAiResult(result);
    } catch (cause) {
      if (revision === aiRevision.current) {
        setAiError(controller.signal.aborted
          ? "AI request timed out. Your local opportunities are still available."
          : cause instanceof Error ? cause.message : "AI is unavailable. Your local opportunities are still available.");
      }
    } finally {
      window.clearTimeout(timeout);
      if (revision === aiRevision.current) {
        setAiBusy(false);
        aiRequest.current = null;
      }
    }
  }

  function accept(next: ParsedMapperInput, message?: string) {
    resetAi();
    setParsed(next);
    setAnalysis(next.mapping.sourceName && next.rows.length ? analyzeMapper(next.rows, windowDays) : null);
    setSelected(null);
    setShowAll(false);
    setError(null);
    setNotice(message ?? null);
  }
  function parseText() {
    try {
      const format = /^[\[{]/.test(text.trim()) ? "json" : text.split(/\r?\n/, 1)[0]?.includes("\t") ? "tsv" : "csv";
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
    resetAi();
    setSelected(null);
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
    resetAi();
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
    setCustomerLabel("");
    setShowAll(false);
    resetAi();
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
    if (/\.xlsx$/i.test(file.name)) {
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
    try {
      await exportCloudSecurityReport(analysis, "CISO", customerLabel);
    } catch {
      setError("Could not generate the report. Your analysis is still available.");
    }
  }
  async function exportAudienceReport(audience: MapperReportAudience) {
    if (!analysis) return;
    try {
      await exportCloudSecurityReport(analysis, audience, customerLabel);
    } catch {
      setError("Could not generate the report. Your analysis is still available.");
    }
  }

  return (
    <div className="stack cloud-mapper" aria-label="Cloud Security Value Mapper">
      <div className="tool-section-head">
        <div>
          <h2>Cloud Security Value Mapper</h2>
          <p>
            Protection opportunities based on your data. Current coverage remains unverified.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={clear}>
          Clear analysis
        </button>
      </div>
      <section className="mapper-section">
        <h3>Environment data</h3>
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
              const example = parseMapperText(SYNTHETIC_MAPPER_EXAMPLE, "json");
              example.rows = example.rows.map((row) => ({ ...row, dataOrigin: "synthetic-example" }));
              accept(
                example,
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
            accept=".xlsx,.csv,.tsv,.json"
            onChange={onFile}
          />
        </div>
        <label htmlFor="mapper-window">Data window (days)</label>
        <input
          id="mapper-window"
          type="number"
          min="1"
          max="3650"
          value={windowDays}
          onChange={(event) => {
            const days = Math.min(3650, Math.max(1, Number(event.target.value) || 30));
            setWindowDays(days);
            resetAi();
            setSelected(null);
            if (analysis && parsed) setAnalysis(analyzeMapper(parsed.rows, days));
          }}
        />
        <details open={!analysis || undefined}>
        <summary>Paste data</summary>
        <label htmlFor="mapper-paste">Paste JSON, CSV, or TSV results</label>
        <textarea
          id="mapper-paste"
          rows={6}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setParsed(null);
            setAnalysis(null);
            setSelected(null);
            setNotice(null);
            resetAi();
          }}
          placeholder="Paste aggregate usage rows here"
        />
        <div className="row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={parseText}
          >
            Find protection opportunities
          </button>
        </div>
        </details>
      </section>
      <details className="mapper-section">
        <summary>Sentinel usage query</summary>
        <pre className="code-block">
          <code>{buildQuery(windowDays)}</code>
        </pre>
        <button type="button" className="btn btn-secondary" onClick={copyQuery}>
          {copied ? "Copied" : "Copy KQL"}
        </button>
      </details>
      {parsed && (
        <details className="mapper-section" open={!analysis || undefined}>
          <summary>{parsed.rows.length} input rows: field mapping and data quality</summary>
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
        </details>
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
          <section className="mapper-section" aria-labelledby="mapper-opportunities">
            <h3 id="mapper-opportunities">Protection opportunities ({analysis.protectionOpportunities.length})</h3>
            <p className="ai-note">Suggested review order, not incident severity. These are candidates, not confirmed gaps. Verify existing coverage and cost before making changes.</p>
            {analysis.protectionOpportunities.length ? (
              <ol className="protection-list">
                {(showAll ? analysis.protectionOpportunities : analysis.protectionOpportunities.slice(0, 3)).map((opportunity) => (
                  <li key={opportunity.id}>
                    <h4>{opportunity.solution}</h4>
                    <p>{opportunity.benefit}</p>
                    <p><strong>Next step:</strong> {opportunity.nextStep}</p>
                    <details>
                      <summary>Evidence and validation</summary>
                      <p><strong>Observed:</strong> {opportunity.sourceCount} source rows in {opportunity.evidenceFamilies.join(", ")}.</p>
                      <p><strong>Coverage:</strong> {opportunity.coverage}. Mapping confidence: {opportunity.confidence}.</p>
                      <p>{opportunity.validation}</p>
                      <a href={opportunity.sourceUrl} target="_blank" rel="noreferrer">Microsoft guidance</a>
                    </details>
                  </li>
                ))}
              </ol>
            ) : <p>No supported protection mapping yet. Review the source names and provide recognizable workload or table names; unknown sources are not evidence that protection is missing.</p>}
            {analysis.protectionOpportunities.length > 3 && (
              <button type="button" className="btn btn-secondary" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Show top three" : `Show all ${analysis.protectionOpportunities.length} opportunities`}
              </button>
            )}
          </section>
          <section className="mapper-section" aria-labelledby="mapper-ai">
            <h3 id="mapper-ai">AI action brief</h3>
            <p className="ai-note">Optional AI-generated guidance. Verify it against the evidence and Microsoft documentation; it is not an assessment of deployed protection.</p>
            <label htmlFor="mapper-audience">Audience</label>
            <select id="mapper-audience" value={audience} onChange={(event) => {
              setAudience(event.target.value as typeof audience);
              resetAi();
            }}>
              <option>CISO</option><option>SOC leader</option><option>Security architect</option>
            </select>
            <details>
              <summary>Preview data sent to AI</summary>
              <pre className="code-block"><code>{payloadPreview}</code></pre>
            </details>
            <label className="mapper-consent">
              <input type="checkbox" checked={aiConsent} onChange={(event) => {
                if (!event.target.checked) resetAi();
                else setAiConsent(true);
              }} />
              Send these anonymized source families, counts, and opportunity IDs to the configured AI service.
            </label>
            <button type="button" className="btn btn-primary" disabled={!aiConsent || aiBusy || !analysis.protectionOpportunities.length} onClick={explainOpportunities}>
              {aiBusy ? "Generating brief..." : "Generate AI brief"}
            </button>
            {aiError && <p className="error-box" role="alert">{aiError}</p>}
            {aiResult && <div className="mapper-ai-result" role="status">
              <p><strong>AI-generated draft</strong>{aiResult.model ? ` | ${aiResult.model}` : ""}</p>
              <p>{aiResult.text}</p>
            </div>}
          </section>
          <details className="mapper-section">
            <summary>Telemetry evidence and reports</summary>
            <div className="tool-section-head">
              <div>
                <h3>Telemetry evidence</h3>
                <p>
                  These are deterministic candidate mappings. Collection does
                  not by itself prove that a detection, alert, or incident
                  exists, and it does not prove that a Defender plan is enabled.
                </p>
              </div>
              <label htmlFor="mapper-customer-label">Optional report label
                <input id="mapper-customer-label" type="text" maxLength={120} value={customerLabel}
                  onChange={(event) => setCustomerLabel(event.target.value)} placeholder="Use a non-sensitive label" />
              </label>
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
                <strong>{analysis.protectionOpportunities.length}</strong>
                <span>protection opportunities</span>
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
                      <td>{source.volumeGB === undefined ? "Not supplied" : format(source.observedGBPerDay)}</td>
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
          </details>
        </>
      )}
      {selected && (
        <section className="mapper-section" aria-live="polite">
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
