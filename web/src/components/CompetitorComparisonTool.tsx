/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { useState } from "react";
import { estimateMonthlyCost } from "@engine/pricing/index.js";
import { DEFAULT_REGION_ID } from "@engine/pricing/regions.js";
import type { Vendor } from "../lib/examples.js";
import { VENDORS } from "../lib/examples.js";
import { money, gbPerDay, pct } from "../lib/format.js";
import {
  PROVIDER_BASELINE_SOURCES,
  PROVIDER_RATE_CARD,
  RATE_CARD_LAST_REVIEWED,
  buildProviderComparison,
} from "../lib/providerComparison.js";
import { ProviderSpendComparisonChart } from "./Charts.js";

const DEFAULT_GB_PER_DAY = 100;
const DEFAULT_PROVIDER: Vendor = "splunk";
const providerOptions = VENDORS.filter((vendor) => vendor.id !== "sentinel");

function asPositiveNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export default function CompetitorComparisonTool() {
  const [gbPerDayValue, setGbPerDayValue] = useState(String(DEFAULT_GB_PER_DAY));
  const [benefitGbPerDayValue, setBenefitGbPerDayValue] = useState("0");
  const [currentProvider, setCurrentProvider] = useState<Vendor>(DEFAULT_PROVIDER);

  const totalGbPerDay = asPositiveNumber(gbPerDayValue);
  const defenderBenefitGbPerDay = Math.min(totalGbPerDay, asPositiveNumber(benefitGbPerDayValue));
  const sentinelCost = estimateMonthlyCost({
    analyticsGbPerDay: totalGbPerDay,
    regionId: DEFAULT_REGION_ID,
    commitmentTierMode: "auto",
    benefits: { defenderP2FreeGbPerDay: defenderBenefitGbPerDay },
  });
  const comparison = buildProviderComparison({
    currentVendor: currentProvider,
    totalGbPerDay,
    sentinelMonthlyModeledCost: sentinelCost.monthlyCost,
  });
  const current = comparison.currentProvider;
  const sentinelRate = PROVIDER_RATE_CARD.find((row) => row.vendor === "sentinel");
  const sortedRows = [...comparison.rows].sort((a, b) => {
    if (a.vendor === "sentinel") return -1;
    if (b.vendor === "sentinel") return 1;
    return b.monthlyListSpend - a.monthlyListSpend;
  });

  return (
    <div className="stack tool-shell">
      <section className="tool-intro panel panel-pad">
        <div>
          <span className="eyebrow">Quick compare</span>
          <h2>Compare Sentinel with common SIEM list-price baselines</h2>
          <p>
            Enter one daily ingestion number. The tool models Microsoft Sentinel with the same pricing engine used by the main calculator,
            then compares common provider baselines at the same volume.
          </p>
        </div>
        <div className="mini-note">
          Public pricing changes often. Use this for planning, then validate with vendor quotes and Microsoft pricing terms.
        </div>
      </section>

      <section className="panel panel-pad">
        <div className="field-row compare-controls">
          <label className="field">
            Daily data volume
            <input
              type="number"
              min="0"
              step="1"
              value={gbPerDayValue}
              onChange={(event) => setGbPerDayValue(event.target.value)}
              aria-label="Daily data volume in GB"
            />
          </label>
          <label className="field">
            Current provider
            <select value={currentProvider} onChange={(event) => setCurrentProvider(event.target.value as Vendor)}>
              {providerOptions.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Defender P2 free GB/day, if known
            <input
              type="number"
              min="0"
              step="0.1"
              value={benefitGbPerDayValue}
              onChange={(event) => setBenefitGbPerDayValue(event.target.value)}
              aria-label="Defender for Servers Plan 2 free ingestion in GB per day"
            />
          </label>
        </div>
      </section>

      <section className="stat-grid">
        <div className="stat">
          <span className="stat-label">Data volume</span>
          <span className="stat-value">{gbPerDay(totalGbPerDay)}</span>
          <span className="sub">Same volume for every provider</span>
        </div>
        <div className="stat">
          <span className="stat-label">Modeled Sentinel</span>
          <span className="stat-value accent">{money(comparison.sentinel.monthlyListSpend)}</span>
          <span className="sub">Includes Defender P2 benefit input</span>
        </div>
        {current && (
          <div className="stat">
            <span className="stat-label">Current provider baseline</span>
            <span className="stat-value">{money(current.monthlyListSpend)}</span>
            <span className="sub">
              {current.deltaVsSentinelMonthly >= 0 ? "+" : ""}
              {money(current.deltaVsSentinelMonthly)} vs Sentinel
            </span>
          </div>
        )}
        <div className="stat">
          <span className="stat-label">Sentinel ingest baseline</span>
          <span className="stat-value">${(sentinelRate?.listIngestUsdPerGb ?? 0.15).toFixed(3)}/GB</span>
          <span className="sub">Before model adjustments</span>
        </div>
      </section>

      <section className="panel panel-pad">
        <div className="section-head">
          <span className="eyebrow">Monthly comparison</span>
          <span className="subtle-text">Baselines last reviewed {RATE_CARD_LAST_REVIEWED}</span>
        </div>
        <ProviderSpendComparisonChart comparison={comparison} />
      </section>

      <section className="panel panel-pad">
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Provider list-price comparison</caption>
            <thead>
              <tr>
                <th>Provider</th>
                <th className="num">Public baseline / GB</th>
                <th className="num">Est. monthly spend</th>
                <th className="num">Delta vs Sentinel</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.vendor} className={row.vendor === "sentinel" || row.vendor === currentProvider ? "row-selected" : ""}>
                  <td>{row.label}</td>
                  <td className="num">${row.listIngestUsdPerGb.toFixed(3)}</td>
                  <td className="num">{money(row.monthlyListSpend)}</td>
                  <td className="num">
                    {row.deltaVsSentinelMonthly === 0
                      ? "$0"
                      : `${row.deltaVsSentinelMonthly > 0 ? "+" : ""}${money(row.deltaVsSentinelMonthly)} (${pct(row.deltaVsSentinelPct / 100)})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel panel-pad compare-sources">
        <h3>Pricing source links</h3>
        <p>
          These are public source anchors for review. The numbers are directional baselines, not negotiated contract prices.
        </p>
        <div className="source-link-grid">
          {Object.entries(PROVIDER_BASELINE_SOURCES).map(([provider, url]) => (
            <a key={provider} href={url} rel="noopener" target="_blank">
              {provider}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}