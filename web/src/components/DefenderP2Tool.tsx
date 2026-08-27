/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { useState } from "react";
import type { ClipboardEvent } from "react";
import { Card } from "./Card.js";
import { parseKqlDoc } from "../lib/kqlLibrary.js";
import { requestAiExplanation } from "../lib/aiClient.js";
import { exportDefenderP2Pdf } from "../lib/defenderP2Report.js";
import defenderP2Raw from "../../../kql/defender-for-servers-p2-ingestion-benefit.md?raw";
import { INTERNAL_CONFIG } from "@shared/index.js";

const DOC = parseKqlDoc(defenderP2Raw);

/** Keep the encoded image and JSON envelope below the API request limit. */
const MAX_SCREENSHOT_BYTES = Math.floor(
  ((INTERNAL_CONFIG.api.explainKql.maxBodyBytes - INTERNAL_CONFIG.api.explainKql.maxResultCharacters - 4096) * 3) / 4,
);

const PORTAL_LOGS_URL =
  "https://portal.azure.com/#view/Microsoft_Azure_Monitoring/AzureMonitoringBrowseBlade/~/logs";

const REPO_DOC_URL =
  "https://github.com/ninjapaw/sentinel-optimizer/blob/dev/kql/defender-for-servers-p2-ingestion-benefit.md";

/** Column order the query's final `summarize`/`extend` produces, used to explain a pasted row positionally. */
const COLUMNS: { key: string; label: string; help: string }[] = [
  { key: "RowType", label: "Row type", help: "Summary identifies the aggregate row; Workspace identifies a workspace detail row." },
  { key: "WorkspaceId", label: "Workspace ID", help: "The Log Analytics workspace identifier; the Summary row shows the workspace count." },
  { key: "Nodes", label: "Nodes", help: "Distinct servers seen sending a heartbeat, across those workspaces." },
  { key: "CapGBPerDay", label: "Cap (GB/day)", help: "The maximum the P2 benefit could ever cover: Nodes × 500 MB." },
  { key: "EligibleGBPerDay", label: "Eligible (GB/day)", help: "Daily eligible ingestion including supported conditional tables." },
  { key: "EligibleTableBreakdown", label: "Per-table breakdown", help: "JSON object of daily ingestion by supported DataType, including zero-volume tables." },
  { key: "FreeGBPerDay", label: "Free (GB/day)", help: "The estimated free ingestion: the lower of eligible ingestion and the cap." },
  { key: "UnusedCapGBPerDay", label: "Unused cap (GB/day)", help: "Daily benefit capacity not used by eligible ingestion." },
  { key: "OverCapGBPerDay", label: "Over cap (GB/day)", help: "Eligible ingestion above the estimated daily benefit capacity." },
];

/** How many JSON columns are optional in a pasted/typed row. */
const OPTIONAL_JSON_COLUMNS = 1;
/** How many scalar columns come before the optional breakdown column. */
const NUMERIC_COLUMN_COUNT = COLUMNS.length - OPTIONAL_JSON_COLUMNS;

/** Splits a comma-delimited CSV line into cells, respecting double-quoted fields (so quoted numbers like "17.09" split cleanly). */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/**
 * Reads the last non-empty pasted (or manually typed) line — skipping a
 * leading header row, e.g. from "Export to CSV - all columns" — and splits
 * on tab, comma, or plain whitespace (for someone typing the numbers by
 * hand); returns null if the cell count doesn't match.
 */
function parsePastedRow(text: string): string[] | null {
  const withoutBom = text.replace(/^\uFEFF/, "");
  const lines = withoutBom.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return null;
  const last = lines[lines.length - 1];
  const isTabSeparated = last.includes("\t");
  const isCommaSeparated = !isTabSeparated && last.includes(",");
  const cells = (
    isTabSeparated
      ? last.split("\t")
      : isCommaSeparated
        ? splitCsvLine(last)
        : last.trim().split(/\s+/)
  ).map((c) => c.trim());
  // Accept the full row, the scalar columns plus the breakdown, or scalars
  // alone. The summary row is the recommended row to paste.
  const numericCount = COLUMNS.length - OPTIONAL_JSON_COLUMNS;
  if (cells.length === numericCount) {
    cells.splice(COLUMNS.findIndex((column) => column.key === "EligibleTableBreakdown"), 0, "");
  }
  if (cells.length === COLUMNS.length) {
    return cells;
  }
  return null;
}

