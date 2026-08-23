---
id: defender-for-servers-p2-ingestion-benefit
title: "Defender for Servers Plan 2 — data ingestion benefit sizing"
status: estimate
lastReviewed: "2026-08-22"
summary: >-
  Size the 500 MB/node/day free Log Analytics ingestion benefit that ships
  with Microsoft Defender for Servers Plan 2, calculated per subscription and
  applied at the workspace level, across
  every workspace in your Azure Monitor Logs scope in a single run.
tags:
  - defender-for-cloud
  - defender-for-servers
  - azure-arc
  - microsoft-sentinel
  - cost-optimization
docs:
  - label: "Use the data ingestion benefit in Microsoft Defender for Cloud"
    url: "https://learn.microsoft.com/en-us/azure/defender-for-cloud/data-ingestion-benefit"
  - label: "Cross-workspace queries in Azure Monitor Logs"
    url: "https://learn.microsoft.com/en-us/azure/azure-monitor/logs/cross-workspace-query"
  - label: "Common questions - Microsoft Defender for Servers"
    url: "https://learn.microsoft.com/en-us/azure/defender-for-cloud/faq-defender-for-servers"
  - label: "Log Analytics table reference index by category (Security)"
    url: "https://learn.microsoft.com/en-us/azure/azure-monitor/reference/tables-category#security"
  - label: "Overview of file integrity monitoring in Microsoft Defender for Cloud"
    url: "https://learn.microsoft.com/en-us/azure/defender-for-cloud/file-integrity-monitoring-overview"
  - label: "Azure Update Manager Overview"
    url: "https://learn.microsoft.com/en-us/azure/update-manager/overview"
  - label: "Azure Arc overview"
    url: "https://learn.microsoft.com/en-us/azure/azure-arc/overview"
  - label: "Custom data collection in Microsoft Defender for Endpoint"
    url: "https://learn.microsoft.com/en-us/defender-endpoint/custom-data-collection"
---

> **Important: unofficial community guidance.** This is not a Microsoft
> official document, product, or supported Microsoft guidance. Ninja Paws is a
> fictional demo organization used by this repository. This independent
> community project is not affiliated with, sponsored by, endorsed by, or
> supported by Microsoft Corporation. Contributions from Microsoft employees,
> if any, are made in an individual capacity and do not imply Microsoft
> endorsement or sponsorship. The query and estimates are provided publicly at
> your own risk. This query is a best-effort estimate and informed approximation,
> not an authoritative calculation of Microsoft billing, licensing, eligibility,
> or entitlements. Results can vary with your selected scope, protected-server
> inventory, telemetry coverage, data latency, workspace design, and changes to
> Microsoft's services or documentation. Verify current Microsoft documentation,
> pricing, entitlements, and results with your Microsoft account team before
> relying on them or using them in production. Microsoft trademarks and product
> names belong to Microsoft Corporation.

## Defender for Servers Plan 2: Ingestion Benefit Estimate

This reference provides one KQL query, a plain-language walkthrough, example
output, verification checks, and automation guidance for estimating the free
Log Analytics ingestion benefit.

## Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [How to use it](#how-to-use-it)
- [Query](#query)
- [How the query works](#how-the-query-works)
- [Example result](#example-result)
- [Automate it](#automate-it)
- [Result fields](#result-fields)
- [Verification](#verification)
- [Troubleshooting and FAQ](#troubleshooting-and-faq)
- [Sources](#sources)

## Overview

Microsoft Defender for Servers Plan 2 grants **500 MB of free Log Analytics
ingestion per protected server, per day**, for a fixed set of security data
types. Microsoft calculates the total allowance across machines in each
subscription and applies the benefit at the workspace level, per the official
[data ingestion benefit documentation](https://learn.microsoft.com/en-us/azure/defender-for-cloud/data-ingestion-benefit) —
but Azure doesn't show you a single number for how much of that allowance
you're actually using, or how much you'd gain by enabling it. This is a
single, self-contained KQL query that estimates that amount: copy it into
Azure Monitor Logs, run it, and read one result row back. No manual math,
no cross-referencing tables, no workspace-by-workspace guesswork — it works
whether you're checking one workspace or an entire tenant (see
[How to use it](#how-to-use-it)).

**Why this is useful:**

- **P1 → P2**: run this against your current Plan 1 estate to see how much of
  your existing eligible ingestion Plan 2 would immediately offset for free,
  then compare that dollar value to the P1→P2 per-node price delta.
- **Nothing → P2**: run this to estimate the free ingestion you'd receive from
  day one, as a floor on the effective cost of turning Plan 2 on.
- **Already on P2**: run this periodically to see how much of your allowance
  you're actually using (`ConservativeFreeGBPerDay` vs `CapGBPerDay`) and
  whether unused headroom exists to onboard more eligible data sources.

## Prerequisites

Before running the query, confirm the following:

- **Azure access:** you can sign in to Azure Monitor Logs and select the
  subscriptions or Log Analytics workspaces you need to review.
- **Read access:** use the least privilege needed for the task. Grant the
  operator or automation identity **Log Analytics Reader** on each target
  workspace, or an equivalent role that includes query read access. Do not
  grant Contributor, Owner, or write permissions just to run this query.
- **Scope awareness:** select only the subscriptions and workspaces you are
  authorized to inspect. The result cannot include data that your identity
  cannot read, and missing workspaces may be silently absent rather than
  reported as an error.
- **Relevant data:** the target workspaces should contain `Heartbeat` and
  `Usage` data for the review window. The query uses a 30-day look-back and
  reports a trend, not a real-time balance.
- **Licensing context:** know which machines and workspaces are actually
  covered by Defender for Servers Plan 2. The query estimates from telemetry;
  it does not prove protection, licensing, or entitlement.
- **Operational safety:** run the query read-only, review the result before
  making cost or security changes, and avoid exporting tenant data to places
  that are not approved for your organization's information.

For automation, use a managed identity or workload identity with workspace
read access instead of a personal account. See [Automate it](#automate-it) for
the scheduling and storage pattern.

## How to use it

No KQL experience required — follow these steps exactly.

1. **Open [Azure Monitor → Logs](https://portal.azure.com/#view/Microsoft_Azure_Monitoring/AzureMonitoringBrowseBlade/~/logs)**
   directly (sign in if prompted). This link opens the Logs query editor —
   no need to search for "Monitor" or click through the left nav.
2. **Switch to KQL mode.** Check the mode dropdown at the top-right of the
   query editor. If it currently says **Simple mode**, select it and choose
   **KQL mode** instead — this query is written in KQL and won't run in
   Simple mode's point-and-click interface.
3. **Pick your scope.** A **Scope** picker appears (usually top-left of the
   query editor). Select every subscription or workspace whose servers you
   want counted. If you only manage one subscription, just leave the default.
4. **Copy the query.** Use the "Copy query" button above, or open the
   **Defender P2 Benefit** tool in [Sentinel Optimizer](https://sentineloptimizer.com)
   (the tab alongside Sentinel Cost, Defender for Cloud, and Usage & Quotas)
   — it has the same query, the same walkthrough, and a place to paste your
   result when you're done.
5. **Paste it into the big empty text box** in the Logs window (that's the
   query editor) and select **Run** (or press **Shift+Enter**).
6. **Read the single row of results** that appears in the table below the
  query. See [Example result](#example-result) below for what each column
  means.
7. **Get the raw result row.** Select **Share** above the results grid →
   **Export to CSV - all columns**, then open the downloaded file and copy
   the one data row (skip the header row).
8. **Paste it into Sentinel Optimizer.** Open the **Defender P2 Benefit** tab
   in [Sentinel Optimizer](https://sentineloptimizer.com), paste the copied
   row into its "Paste your result" box, and it auto-parses each column into
   a plain-language explanation (with an optional "Explain with AI" summary)
   — or just read the numbers directly using the explanations below.

## Query

> **Before running:**
>
> 1. Open [Azure Monitor → Logs](https://portal.azure.com/#view/Microsoft_Azure_Monitoring/AzureMonitoringBrowseBlade/~/logs)
>    (Monitor's left nav → **Logs**).
> 2. Check the mode dropdown at the top-right of the query editor. If it
>    says **Simple mode**, switch it to **KQL mode** — this query won't run
>    in Simple mode.
> 3. Open **Scope** and select every subscription (or workspace) you want
>    included.
> 4. Paste the query below and select **Run**.
>
> It never references a workspace ID — Log Analytics resolves `Heartbeat` and
> `Usage` across whatever you selected in Scope, so the same one-click
> copy/paste works for a single workspace or an entire tenant.
>
> No workspace yet? Try the query against Microsoft's read-only
> [Log Analytics demo environment](https://portal.azure.com/#blade/Microsoft_Azure_Monitoring_Logs/DemoLogsBlade)
> instead — sample data only, no subscription required.

```kql
// Defender for Servers Plan 2 — free data-ingestion benefit sizing
// (500 MB/node/day, calculated per subscription and applied at workspace level).
//
// Before running: Azure Monitor > Logs > Scope > select every
// subscription/workspace to include, then Run. No workspace IDs needed here —
// Log Analytics resolves Heartbeat/Usage across the selected scope.
let lookback = 30d;
let lookbackDays = lookback / 1d;
// Average calendar days per month (365.2425 / 12) — used only to turn the
// per-day figures into monthly estimates below; it's not a specific month.
let daysPerMonth = 30.4368;
// Unconditionally eligible tables per the Defender for Cloud docs.
let coreEligible = dynamic([
  "SecurityAlert", "SecurityBaseline", "SecurityBaselineSummary", "SecurityDetection",
  "SecurityEvent", "WindowsFirewall", "ProtectionStatus", "MDCFileIntegrityMonitoringEvents",
  "DeviceCustomFileEvents", "DeviceCustomRegistryEvents"]);
// Conditionally eligible: Update/UpdateSummary only qualify when the Update
// Management solution isn't running in the workspace (or solution targeting
// is enabled). WindowsEvent only qualifies for rows from the
// Microsoft-SecurityEvent stream; the aggregated Usage table can't prove that
// per row, so treat this half of the estimate as an upper bound, not a quote.
let conditionalEligible = dynamic(["Update", "UpdateSummary", "WindowsEvent"]);
// Per-table breakdown (like the built-in Defender for Cloud cost workbook
// shows), packed into one JSON array so it travels in the same single row —
// expand it in the results grid by selecting the row's ">" chevron.
let tableBreakdown = toscalar(
    Usage
    | where TimeGenerated > ago(lookback) and IsBillable == true
    | where DataType in (coreEligible) or DataType in (conditionalEligible)
    | summarize GBPerDay = round(sum(Quantity) / 1024.0 / lookbackDays, 3) by DataType
    | extend Eligibility = iff(DataType in (coreEligible), "Core", "Conditional")
    | sort by GBPerDay desc
    | summarize Breakdown = make_list(pack("DataType", DataType, "GBPerDay", GBPerDay, "Eligibility", Eligibility))
);
// TenantId is Log Analytics' (confusingly named) standard column for the
// *workspace* GUID. Heartbeat has subscription-related columns, but Usage is
// aggregated at workspace grain and has no reliable matching subscription key.
// materialize() runs the per-workspace pipeline once and caches it, so it can
// be reused below for both the per-workspace breakdown and the overall totals
// without scanning Heartbeat/Usage twice.
let perWorkspace = materialize(
    Heartbeat
    | where TimeGenerated > ago(lookback)
    | summarize Nodes = dcount(Computer) by WorkspaceId = TenantId
    | join kind=fullouter (
        Usage
        | where TimeGenerated > ago(lookback) and IsBillable == true
        // Convert to a per-day average here, at the source — everything below
        // this point is already "per day," so nothing gets divided twice.
        | summarize
            ConservativeEligibleGBPerDay = sumif(Quantity, DataType in (coreEligible)) / 1024.0 / lookbackDays,
            ExpandedEligibleGBPerDay = sumif(Quantity, DataType in (coreEligible) or DataType in (conditionalEligible)) / 1024.0 / lookbackDays
          by WorkspaceId = TenantId
    ) on WorkspaceId
    | extend WorkspaceId = coalesce(WorkspaceId, WorkspaceId1)
    | extend Nodes = toint(coalesce(Nodes, 0))
    | extend ConservativeEligibleGBPerDay = coalesce(ConservativeEligibleGBPerDay, 0.0)
    | extend ExpandedEligibleGBPerDay = coalesce(ExpandedEligibleGBPerDay, 0.0)
    // CapGBPerDay is already a daily rate (500 MB/node/day) — don't divide it
    // by lookbackDays, it isn't a period total like the eligible-GB figures.
    | extend CapGBPerDay = Nodes * 500.0 / 1024.0
    // Microsoft calculates the allowance across machines in a subscription, while
    // applying the benefit at the workspace level. Usage is aggregated by
    // workspace and does not expose a reliable subscription key, so this query
    // uses workspace-level pooling as an approximation. See the Known limits note.
    | extend ConservativeFreeGBPerDay = min_of(ConservativeEligibleGBPerDay, CapGBPerDay)
    | extend ExpandedFreeGBPerDay = min_of(ExpandedEligibleGBPerDay, CapGBPerDay)
);
// Per-workspace sub-totals, packed the same way as the per-table breakdown —
// expand this row's "WorkspaceBreakdown" column to see each workspace's own
// Nodes/CapGBPerDay/free-GB numbers before they're summed below.
let workspaceBreakdown = toscalar(
    perWorkspace
    | sort by ConservativeFreeGBPerDay desc
    | summarize Breakdown = make_list(pack(
        "WorkspaceId", WorkspaceId,
        "Nodes", Nodes,
        "CapGBPerDay", CapGBPerDay,
        "ConservativeFreeGBPerDay", ConservativeFreeGBPerDay,
        "ExpandedFreeGBPerDay", ExpandedFreeGBPerDay))
);
perWorkspace
| summarize
    Workspaces = dcount(WorkspaceId),
    Nodes = sum(Nodes),
    CapGBPerDay = round(sum(CapGBPerDay), 3),
    ConservativeEligibleGBPerDay = round(sum(ConservativeEligibleGBPerDay), 3),
    ExpandedEligibleGBPerDay = round(sum(ExpandedEligibleGBPerDay), 3),
    ConservativeFreeGBPerDay = round(sum(ConservativeFreeGBPerDay), 3),
    ExpandedFreeGBPerDay = round(sum(ExpandedFreeGBPerDay), 3)
| extend RecommendedFreeGBPerDay = ConservativeFreeGBPerDay
// Monthly estimates, purely derived from the per-day figures above — useful
// since Azure billing and customer quotes are usually discussed per month.
| extend CapGBPerMonth = round(CapGBPerDay * daysPerMonth, 2)
| extend ConservativeFreeGBPerMonth = round(ConservativeFreeGBPerDay * daysPerMonth, 2)
| extend ExpandedFreeGBPerMonth = round(ExpandedFreeGBPerDay * daysPerMonth, 2)
| extend RecommendedFreeGBPerMonth = round(RecommendedFreeGBPerDay * daysPerMonth, 2)
// A few extra, self-contained context columns so the row explains itself
// without re-reading the query — none of these change the headline numbers.
| extend RecommendedFreeGBPerYear = round(RecommendedFreeGBPerDay * 365.25, 2)
| extend AvgGBPerNodePerDay = round(iff(Nodes > 0, ConservativeEligibleGBPerDay / Nodes, 0.0), 4)
| extend ConservativeCoveragePct = round(iff(ConservativeEligibleGBPerDay > 0, 100.0 * ConservativeFreeGBPerDay / ConservativeEligibleGBPerDay, 100.0), 1)
| extend UnusedCapGBPerDay = round(max_of(CapGBPerDay - ConservativeFreeGBPerDay, 0.0), 3)
| extend UnusedCapPct = round(iff(CapGBPerDay > 0, 100.0 * UnusedCapGBPerDay / CapGBPerDay, 0.0), 1)
| extend AnalysisWindowDays = toint(lookbackDays)
| extend GeneratedAtUtc = now()
| extend EligibleTableBreakdown = tableBreakdown
| extend WorkspaceBreakdown = workspaceBreakdown
```

## How the query works

| # | KQL | What it does |
| --- | --- | --- |
| 1 | `let lookback = 30d;` / `let lookbackDays = lookback / 1d;` | Sets the look-back window (30 days) and converts it to a plain number so later steps can divide by it. |
| 2 | `let coreEligible = dynamic([...])` | Lists the 10 tables that **always** qualify for the P2 benefit. |
| 3 | `let conditionalEligible = dynamic([...])` | Lists the 3 tables that only **sometimes** qualify (`Update`, `UpdateSummary`, `WindowsEvent`). |
| 4 | `let tableBreakdown = toscalar(Usage \| ... \| summarize Breakdown = make_list(pack(...)))` | Separately computes a per-`DataType` GB/day breakdown (like the built-in Defender for Cloud cost workbook shows) and packs it into one JSON array, ready to attach to the final row. |
| 5 | `let perWorkspace = materialize(Heartbeat \| ... \| join kind=fullouter (Usage \| ...) \| extend ...)` | Runs the whole per-workspace Nodes/eligible/cap/free pipeline **once** and caches the result, so it can be reused below without re-scanning `Heartbeat`/`Usage`. |
| 6 | `let workspaceBreakdown = toscalar(perWorkspace \| sort by ... \| summarize Breakdown = make_list(pack(...)))` | Packs each workspace's own Nodes/Cap/Free numbers into a JSON array, sorted highest-free-GB-first, ready to attach to the final row. |
| 7 | `perWorkspace \| summarize Workspaces = dcount(...), Nodes = sum(...), ...` | Adds every workspace's already-capped numbers together into one overall result row. |
| 8 | `\| extend RecommendedFreeGBPerDay = ConservativeFreeGBPerDay` | Copies the safest number into a clearly-labeled column so it's obvious what to paste elsewhere. |
| 9 | `\| extend CapGBPerMonth = round(CapGBPerDay * daysPerMonth, 2)` (and the three matching `...GBPerMonth` lines) | Multiplies each per-day figure by an average 30.4368 days/month, purely for convenience — no new data, just a different unit. |
| 10 | `\| extend RecommendedFreeGBPerYear = round(RecommendedFreeGBPerDay * 365.25, 2)` | Same idea, annualized (365.25-day average year) — useful for yearly budget conversations. |
| 11 | `\| extend AvgGBPerNodePerDay = round(iff(Nodes > 0, ConservativeEligibleGBPerDay / Nodes, 0.0), 4)` | A sanity-check density figure: how much eligible ingestion each node sends, on average — useful for spotting a handful of noisy servers vs. a broad pattern. |
| 12 | `\| extend ConservativeCoveragePct = round(iff(ConservativeEligibleGBPerDay > 0, 100.0 * ConservativeFreeGBPerDay / ConservativeEligibleGBPerDay, 100.0), 1)` | What percentage of your real eligible ingestion the benefit is actually covering today — 100% means every eligible byte is free; below 100% means you're over the cap somewhere. |
| 13 | `\| extend UnusedCapGBPerDay = round(max_of(CapGBPerDay - ConservativeFreeGBPerDay, 0.0), 3)` | Spare daily allowance — how much more eligible ingestion you could add before hitting the cap. |
| 14 | `\| extend UnusedCapPct = round(iff(CapGBPerDay > 0, 100.0 * UnusedCapGBPerDay / CapGBPerDay, 0.0), 1)` | The same spare allowance, as a percentage of the cap — easier to eyeball at a glance than a raw GB number. |
| 15 | `\| extend AnalysisWindowDays = toint(lookbackDays)` | Restates the look-back window (30) directly in the result row, so it's self-describing without reopening the query. |
| 16 | `\| extend GeneratedAtUtc = now()` | Timestamps the row with when it was computed — useful context if you're saving or sharing the result later. |
| 17 | `\| extend EligibleTableBreakdown = tableBreakdown` | Attaches the per-table breakdown computed in step 4 onto the same single result row, as a nested JSON column. |
| 18 | `\| extend WorkspaceBreakdown = workspaceBreakdown` | Attaches the per-workspace breakdown computed in step 6 onto the same single result row, as a nested JSON column. |

> **Units:** `Usage.Quantity` is stored in **MB**; every `/ 1024.0` in the
> query converts that to **GB** (1024 MB), and the P2 benefit's own
> 500 MB/node/day allowance is converted the same way for a fair comparison.
> The `...GBPerMonth` columns use an **average** month length
> (365.2425 ÷ 12 = 30.4368 days), and `RecommendedFreeGBPerYear` an average
> year (365.25 days) — neither is tied to a specific calendar period, so
> don't expect exact invoice matches. `...Pct` columns are plain percentages
> (0–100, not 0–1). `AnalysisWindowDays` is a day count and `GeneratedAtUtc`
> is a timestamp — neither is a GB figure. `EligibleTableBreakdown` and
> `WorkspaceBreakdown` are JSON arrays — select the row's **">"** chevron in
> the results grid to expand them into readable lists.

> **Tip:** paste **`RecommendedFreeGBPerDay`** into the "Defender Servers P2
> (GB/day)" field. It's the same as `ConservativeFreeGBPerDay` — the safer
> number to quote, since it excludes the two conditional table groups
> described below. `ExpandedFreeGBPerDay` is an upper bound; use it to
> sanity-check, not to price.

## Known limits

> - **Subscription/workspace grain**: Microsoft says the daily allowance is calculated across machines in each subscription, while the benefit is applied at the workspace level. `Usage` is hourly workspace-level data and does not provide a reliable subscription key for allocating eligible volume. This query therefore pools nodes and eligible usage by workspace, which is exact for a one-subscription-per-workspace design but can misstate results when multiple subscriptions share one workspace. For shared workspaces, treat the result as an estimate and validate against Microsoft's allocation view or Cost Management data.
> - **Workspace scale**: the Scope picker uses implicit resource-context resolution, not the explicit `workspace()`/`app()` functions — those are capped at 100 workspaces per query, this isn't, but selecting hundreds of workspaces can still slow the query down or hit the Log Analytics query timeout (10 minutes by default). For very large estates, run per-management-group or per-region and sum the results.
> - **RBAC is silent**: you need Log Analytics Reader (or better) on every workspace in scope. Workspaces you can't read are silently omitted from Scope, not flagged as an error — a partial result can look like a complete one.
> - **`Usage` isn't real-time**: ingestion/usage data can lag by hours. A 30-day trailing average (the default `lookback` here) smooths this out; don't shrink `lookback` to 1d and expect an accurate daily number.
> - **`Heartbeat` undercounts agentless-only nodes**: machines protected only through agentless scanning (no AMA/MMA agent) never send a heartbeat, so `Nodes` — and therefore `CapGBPerDay` — can be understated for agentless-heavy estates.
> - **`Heartbeat` is a monitoring proxy, not proof of P2 protection**: every machine counted here must be sending a heartbeat, but the table does not prove that the machine is covered by Defender for Servers Plan 2. It can therefore overstate the benefit if unprotected or differently licensed machines report to the workspace. Validate `Nodes` against the Defender for Cloud protected-server inventory and Plan 2 scope.
> - **The 30-day node count is not a daily node-day average**: `dcount(Computer)` counts any machine seen during the look-back window, even if it reported briefly. It can overstate the daily capacity for machines that were retired during the window and can misrepresent estates with substantial onboarding or offboarding churn. Use a shorter window or a separate daily node-day analysis when churn is material.
> - **Multiple subscriptions reporting into one workspace**: this query cannot allocate the workspace's aggregated `Usage` back to subscriptions. It pools the observed nodes and eligible usage at workspace grain, so shared-workspace results require validation and should not be presented as an exact subscription-level benefit calculation.

## Example result

Running the query produces exactly **one summary row**. The following is a
fictional example using generated data; it is not a tenant result:

| Workspaces | Nodes | CapGBPerDay | ConservativeEligibleGBPerDay | ExpandedEligibleGBPerDay | ConservativeFreeGBPerDay | ExpandedFreeGBPerDay | RecommendedFreeGBPerDay | CapGBPerMonth | ConservativeFreeGBPerMonth | ExpandedFreeGBPerMonth | RecommendedFreeGBPerMonth | RecommendedFreeGBPerYear | AvgGBPerNodePerDay | ConservativeCoveragePct | UnusedCapGBPerDay | UnusedCapPct | AnalysisWindowDays | GeneratedAtUtc | EligibleTableBreakdown | WorkspaceBreakdown |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 80 | 39.063 | 11.7 | 16.8 | 11.7 | 16.8 | 11.7 | 1188.95 | 356.11 | 511.34 | 356.11 | 4273.43 | 0.1463 | 100.0 | 27.363 | 70.0 | 30 | 2026-01-15 12:00:00.000 PM UTC | `[ {"DataType":"SecurityEvent","GBPerDay":8.4,"Eligibility":"Core"},{"DataType":"Update","GBPerDay":3.7,"Eligibility":"Conditional"},{"DataType":"DeviceCustomFileEvents","GBPerDay":2.1,"Eligibility":"Core"},{"DataType":"WindowsEvent","GBPerDay":1.4,"Eligibility":"Conditional"},{"DataType":"MDCFileIntegrityMonitoringEvents","GBPerDay":1.2,"Eligibility":"Core"} ]` | `[ {"WorkspaceId":"workspace-guid-redacted","Nodes":80,"CapGBPerDay":39.0625,"ConservativeFreeGBPerDay":11.7,"ExpandedFreeGBPerDay":16.8} ]` |

### CSV export shape

Use **Share → Export to CSV - all columns** in Azure Monitor Logs. The
download contains one header row and one data row. Azure may label the UTC
column as `GeneratedAtUtc [UTC]`, and CSV quoting is normal: decimal values or
JSON fields may be surrounded by double quotes, while the JSON's internal
quotes are doubled for CSV escaping.

The following abbreviated example shows the shape only; values and identifiers
are fictional. The actual export contains all 21 columns in this same order:

```csv
Workspaces,Nodes,CapGBPerDay,ConservativeEligibleGBPerDay,...,AnalysisWindowDays,"GeneratedAtUtc [UTC]",EligibleTableBreakdown,WorkspaceBreakdown
1,80,"39.063","11.7",...,30,"1/15/2026, 12:00:00 PM","[{""DataType"":""SecurityEvent"",""GBPerDay"":8.4,""Eligibility"":""Core""},...]","[{""WorkspaceId"":""workspace-guid-redacted"",""Nodes"":80,...}]"
```

Paste the complete data row, not the header row, into the Sentinel Optimizer
result box. The two JSON fields are optional for manual entry, but retaining
them gives the per-table and per-workspace detail documented below.

### What to validate

This generated example is mathematically consistent with the documented query:

- `80 × 500 MB ÷ 1024 = 39.0625 GB/day`, displayed as `39.063`.
- Conservative eligible ingestion is `8.4 + 2.1 + 1.2 = 11.7 GB/day`.
- The conditional tables add `3.7 + 1.4 = 5.1 GB/day`, so the expanded
  estimate is higher than the conservative estimate.
- `39.063 - 11.7 = 27.363 GB/day`, or `70.0%`, is unused capacity in this
  dummy row, demonstrating that the result
  has headroom for additional eligible ingestion.

The dummy JSON includes five table entries and one redacted workspace entry
only to demonstrate the format. A real result can contain fewer or more table
entries depending on which eligible `DataType` values have `Usage` rows in the
look-back window; omitted eligible tables are not automatically unsupported.

### Per-table breakdown

`EligibleTableBreakdown` is a JSON array produced by the `Usage` query. Each
object reports one `DataType`, its 30-day average in GB/day, and the
eligibility classification used by the query. Expanded into a readable table,
the dummy array is:

| DataType | GB/day | Eligibility | Interpretation |
| --- | ---: | --- | --- |
| `SecurityEvent` | 8.400 | Core | Largest eligible contributor in this example. |
| `Update` | 3.700 | Conditional | Included only when the documented Update Management condition is satisfied. |
| `DeviceCustomFileEvents` | 2.100 | Core | Custom file telemetry contributing to eligible ingestion. |
| `WindowsEvent` | 1.400 | Conditional | Upper-bound contribution because `Usage` cannot prove the required stream. |
| `MDCFileIntegrityMonitoringEvents` | 1.200 | Core | FIM telemetry contributing to eligible ingestion. |

The array is sorted by `GBPerDay` descending. It includes only `DataType`
values returned by `Usage`; the query's eligibility lists remain the source of
truth for supported tables. A zero-volume table can appear when a zero-valued
`Usage` row exists, while an eligible table with no `Usage` row is omitted.

### Per-workspace breakdown

`WorkspaceBreakdown` is a JSON array produced from the materialized
per-workspace calculation. It preserves the workspace-level cap calculation
before the overall summary is emitted:

| WorkspaceId | Nodes | CapGBPerDay | ConservativeFreeGBPerDay | ExpandedFreeGBPerDay |
| --- | ---: | ---: | ---: | ---: |
| `workspace-guid-redacted` | 80 | 39.0625 | 11.7 | 16.8 |

The workspace identifier is fictional and redacted. The unrounded workspace
cap explains why the final summary displays `39.063` after its explicit
rounding step. With one workspace,
these per-workspace values directly reconcile to the summary row; with several
workspaces, each workspace is capped before the totals are added.

What each column means, in plain terms:

| Column | Unit | Example value | What it means |
| --- | --- | --- | --- |
| `Workspaces` | count (whole number) | 1 | How many Log Analytics workspaces (within the Scope you selected) actually had data — one workspace reported data in this example. |
| `Nodes` | count (whole number) | 80 | The total distinct machines (servers) seen sending a heartbeat across those workspaces. |
| `CapGBPerDay` | GB per day | 39.063 | The maximum free ingestion the P2 benefit could ever give you at that node count: `Nodes × 500 MB ÷ 1024`. This is the ceiling, not necessarily what you're using. |
| `ConservativeEligibleGBPerDay` | GB per day | 11.7 | How much eligible data (from the always-qualifying tables only) you're actually sending in, per day, before any cap is applied. This is your real, safe-to-quote ingestion volume. |
| `ExpandedEligibleGBPerDay` | GB per day | 16.8 | The same thing, but generously including `Update`/`UpdateSummary`/`WindowsEvent` too (tables that only *sometimes* qualify). Always ≥ the conservative number; treat the difference as conditional. |
| `ConservativeFreeGBPerDay` | GB per day | 11.7 | The actual free benefit you're getting today (or would get) using only the always-eligible tables: `min(ConservativeEligibleGBPerDay, CapGBPerDay)`. Here eligible ingestion is below the cap, so all of it is free. |
| `ExpandedFreeGBPerDay` | GB per day | 16.8 | Same idea, using the generous eligible number: `min(16.8, 39.063) = 16.8` — the eligible volume is below the cap. |
| `RecommendedFreeGBPerDay` | GB per day | 11.7 | The number to actually use. It's a copy of `ConservativeFreeGBPerDay`, called out separately so it's the one obvious number to paste into a cost calculator or quote to a customer. |
| `CapGBPerMonth` | GB per month | 1188.94 | `CapGBPerDay` converted to a monthly figure using an average 30.4368-day month — the same ceiling, just in the unit customers usually think in. |
| `ConservativeFreeGBPerMonth` | GB per month | 356.11 | `ConservativeFreeGBPerDay` converted to monthly — the safe-to-quote monthly free-ingestion figure. |
| `ExpandedFreeGBPerMonth` | GB per month | 511.34 | `ExpandedFreeGBPerDay` converted to monthly — the upper-bound monthly figure; don't price this one either. |
| `RecommendedFreeGBPerMonth` | GB per month | 356.11 | `RecommendedFreeGBPerDay` converted to monthly — the number to actually quote for a monthly conversation. |
| `RecommendedFreeGBPerYear` | GB per year | 4273.43 | `RecommendedFreeGBPerDay` converted to an annual estimate (365.25-day average year) — for yearly budget conversations. |
| `AvgGBPerNodePerDay` | GB per node per day | 0.1463 | Eligible ingestion divided by node count — a sanity-check density figure. A number that looks way too high or low for your environment is worth investigating before you quote anything. |
| `ConservativeCoveragePct` | percent (0–100) | 100.0 | What share of your real eligible ingestion the benefit is covering today. 100% means every eligible byte is free; below 100% means you're over the cap somewhere. |
| `UnusedCapGBPerDay` | GB per day | 27.363 | Spare daily allowance: `CapGBPerDay − ConservativeFreeGBPerDay`. How much more eligible ingestion you could add before hitting the cap. |
| `UnusedCapPct` | percent (0–100) | 70.0 | The same spare allowance, as a percentage of the cap — easier to eyeball than a raw GB figure. |
| `AnalysisWindowDays` | count (whole number) | 30 | The look-back window this row was computed over, restated so the row is self-describing without reopening the query. |
| `GeneratedAtUtc` | timestamp (UTC) | 2026-01-15 12:00:00 PM UTC | When this row was computed — useful context if you save or share the result later. |
| `EligibleTableBreakdown` | JSON array | 5 objects | Per-`DataType` GB/day breakdown, sorted highest-first, tagged `"Eligibility": "Core"` or `"Conditional"`. See [Per-table breakdown](#per-table-breakdown). |
| `WorkspaceBreakdown` | JSON array | 1 object | Per-workspace sub-totals — Nodes, CapGBPerDay, ConservativeFreeGBPerDay, ExpandedFreeGBPerDay — before they're summed into the overall row. See [Per-workspace breakdown](#per-workspace-breakdown). |

> **Note on units:** every `...GBPerDay` column is a **GB-equivalent daily
> rate using 1024 MB per GB in this query**. It is not a period total. The
> `...GBPerMonth`/`...GBPerYear`
> columns are the same per-day figures multiplied by an average month
> (30.4368 days) or year (365.25 days) — a convenience unit, not a new
> measurement. `...Pct` columns are plain percentages (0–100).
> `AnalysisWindowDays` is a day count and `GeneratedAtUtc` is a timestamp —
> neither is a GB figure. `Workspaces` and `Nodes` are plain counts, not rates.

**Turning this into a dollar figure:** multiply `RecommendedFreeGBPerMonth`
(or `RecommendedFreeGBPerDay` / `RecommendedFreeGBPerYear`, whichever period
you're quoting) by your effective per-GB ingestion price:

```text
Estimated monthly savings = RecommendedFreeGBPerMonth × price-per-GB
```

Using the dummy result at a rough $2.30/GB list rate:
**356.11 × 2.30 ≈ $819.05/month** in free ingestion the P2 benefit is
covering (or would cover, if you're not yet on P2). At 100% coverage
(`ConservativeCoveragePct`) with 27.363 GB/day of spare allowance
(`UnusedCapGBPerDay`, 70.0% of the cap unused), there's meaningful headroom
here to onboard more eligible data sources before the benefit runs out.

### Expected result patterns

The exact values change with your scope, machines, telemetry, and the time the
query runs. These fictional patterns show how to interpret common outcomes;
they are not customer or tenant data:

| Pattern | What you may see | What it usually means |
| --- | --- | --- |
| Core-only activity | `ConservativeEligibleGBPerDay` equals `ExpandedEligibleGBPerDay` and the JSON lists only core tables | No conditional-table usage was observed, or the current service configuration does not write to those tables. This is normal. |
| Conditional activity | `ExpandedEligibleGBPerDay` is greater than `ConservativeEligibleGBPerDay` and `Update`, `UpdateSummary`, or `WindowsEvent` appears in the JSON | Additional data was observed, but the expanded amount may not qualify in full. Review the eligibility conditions before using it for planning. |
| Below the cap | `ConservativeFreeGBPerDay` equals `ConservativeEligibleGBPerDay` and `UnusedCapGBPerDay` is positive | The observed conservative eligible volume is below the estimated allowance. |
| At or above the cap | `ConservativeFreeGBPerDay` equals `CapGBPerDay` and `ConservativeCoveragePct` is below 100% | The estimated allowance is fully used; some eligible ingestion may be charged outside the benefit. |
| No heartbeat data | `Nodes` and `CapGBPerDay` are zero, or lower than the protected-server inventory | The selected scope has no visible heartbeat data, or some protected machines use agentless coverage or lack monitoring data. |
| Multiple workspaces | `WorkspaceBreakdown` contains several objects | Each workspace was evaluated separately before the displayed totals were combined. Check shared-subscription limitations before treating the aggregate as authoritative. |
| Empty table breakdown | `EligibleTableBreakdown` is empty | No billable `Usage` rows matched the eligible table lists during the look-back window. This does not mean the tables are unsupported. |

For a real run, preserve the complete CSV row and both JSON arrays when
investigating a change. Do not replace a real result with these fictional
examples, and do not publish workspace identifiers, timestamps, or raw tenant
breakdowns in documentation or issue reports.

## Automate it

Once the query works manually, schedule it so changes in coverage, ingestion,
and unused capacity are visible without repeating the portal steps by hand.
The recommended pattern is to save the KQL as a version-controlled `.kql`
file, run it on a regular schedule, store the complete result row, and alert
only when a meaningful threshold is crossed.

### Automation walkthrough

1. **Save the approved query.** Keep this document and the copied KQL together
  in source control. Treat changes to the eligible-table lists, look-back
  window, and node-counting logic as reviewable changes.
2. **Choose an execution method.** Use the [Azure Monitor Query API and SDKs](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/api/overview)
  from a scheduled Azure Function, Automation runbook, Logic App, GitHub
  Actions workflow, or another approved job. The Azure CLI can also run a
  saved query with `az monitor log-analytics query`.
3. **Set up least-privilege access.** Give the job read access to each target
  Log Analytics workspace. Prefer a managed identity or workload identity;
  do not place user passwords, client secrets, or exported tenant data in the
  query file or source repository.
4. **Run at a useful interval.** Daily is usually enough because `Usage` is
  hourly and can lag. Keep the query's 30-day window so the result is a
  stable trend rather than a noisy single-day snapshot.
5. **Store the complete result.** Retain the scalar columns plus both JSON
  arrays. The arrays explain which tables contributed and which workspace was
  capped, which makes an alert or cost review easier to investigate.
6. **Apply thresholds to the conservative value.** Alert on conditions such
  as `UnusedCapPct < 20`, `ConservativeCoveragePct < 100`, a sharp increase in
  `ConservativeEligibleGBPerDay`, or a sudden drop in `Nodes`. Use the
  conservative value for action; keep `ExpandedEligibleGBPerDay` as context,
  not as a billing commitment.
7. **Review exceptions.** A changed result can indicate new telemetry, a
  retired machine, missing scope/RBAC, delayed `Usage`, a changed workspace
  design, or a licensing change. Compare stored breakdowns with Defender for
  Cloud, Azure Arc, and Cost Management before taking action.

### Where the result can go

- **Dashboard or workbook:** publish scalar columns as trends for nodes,
  eligible GB/day, free GB/day, coverage, and unused headroom. Keep the JSON
  arrays available as drill-through detail.
- **Alerting:** send a notification when headroom is low, coverage falls
  below 100%, node counts change unexpectedly, or a table begins contributing
  significant volume.
- **Cost and governance review:** retain daily or weekly snapshots for P2
  planning, renewal discussions, chargeback conversations, and evidence of
  review. The result is an estimate, not an invoice or entitlement record.
- **Remediation workflow:** use a low-headroom alert to start an approved
  review of noisy sources, custom collection filters, FIM scope, workspace
  routing, or retention and ingestion settings. Do not automatically disable
  security telemetry based on this estimate alone.
- **Sentinel Optimizer:** pass the complete exported row to the Defender P2
  Benefit tool for a plain-language explanation. Keep the original result
  alongside the explanation so the source values remain auditable.

### Important automation boundaries

The Azure portal can resolve the query across the resources selected in **Logs
→ Scope**. API and CLI jobs are commonly scoped to an individual workspace,
so multi-workspace automation should run once per workspace, retain the
workspace identifier, and aggregate results only after considering the
subscription/workspace limitation described in [Result fields](#result-fields).
Do not simply add workspace caps together if one workspace receives machines
from multiple subscriptions. Scheduled output inherits the same limitations
as a manual run: `Heartbeat` is a monitoring proxy, `Usage` can lag,
agentless-only machines may not be counted, and the result does not prove Plan
2 protection or entitlement.

## Result fields

Microsoft Defender for Servers Plan 2 grants **500 MB of free Log Analytics
ingestion per protected machine, per day**, for a fixed set of security data
types. Three details in the official docs change how you should query for it,
and all three are handled by the query above:

1. **The allowance is calculated per subscription and applied at workspace
  level.** Microsoft's current documentation says the total daily allowance
  is calculated across all machines in a subscription, while the benefit is
  applied at the Log Analytics workspace level. This query caps
  `ConservativeEligibleGBPerDay`/`ExpandedEligibleGBPerDay` per workspace
  (grouped by `TenantId`, Log Analytics' standard — if oddly named —
  workspace-GUID column) because `Usage` is aggregated at workspace grain.
  That is exact when each workspace belongs to one subscription. If several
  subscriptions report to one workspace, the query cannot allocate the
  aggregated `Usage` back to subscriptions without an unsupported assumption;
  use the result as an estimate and validate it against Microsoft's allocation
  view or Cost Management data.
2. **Only some tables are eligible unconditionally.** `SecurityAlert`,
   `SecurityBaseline`, `SecurityBaselineSummary`, `SecurityDetection`,
   `SecurityEvent`, `WindowsFirewall`, `ProtectionStatus`,
   `MDCFileIntegrityMonitoringEvents`, `DeviceCustomFileEvents`, and
   `DeviceCustomRegistryEvents` always qualify. `Update` and `UpdateSummary`
   qualify only when the Update Management solution isn't running in the
   workspace (or solution targeting is enabled), and `WindowsEvent` qualifies
   only for rows from the `Microsoft-SecurityEvent` stream — the aggregated
   `Usage` table can't distinguish that stream from Application/System channel
   volume in the same table. The query reports both a `Conservative` estimate
   (core tables only) and an `Expanded` estimate (core + conditional tables) so
   you don't over-promise a savings number that depends on tenant-specific
   configuration.

   That "Update Management solution" condition refers to the **legacy**
   Log Analytics/Azure Automation-based Update Management solution — not
   [Azure Update Manager](https://learn.microsoft.com/en-us/azure/update-manager/overview),
   Microsoft's current, recommended patching service. Update Manager is built
   natively on Azure VMs/Arc-enabled servers with, in Microsoft's own words,
   "no dependency on Log Analytics and Azure Automation." If your estate has
   fully moved to Update Manager, expect `Update`/`UpdateSummary` to show
   little or no data in your workspace — that's expected, not a query bug,
   and it's exactly why `ConservativeEligibleGBPerDay` doesn't depend on
   those two tables at all.
3. **The benefit is scope-aware, not workspace-hardcoded.** The query never
   references a workspace ID. Azure Monitor Logs resolves `Heartbeat` and
   `Usage` across whatever subscriptions/workspaces you select under **Logs →
   Scope**, so the same copy/paste works whether you're checking one
   workspace or an entire enterprise tenant — no per-workspace edits required.

Node counting uses `dcount(Computer)` scoped **within each workspace** (via
`summarize ... by WorkspaceId`), which sidesteps the classic cross-workspace
name-collision problem without needing a `_ResourceId`/`_SubscriptionId`
lookup: two workspaces can each have a machine named `WEB01` without inflating
or deflating either workspace's own node count.

### File integrity monitoring (FIM) and this benefit

[File integrity monitoring](https://learn.microsoft.com/en-us/azure/defender-for-cloud/file-integrity-monitoring-overview)
is itself a Defender for Servers Plan 2 feature — it's **not enabled by
default**, and it directly feeds one of this query's always-eligible tables,
`MDCFileIntegrityMonitoringEvents`. Microsoft states outright: "Collected
file integrity monitoring data is part of the 500-MB benefit included in
Defender for Servers Plan 2." In other words, if you have spare allowance
(`UnusedCapGBPerDay`/`UnusedCapPct` in this query's output), turning on FIM
is a way to add real, useful security telemetry using ingestion that's
already free — not a way to spend new budget.

Two things worth knowing before you rely on that:

- **FIM has two collection methods**, both counted toward the benefit per
  Microsoft's docs: the **Defender for Endpoint (MDE) agent** (near-real-time
  streaming) and **agentless scanning** (24-hour cadence). The ingestion
  benefit article only names `MDCFileIntegrityMonitoringEvents` explicitly
  for *agentless* FIM; it doesn't call out a separate table name for
  MDE-agent-collected FIM events. If MDE-agent FIM data lands in the same
  `MDCFileIntegrityMonitoringEvents` table, this query already counts it in
  full. If it's written somewhere else in your environment, this query
  wouldn't see it — worth a quick check (`MDCFileIntegrityMonitoringEvents |
  where TimeGenerated > ago(1d) | summarize count() by SourceSystem` or
  similar) if you have FIM enabled and want to confirm.
- **Legacy AMA/MMA-based FIM is being retired.** Microsoft's own migration
  guidance says machines using the older Log Analytics agent/Azure Monitor
  Agent-based FIM must move to the MDE-based approach to keep receiving FIM
  data at all. If you're still on the legacy method, that's a separate
  problem from this query (your FIM data may stop flowing regardless of the
  ingestion benefit) — see
  [migrate file integrity monitoring](https://learn.microsoft.com/en-us/azure/defender-for-cloud/migrate-file-integrity-monitoring)
  before troubleshooting benefit numbers.

### Azure Arc and this estimate

[Azure Arc](https://learn.microsoft.com/en-us/azure/azure-arc/overview)
projects Windows and Linux servers hosted outside Azure into Azure Resource
Manager, so Arc-enabled servers can use services such as Defender for Cloud,
Azure Monitor, and Azure Update Manager. Arc's server control-plane
capabilities (such as organization, tagging, Resource Graph, RBAC, and
extensions) are offered at no extra charge, but Azure Monitor and Defender for
Cloud remain separately billed services. Arc registration itself does not
provide the 500-MB benefit or create a Log Analytics ingestion record.

  For this query, an Arc-enabled server contributes to `Nodes` only when it
  actually sends `Heartbeat` data through AMA or MMA, and its eligible telemetry
  contributes only when it appears as billable `Usage` in a workspace included in
  the current **Logs → Scope**. Therefore, use the query's result as an estimate
  of the monitored Arc-connected estate, not as an inventory of every machine
  registered with Arc. Arc machines using Defender or agentless capabilities
  without a monitoring agent may be protected but won't appear in this query's
  heartbeat-based node count; compare `Nodes` with the Arc and Defender
  inventories when validating coverage.

### Custom data collection and this estimate

[Custom data collection in Microsoft Defender for Endpoint](https://learn.microsoft.com/en-us/defender-endpoint/custom-data-collection)
can add targeted endpoint events to a connected Microsoft Sentinel workspace.
That directly affects this estimate when the events are written to a table
and appear as billable `Usage`: more collected events increase the eligible
ingestion measured by the query and can consume more of the per-node allowance.
Microsoft describes the feature as a way to control noise and ingestion costs
by targeting devices and filtering event types, so its filters are also a
useful way to manage `UnusedCapGBPerDay` headroom.

The article lists `DeviceCustomFileEvents` among its supported event tables,
and that table is already in this query's `coreEligible` set. Custom file
events therefore contribute to `ConservativeEligibleGBPerDay` when they are
billable in `Usage`. The article also lists other custom tables, such as
`DeviceCustomProcessEvents`, `DeviceCustomNetworkEvents`, and
`DeviceCustomScriptEvents`; this query does **not** automatically classify
those tables as P2-benefit eligible because the Defender ingestion-benefit
documentation does not establish that eligibility here. Check the official
benefit table list and your own `Usage` data before adding any table to the
query's eligibility set.

## Troubleshooting and FAQ

**Q: `Workspaces` shows fewer workspaces than I expected — did I miss some?**
Usually one of two things: (1) your **Scope** selection doesn't actually include every subscription you meant to — reopen the Scope picker and confirm each one is checked; or (2) you're missing **Log Analytics Reader** (or better) on some workspaces. Missing RBAC causes a workspace to be silently excluded from Scope rather than showing an error, so a partial result can look complete. Ask your administrator to confirm your role assignments if the count looks low.

**Q: The `Nodes` count looks lower than my actual server count.**
`Heartbeat` only includes machines reporting through the Azure Monitor Agent (AMA) or legacy MMA agent. Servers protected only through **agentless scanning** (no agent installed) never send a heartbeat and won't be counted here, which understates both `Nodes` and `CapGBPerDay`. This is a genuine gap in what KQL can see, not a query bug — cross-check your actual protected-server count in Defender for Cloud's inventory.

**Q: Why did `ConservativeEligibleGBPerDay` increase after enabling custom data collection?**
If the rule targets files and writes events to `DeviceCustomFileEvents`, the increase is expected: that table is included in the query's core eligible set, and additional billable events consume more of the available benefit. Narrow the rule's device targeting or event filters if the added volume is not worth the security value. For other custom event tables, confirm eligibility separately before changing the query.

**Q: `ExpandedEligibleGBPerDay` equals `ConservativeEligibleGBPerDay` — is `Update`/`UpdateSummary`/`WindowsEvent` broken?**
Most likely not — it usually means those tables genuinely have no data in this workspace. If you've migrated to [Azure Update Manager](https://learn.microsoft.com/en-us/azure/update-manager/overview) (Microsoft's current patching service, which has no Log Analytics dependency), `Update`/`UpdateSummary` will legitimately show little or nothing, since Update Manager doesn't write to those tables the way the legacy Update Management solution did. That's expected, and it's exactly why the conservative estimate never depends on them.

**Q: My results change slightly between runs a few minutes apart.**
Expected — `Usage` isn't real-time and can lag by hours. The query uses a 30-day trailing average specifically to smooth this out; small drift (thousandths of a GB/day) between back-to-back runs is normal and not worth chasing. See [Verification](#verification) below for standalone checks.

**Q: The query editor rejects my paste, or nothing happens when I select Run.**
Check the mode dropdown at the top-right of the query editor — if it's set to **Simple mode** instead of **KQL mode**, this query (or any hand-written KQL) won't run. Switch it to **KQL mode** first.

## Verification

Verification can confirm that the returned numbers match the telemetry visible
to your identity. It cannot confirm facts outside the selected scope or
unavailable through your permissions, including the complete Defender for
Cloud protected-server inventory, Plan 2 licensing, entitlement assignment,
or the final Azure invoice. Treat a successful query run as evidence about
available Log Analytics data, not proof that every protected machine or every
eligible byte was visible.

Run these checks in the same Logs scope, with the same 30-day window, and
compare them with the combined query's output. If you lack access to one
workspace, record that missing scope rather than treating the aggregate as
complete.

### Confirm the node count

This should match the combined query's `Nodes` value. It counts distinct
computer names per workspace, then adds those workspace counts to avoid name
collisions between workspaces.

```kql
// 1) Verify Nodes — should match the combined query's Nodes column
let lookback = 30d;
Heartbeat
| where TimeGenerated > ago(lookback)
| summarize Nodes = dcount(Computer) by WorkspaceId = TenantId
| summarize Nodes = sum(Nodes)
```

### Confirm eligible ingestion

This should be close to `ConservativeEligibleGBPerDay`. Small differences can
come from rounding or delayed `Usage` records. It checks billable usage only
and uses the same core table list as the main query.

```kql
// Verify eligible ingestion — should be close to ConservativeEligibleGBPerDay
let lookback = 30d;
let lookbackDays = lookback / 1d;
Usage
| where TimeGenerated > ago(lookback) and IsBillable == true
| where DataType in (
    "SecurityAlert", "SecurityBaseline", "SecurityBaselineSummary", "SecurityDetection",
    "SecurityEvent", "WindowsFirewall", "ProtectionStatus", "MDCFileIntegrityMonitoringEvents",
    "DeviceCustomFileEvents", "DeviceCustomRegistryEvents")
| summarize round(sum(Quantity) / 1024.0 / lookbackDays, 3)
```

### Identify core contributing tables

This shows which eligible table names have billable usage rows in the window.
An omitted table may have zero usage or no row at all; that does not change
whether it is listed as eligible in the main query.

```kql
// See which eligible tables are contributing, and how much
let lookback = 30d;
let lookbackDays = lookback / 1d;
Usage
| where TimeGenerated > ago(lookback) and IsBillable == true
| where DataType in (
    "SecurityAlert", "SecurityBaseline", "SecurityBaselineSummary", "SecurityDetection",
    "SecurityEvent", "WindowsFirewall", "ProtectionStatus", "MDCFileIntegrityMonitoringEvents",
    "DeviceCustomFileEvents", "DeviceCustomRegistryEvents")
| summarize GBPerDay = round(sum(Quantity) / 1024.0 / lookbackDays, 3) by DataType
| sort by GBPerDay desc
```

### Check conditional contributing tables

Run this additional check when you want to explain a difference between the
conservative and expanded values. `Update` and `UpdateSummary` depend on the
legacy Update Management condition, and `WindowsEvent` requires the
`Microsoft-SecurityEvent` stream. Because `Usage` does not preserve enough
detail to prove those conditions per row, treat this output as context rather
than confirmed free-benefit volume.

```kql
// Check conditional tables — context for ExpandedEligibleGBPerDay
let lookback = 30d;
let lookbackDays = lookback / 1d;
Usage
| where TimeGenerated > ago(lookback) and IsBillable == true
| where DataType in ("Update", "UpdateSummary", "WindowsEvent")
| summarize GBPerDay = round(sum(Quantity) / 1024.0 / lookbackDays, 3) by DataType
| sort by GBPerDay desc
```

### Confirm the allowance cap

The query estimates the cap as `Nodes × 500 MB ÷ 1024`. Calculate that value
independently using the verified node count, then compare it with
`CapGBPerDay`. If they differ, first confirm that the two checks used the same
scope and look-back window. This check validates the capacity ceiling; it does
not prove that every counted node is licensed for Plan 2.

### Confirm the final result relationships

Check these relationships in the returned row:

- `RecommendedFreeGBPerDay` equals `ConservativeFreeGBPerDay`.
- `ConservativeFreeGBPerDay` equals the lower of
  `ConservativeEligibleGBPerDay` and `CapGBPerDay`.
- `ExpandedFreeGBPerDay` equals the lower of
  `ExpandedEligibleGBPerDay` and `CapGBPerDay`.
- `UnusedCapGBPerDay` is the non-negative difference between
  `CapGBPerDay` and `ConservativeFreeGBPerDay`.
- `UnusedCapPct` is `UnusedCapGBPerDay ÷ CapGBPerDay × 100` when the cap is
  greater than zero.
- Monthly and yearly columns are the displayed daily values multiplied by
  the documented average month or year, subject to rounding.

If these relationships do not hold, re-copy the current query and check that
the CSV header and data row were not mixed together. Do not attempt to repair
the output by manually editing values.

Small differences (thousandths of a GB/day) between these checks and the
combined query are expected because of rounding and `Usage` latency. Large
differences, missing workspaces, or an unexpected zero result usually point to
scope, RBAC, data-retention, or ingestion-timing differences. Check the
workspace list and permissions first, then compare with Defender for Cloud's
protected-server inventory and Cost Management. Those services remain the
authoritative places to validate protection, entitlement, and billed cost.

## Sources

- [Use the data ingestion benefit in Microsoft Defender for Cloud](https://learn.microsoft.com/en-us/azure/defender-for-cloud/data-ingestion-benefit) — supported data types, the 500 MB/node/day rule, and the docs' own per-subscription framing of the allowance (this query approximates it at the workspace level, the closest grain KQL can resolve — see [How the query works](#how-the-query-works)).
- [Log Analytics table reference index by category (Security)](https://learn.microsoft.com/en-us/azure/azure-monitor/reference/tables-category#security) — the full Security-category table index the benefit doc points to; every table in `coreEligible`/`conditionalEligible` was cross-checked against this list to confirm it's a real, current Azure Monitor table name (not a typo or a retired one).
- [Cross-workspace queries in Azure Monitor Logs](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/cross-workspace-query) — how Logs scope resolves queries across workspaces/subscriptions without embedding workspace IDs.
- [Common questions - Microsoft Defender for Servers](https://learn.microsoft.com/en-us/azure/defender-for-cloud/faq-defender-for-servers) — Plan 1 vs Plan 2 feature and pricing FAQ.
- [Overview of file integrity monitoring in Microsoft Defender for Cloud](https://learn.microsoft.com/en-us/azure/defender-for-cloud/file-integrity-monitoring-overview) — confirms FIM data (both MDE-agent and agentless collection) counts toward the 500 MB benefit; see [File integrity monitoring (FIM) and this benefit](#file-integrity-monitoring-fim-and-this-benefit) above.
- [Azure Update Manager Overview](https://learn.microsoft.com/en-us/azure/update-manager/overview) — confirms Update Manager, Microsoft's current patching service, has "no dependency on Log Analytics and Azure Automation," explaining why `Update`/`UpdateSummary` can show little or no data once an estate has migrated off the legacy Update Management solution.
- [Azure Arc overview](https://learn.microsoft.com/en-us/azure/azure-arc/overview) — confirms Arc projects non-Azure servers into Azure management, while Arc control-plane capabilities and Azure Monitor/Defender for Cloud usage have separate pricing and data-flow implications.
- [Custom data collection in Microsoft Defender for Endpoint](https://learn.microsoft.com/en-us/defender-endpoint/custom-data-collection) — confirms targeted custom endpoint events are routed to a connected Sentinel workspace and lists `DeviceCustomFileEvents` among the supported tables; this query counts that table as core-eligible.

> **Validated:** as of this writing, all 13 tables in `coreEligible`
> (`SecurityAlert`, `SecurityBaseline`, `SecurityBaselineSummary`,
> `SecurityDetection`, `SecurityEvent`, `WindowsFirewall`, `ProtectionStatus`,
> `MDCFileIntegrityMonitoringEvents`, `DeviceCustomFileEvents`,
> `DeviceCustomRegistryEvents`) and `conditionalEligible`
> (`Update`, `UpdateSummary`, `WindowsEvent`) match the data ingestion
> benefit article's own "Supported data types" list word-for-word, and each
> table name was confirmed to exist in the Azure Monitor table reference
> index. `Update` and `WindowsEvent` are cross-listed in other categories
> (IT & Management Tools, Virtual Machines) as well as Security — that's
> normal; a table can belong to more than one category, and it doesn't
> change its eligibility here.
