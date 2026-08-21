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
import defenderP2Raw from "../../../kql/defender-for-servers-p2-ingestion-benefit.md?raw";

const DOC = parseKqlDoc(defenderP2Raw);

/** Client-side cap on attached screenshots, well under the API's 4 MB body limit once base64-encoded. */
const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024;

const PORTAL_LOGS_URL =
  "https://portal.azure.com/#view/Microsoft_Azure_Monitoring/AzureMonitoringBrowseBlade/~/logs";

const REPO_DOC_URL =
  "https://github.com/ninjapaw/sentinel-optimizer/blob/dev/kql/defender-for-servers-p2-ingestion-benefit.md";

/** Column order the query's final `summarize`/`extend` produces, used to explain a pasted row positionally. */
const COLUMNS: { key: string; label: string; help: string }[] = [
  { key: "Workspaces", label: "Workspaces", help: "How many Log Analytics workspaces (in your selected Scope) had data." },
  { key: "Nodes", label: "Nodes", help: "Distinct servers seen sending a heartbeat, across those workspaces." },
  { key: "CapGBPerDay", label: "Cap (GB/day)", help: "The maximum the P2 benefit could ever cover: Nodes × 500 MB." },
  { key: "ConservativeEligibleGBPerDay", label: "Conservative eligible (GB/day)", help: "Real ingestion into the always-qualifying tables, before any cap." },
  { key: "ExpandedEligibleGBPerDay", label: "Expanded eligible (GB/day)", help: "Same, generously including the conditional tables (Update/UpdateSummary/WindowsEvent)." },
  { key: "ConservativeFreeGBPerDay", label: "Conservative free (GB/day)", help: "The safe-to-quote free benefit: min(conservative eligible, cap)." },
  { key: "ExpandedFreeGBPerDay", label: "Expanded free (GB/day)", help: "Upper-bound free benefit: min(expanded eligible, cap). Don't price this one." },
  { key: "RecommendedFreeGBPerDay", label: "Recommended (GB/day)", help: "Paste this number into a cost calculator or quote — same as conservative free." },
  { key: "CapGBPerMonth", label: "Cap (GB/month)", help: "CapGBPerDay converted to a monthly figure (average 30.4368-day month)." },
  { key: "ConservativeFreeGBPerMonth", label: "Conservative free (GB/month)", help: "ConservativeFreeGBPerDay converted to monthly — safe-to-quote." },
  { key: "ExpandedFreeGBPerMonth", label: "Expanded free (GB/month)", help: "ExpandedFreeGBPerDay converted to monthly — upper bound, don't price this one." },
  { key: "RecommendedFreeGBPerMonth", label: "Recommended (GB/month)", help: "RecommendedFreeGBPerDay converted to monthly — the number to quote for a monthly conversation." },
  { key: "RecommendedFreeGBPerYear", label: "Recommended (GB/year)", help: "RecommendedFreeGBPerDay converted to an annual estimate (365.25-day average year)." },
  { key: "AvgGBPerNodePerDay", label: "Avg per node (GB/day)", help: "Eligible ingestion ÷ node count — a sanity-check density figure." },
  { key: "ConservativeCoveragePct", label: "Coverage (%)", help: "Share of eligible ingestion actually covered today. 100% = fully covered; below 100% = over the cap somewhere." },
  { key: "UnusedCapGBPerDay", label: "Unused cap (GB/day)", help: "Spare daily allowance: cap minus conservative free." },
  { key: "UnusedCapPct", label: "Unused cap (%)", help: "The same spare allowance, as a percentage of the cap." },
  { key: "AnalysisWindowDays", label: "Analysis window (days)", help: "The look-back window this row was computed over." },
  { key: "GeneratedAtUtc", label: "Generated at (UTC)", help: "Timestamp of when this row was computed." },
  { key: "EligibleTableBreakdown", label: "Per-table breakdown", help: "JSON array of GB/day by DataType (Core vs. Conditional) — the same detail level as the built-in Defender for Cloud cost workbook." },
  { key: "WorkspaceBreakdown", label: "Per-workspace breakdown", help: "JSON array of each workspace's own Nodes/CapGBPerDay/free-GB numbers, before they're summed into the totals above." },
];

/** How many of the trailing JSON columns (EligibleTableBreakdown, WorkspaceBreakdown) are optional in a pasted/typed row. */
const OPTIONAL_JSON_COLUMNS = 2;
/** How many numeric/scalar columns come before the two optional JSON breakdown columns — this is what someone can realistically type by hand. */
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
  // Accept the full row (including both JSON breakdown columns), just the
  // numeric columns plus one breakdown, or just the numeric columns alone —
  // nobody types the breakdown JSON by hand, and some copy methods only grab
  // the visible numeric columns.
  const numericCount = COLUMNS.length - OPTIONAL_JSON_COLUMNS;
  if (cells.length >= numericCount && cells.length <= COLUMNS.length) {
    return [...cells, ...Array(COLUMNS.length - cells.length).fill("")];
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
            open the downloaded file, and copy the one data row (skip the header) into the box below.
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
          Paste (or type) the single result row from Log Analytics — the {NUMERIC_COLUMN_COUNT} numbers (optionally
          followed by the per-table and per-workspace breakdowns), in order, separated by tabs, commas, or spaces —
          or paste/attach a screenshot instead
        </label>
        <textarea
          id="defender-p2-paste"
          rows={3}
          style={{ width: "100%", fontFamily: "monospace", fontSize: "0.85rem" }}
          placeholder="3	240	117.188	96.4	142.7	96.4	117.188	96.4	3566.83	2934.11	3566.83	2934.11	35210.10	0.4017	100.0	20.788	17.7	30	2026-08-21T00:00:00Z"
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
          <table className="table-compact" style={{ width: "100%", marginTop: "0.75rem" }}>
            <thead>
              <tr>
                <th>Column</th>
                <th>Value</th>
                <th>What it means</th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((col, idx) => {
                const isJson = col.key === "EligibleTableBreakdown" || col.key === "WorkspaceBreakdown";
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
        )}
        {pastedText.trim().length > 0 && !parsedRow && (
          <p className="ai-note">
            Couldn't automatically match that to the expected columns (Workspaces, Nodes, CapGBPerDay,
            ConservativeEligibleGBPerDay, ExpandedEligibleGBPerDay, ConservativeFreeGBPerDay, ExpandedFreeGBPerDay,
            RecommendedFreeGBPerDay, CapGBPerMonth, ConservativeFreeGBPerMonth, ExpandedFreeGBPerMonth,
            RecommendedFreeGBPerMonth, RecommendedFreeGBPerYear, AvgGBPerNodePerDay, ConservativeCoveragePct,
            UnusedCapGBPerDay, UnusedCapPct, AnalysisWindowDays, GeneratedAtUtc, and optionally
            EligibleTableBreakdown/WorkspaceBreakdown) — paste the row as copied from the results grid, or type
            the {NUMERIC_COLUMN_COUNT} numbers in order separated by spaces, commas, or tabs. "Explain with AI"
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
      </Card>
    </div>
  );
}

export default DefenderP2Tool;