export function DefenderP2Tool() {
  const [copied, setCopied] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [screenshot, setScreenshot] = useState<{ dataUrl: string; name: string } | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [preparedFor, setPreparedFor] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const parsedRow = parsePastedRow(pastedText);

  async function copyQuery() {
    try {
      await navigator.clipboard.writeText(DOC.query);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — user can select the query text manually */
    }
  }

  function loadScreenshotFile(file: File) {
    setScreenshotError(null);
    if (!file.type.startsWith("image/")) {
      setScreenshotError("That file isn't an image — attach a PNG, JPEG, or WebP screenshot.");
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      const maxMb = Math.round(MAX_SCREENSHOT_BYTES / 1024 / 1024);
      const fileMb = Math.round(file.size / 1024 / 1024);
      setScreenshotError(`Screenshot is too large (${fileMb} MB) — keep it under ${maxMb} MB (crop to just the result row).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setScreenshot({ dataUrl: reader.result, name: file.name || "screenshot" });
      }
    };
    reader.readAsDataURL(file);
  }

  function onScreenshotInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadScreenshotFile(file);
    e.target.value = "";
  }

  function onPasteResultArea(e: ClipboardEvent<HTMLTextAreaElement>) {
    const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
    if (!item) return;
    const file = item.getAsFile();
    if (file) {
      e.preventDefault();
      loadScreenshotFile(file);
    }
  }

  async function explainWithAi() {
    setAiLoading(true);
    setAiError(null);
    setAiText(null);
    try {
      const text = await requestAiExplanation({
        queryId: DOC.id,
        ...(pastedText.trim() ? { resultText: pastedText } : {}),
        ...(screenshot ? { imageDataUrl: screenshot.dataUrl } : {}),
      });
      setAiText(text);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Couldn't reach the AI service.");
    } finally {
      setAiLoading(false);
    }
  }

  async function generateAiPdf() {
    if (!parsedRow) return;
    const reportRow = parsedRow;
    setPdfLoading(true);
    setPdfError(null);
    try {
      let narrative = aiText;
      if (!narrative) {
        narrative = await requestAiExplanation({
          queryId: DOC.id,
          resultText: pastedText,
          ...(screenshot ? { imageDataUrl: screenshot.dataUrl } : {}),
        });
        setAiText(narrative);
      }
      await exportDefenderP2Pdf({
        title: DOC.title,
        summary: DOC.summary,
        ...(preparedFor.trim() ? { preparedFor: preparedFor.trim() } : {}),
        generatedAt: new Date(),
        fields: COLUMNS.map((column, index) => ({
          ...column,
          value: reportRow[index] || "",
        })),
        aiNarrative: narrative,
        sources: DOC.docs,
      });
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Couldn't generate the PDF report.");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <Card title="Defender for Servers P2 benefit" icon="🖥️" description={DOC.summary}>
        <p className="ai-note">{DOC.summary}</p>
      </Card>

      <Card title="Step-by-step walkthrough" icon="🧭">
        <ol style={{ margin: 0, paddingLeft: "1.25rem", lineHeight: 1.7 }}>
          <li>
            Open{" "}
            <a href={PORTAL_LOGS_URL} target="_blank" rel="noopener noreferrer">
              Azure Monitor → Logs
            </a>{" "}
            in the Azure portal (it opens straight into the KQL query editor — no separate mode to switch).
          </li>
          <li>
            Select <strong>Scope</strong> (top of the query editor) and pick every subscription or workspace you want counted.
          </li>
          <li>Copy the query below and paste it into the editor.</li>
          <li>
            Select <strong>Run</strong> (or press <strong>Shift+Enter</strong>).
          </li>
          <li>
            Select <strong>Share</strong> above the results grid → <strong>Export to CSV - all columns</strong>,
            open the downloaded file, and copy the <strong>Summary</strong> row into the box below.
          </li>
        </ol>
      </Card>

      <Card title="Query" icon="📋">
        <div className="query-head">
          <span className="query-lang">KQL</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={copyQuery}>
            {copied ? "Copied ✓" : "Copy query"}
          </button>
        </div>
        <pre className="code-block" aria-label="Defender for Servers P2 benefit query">
          <code>{DOC.query}</code>
        </pre>
        <p className="ai-note">
          Full write-up with limits and sample output:{" "}
          <a href={REPO_DOC_URL} target="_blank" rel="noopener noreferrer">
            kql/defender-for-servers-p2-ingestion-benefit.md
          </a>
          .
        </p>
      </Card>

      <Card title="Paste your result &amp; get an explanation" icon="🧮">
        <label htmlFor="defender-p2-paste">
          Paste (or type) the Summary result row from Log Analytics — the {NUMERIC_COLUMN_COUNT} scalar values
          (optionally followed by the per-table breakdown), in order, separated by tabs, commas, or spaces —
          or paste/attach a screenshot instead
        </label>
        <textarea
          id="defender-p2-paste"
          rows={3}
          style={{ width: "100%", fontFamily: "monospace", fontSize: "0.85rem" }}
          placeholder="Summary	6	75	36.621	0.916	{}	0.916	35.705	0.000"
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          onPaste={onPasteResultArea}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.5rem" }}>
          <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
            Attach screenshot
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onScreenshotInputChange}
              style={{ display: "none" }}
            />
          </label>
          {screenshot && (
            <span className="ai-note" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <img
                src={screenshot.dataUrl}
                alt={`Attached screenshot: ${screenshot.name}`}
                style={{ maxHeight: "2.5rem", borderRadius: "4px", border: "1px solid var(--color-border, #e0e0e0)" }}
              />
              {screenshot.name}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setScreenshot(null)}>
                Remove
              </button>
            </span>
          )}
        </div>
        {screenshotError && (
          <p className="ai-note" style={{ color: "var(--color-danger, #c0392b)" }}>
            {screenshotError}
          </p>
        )}
        <p className="ai-note">
          A screenshot is only sent to the configured AI provider when you select "Explain with AI" below —
          it isn't stored, and it isn't used for the automatic column table above (that only reads pasted text).
          Crop it to just the result row if you can.
        </p>

        {parsedRow && (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table-compact" style={{ width: "100%", minWidth: "540px", marginTop: "0.75rem" }}>
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Value</th>
                  <th>What it means</th>
                </tr>
              </thead>
              <tbody>
                {COLUMNS.map((col, idx) => {
                  const isJson = col.key === "EligibleTableBreakdown";
                  return (
                    <tr key={col.key}>
                      <td>{col.label}</td>
                      <td className={isJson ? undefined : "num"} style={isJson ? { fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" } : undefined}>
                        {parsedRow[idx] || <em>(not provided)</em>}
                      </td>
                      <td>{col.help}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pastedText.trim().length > 0 && !parsedRow && (
          <p className="ai-note">
            Couldn't automatically match that to the expected columns (RowType, WorkspaceId, Nodes, CapGBPerDay,
            EligibleGBPerDay, EligibleTableBreakdown, FreeGBPerDay, UnusedCapGBPerDay, OverCapGBPerDay) — paste the Summary row as copied from the results grid, or type
            the {NUMERIC_COLUMN_COUNT} values in order separated by spaces, commas, or tabs. "Explain with AI"
            below works from the raw text either way.
          </p>
        )}

        <div style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={explainWithAi}
            disabled={aiLoading || (pastedText.trim().length === 0 && !screenshot)}
          >
            {aiLoading ? "Explaining…" : "Explain with AI"}
          </button>
        </div>
        {aiText && (
          <p className="ai-note" style={{ marginTop: "0.75rem" }}>
            {aiText}
          </p>
        )}
        {aiError && (
          <p className="ai-note" style={{ marginTop: "0.75rem", color: "var(--color-danger, #c0392b)" }}>
            {aiError}
          </p>
        )}

        <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--color-border, #d9e2ef)" }}>
          <label htmlFor="defender-p2-prepared-for">Prepared for (optional)</label>
          <input
            id="defender-p2-prepared-for"
            type="text"
            value={preparedFor}
            onChange={(event) => setPreparedFor(event.target.value)}
            placeholder="Customer or organization name"
            style={{ width: "100%", marginTop: "0.35rem" }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={generateAiPdf}
            disabled={!parsedRow || pdfLoading || aiLoading}
            style={{ marginTop: "0.75rem" }}
          >
            {pdfLoading ? "Building AI PDF…" : "Generate AI PDF report"}
          </button>
          <p className="ai-note">
            Generates a clean A4 report in your browser. The AI service writes only the interpretation;
            all figures, tables, headers, footers, and legal notices are deterministic. A valid pasted result row is required.
          </p>
          {pdfError && (
            <p className="ai-note" style={{ color: "var(--color-danger, #c0392b)" }}>
              {pdfError}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

export default DefenderP2Tool;
