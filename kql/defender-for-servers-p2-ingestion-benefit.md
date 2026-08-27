---
id: defender-for-servers-p2-ingestion-benefit
title: "Defender for Servers Plan 2 — data ingestion benefit sizing"
status: estimate
lastReviewed: "2026-08-27"
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
- [Multi-workspace behavior](#multi-workspace-behavior)
- [Query](#query)
- [How the query works](#how-the-query-works)
- [Example result](#example-result)
- [Automation guidance](#automation-guidance)
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
Azure Monitor Logs, run it, and read the `Summary` row plus its workspace
detail rows. No manual math,
no cross-referencing tables, no workspace-by-workspace guesswork — it works
whether you're checking one workspace or an entire tenant (see
[How to use it](#how-to-use-it)).

The ingestion benefit is applied automatically to eligible data when the
Defender for Servers Plan 2 prerequisites are met; there is no separate
"enable benefit" toggle. The benefit itself is a zero-cost allocation, so it
typically appears in product/cost-allocation views rather than as a direct
invoice line item. The query reports eligible ingestion, free ingestion,
unused capacity, and over-cap ingestion separately for each workspace and for
the overall Summary row.

**Why this is useful:**

- **P1 → P2**: run this against your current Plan 1 estate to see how much of
  your existing eligible ingestion Plan 2 would immediately offset for free,
  then compare that dollar value to the P1→P2 per-node price delta.
- **Nothing → P2**: run this to estimate the free ingestion you'd receive from
  day one, as a floor on the effective cost of turning Plan 2 on.
- **Already on P2**: run this periodically to see how much of your allowance
  you're actually using (`FreeGBPerDay` vs `CapGBPerDay`) and
  whether unused headroom exists to onboard more eligible data sources.

  ## Multi-workspace behavior

  The query summarizes across every workspace available in the current
  **Logs -> Scope** that has a recent `Usage` or `Heartbeat` row. It returns one
  aggregate `Summary` row and one `Workspace` row per discovered workspace. The
  license-based cap is calculated once from `Nodes` in the Summary row; it is not
  multiplied by the number of workspaces.

  This is a scope-aware estimate, not a tenant inventory. Workspaces outside the
  selected Logs scope, unreadable workspaces, and workspaces with neither source
  of data are absent. Confirm the selected scope and Log Analytics Reader access
  before treating the Summary count as complete. For separate batches, retain
  only Workspace rows, remove duplicate workspace IDs, and recalculate the
  aggregate. Never add Summary rows from batches that represent the same Plan 2
  allowance.

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
- **Execution context:** run from **Azure Monitor Logs** with Log Analytics
  workspace scope selection. Do not run this from Resource Graph Explorer or
  expect subscription/resource-group contexts to expose `Usage` the same way.
- **Licensing context:** know which machines and workspaces are actually
  covered by Defender for Servers Plan 2. The query estimates from telemetry;
  it does not prove protection, licensing, or entitlement.
- **Operational safety:** run the query read-only, review the result before
  making cost or security changes, and avoid exporting tenant data to places
  that are not approved for your organization's information.

For automation, use a managed identity or workload identity with workspace
read access instead of a personal account. See
[Automation guidance](#automation-guidance) for the scheduling and storage pattern.

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
  query editor). Select every workspace (or subscription containing target
  workspaces) whose servers you want counted. There is no implicit
  all-workspaces scope, so include each target explicitly.
4. **Copy the query.** Use the "Copy query" button above, or open the
   **Defender P2 Benefit** tool in [Sentinel Optimizer](https://sentineloptimizer.com)
   (the tab alongside Sentinel Cost, Defender for Cloud, and Usage & Quotas)
   — it has the same query, the same walkthrough, and a place to paste your
   result when you're done.
5. **Paste it into the big empty text box** in the Logs window (that's the
   query editor) and select **Run** (or press **Shift+Enter**).
6. **Read the results** that appear in the table below the query. The first
  row is `Summary`; the following rows contain workspace details. See
  [Example result](#example-result) below for what each column means.
7. **Get the raw result row.** Select **Share** above the results grid →
   **Export to CSV - all columns**, then open the downloaded file and copy
   the `Summary` row (skip the header row).
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
> Workspace billing model still matters for downstream interpretation:
> Microsoft documents that classic Sentinel meters apply this benefit to Log
> Analytics ingestion, while simplified (unified) Sentinel meters apply it to
> Sentinel ingestion.
>
> No workspace yet? Try the query against Microsoft's read-only
> [Log Analytics demo environment](https://portal.azure.com/#blade/Microsoft_Azure_Monitoring_Logs/DemoLogsBlade)
> instead — sample data only, no subscription required.

The query below follows the Microsoft documentation pattern: it returns one
`Summary` row and one `Workspace` row per workspace. The summary row provides
the aggregate, while the workspace rows preserve the detail needed to combine
batches of up to 100 workspaces. It includes every supported table in the
per-workspace breakdown, including tables with zero observed usage.

```kql
// Estimates the Defender for Servers Plan 2 data ingestion benefit
// (500 MB per node per day) for the selected Log Analytics workspaces.
let lookback = 30d;
let lookbackDays = lookback / 1d;
let coreEligible = dynamic([
  "SecurityAlert", "SecurityBaseline", "SecurityBaselineSummary", "SecurityDetection",
  "SecurityEvent", "WindowsFirewall", "ProtectionStatus", "MDCFileIntegrityMonitoringEvents",
  "DeviceCustomFileEvents", "DeviceCustomRegistryEvents"]);
let conditionalEligible = dynamic(["Update", "UpdateSummary", "WindowsEvent"]);
let allEligibleTables = materialize(
  print DataType = array_concat(coreEligible, conditionalEligible)
  | mv-expand DataType to typeof(string)
  | project DataType
);
let allEligibleUsage = materialize(
  Usage
  | where TimeGenerated > ago(lookback) and IsBillable == true
  | where DataType in (coreEligible) or DataType in (conditionalEligible)
  | project WorkspaceId = TenantId, DataType, Quantity
);
let perTableDaily = materialize(
  allEligibleUsage
  | summarize GBPerDayRaw = sum(Quantity) / 1024.0 / lookbackDays
    by WorkspaceId, DataType
);
let perWorkspaceAllEligible = materialize(
  allEligibleUsage
  | summarize EligibleGBPerDay = sum(Quantity) / 1024.0 / lookbackDays by WorkspaceId
);
let workspaceIds = materialize(
  union
    (Heartbeat
    | where TimeGenerated > ago(lookback)
    | summarize by WorkspaceId = TenantId),
    (perWorkspaceAllEligible | project WorkspaceId)
  | distinct WorkspaceId
);
let perTableAllEligible = materialize(
  workspaceIds
  | extend JoinKey = 1
  | join kind=inner (allEligibleTables | extend JoinKey = 1) on JoinKey
  | project WorkspaceId, DataType
  | join kind=leftouter (
    perTableDaily
    | extend Eligibility = iff(DataType in (coreEligible), "Core", "Conditional")
    | project WorkspaceId, DataType, GBPerDayRaw, Eligibility
  ) on WorkspaceId, DataType
  | extend GBPerDay = round(coalesce(GBPerDayRaw, 0.0), 3)
  | extend Eligibility = coalesce(Eligibility, iff(DataType in (coreEligible), "Core", "Conditional"))
  | summarize EligibleTableBreakdown = make_bag(pack(DataType, pack("GBPerDay", GBPerDay, "Eligibility", Eligibility)))
    by WorkspaceId
);
let perWorkspace = materialize(
  workspaceIds
  | join kind=leftouter (
    Heartbeat
    | where TimeGenerated > ago(lookback)
    | summarize Nodes = dcount(Computer) by WorkspaceId = TenantId
  ) on WorkspaceId
  | join kind=leftouter perWorkspaceAllEligible on WorkspaceId
  | extend Nodes = toint(coalesce(Nodes, 0))
  | extend EligibleGBPerDay = coalesce(EligibleGBPerDay, 0.0)
  | extend CapGBPerDay = Nodes * 500.0 / 1024.0
  | extend FreeGBPerDay = min_of(EligibleGBPerDay, CapGBPerDay)
  | extend UnusedCapGBPerDay = max_of(CapGBPerDay - FreeGBPerDay, 0.0)
  | extend OverCapGBPerDay = max_of(EligibleGBPerDay - CapGBPerDay, 0.0)
);
let workspaceRows = perWorkspace
  | join kind=leftouter perTableAllEligible on WorkspaceId
  | extend EligibleTableBreakdown = coalesce(EligibleTableBreakdown, dynamic({}))
  | project
    RowType = "Workspace",
    WorkspaceId,
    Nodes = tolong(Nodes),
    CapGBPerDay = round(CapGBPerDay, 3),
    EligibleGBPerDay,
    EligibleTableBreakdown,
    FreeGBPerDay,
    UnusedCapGBPerDay,
    OverCapGBPerDay;
let summaryRow = perWorkspace
  | summarize
    WorkspaceCount = dcount(WorkspaceId),
    Nodes = sum(Nodes),
    CapGBPerDay = sum(CapGBPerDay),
    EligibleGBPerDay = sum(EligibleGBPerDay),
    FreeGBPerDay = sum(FreeGBPerDay),
    UnusedCapGBPerDay = sum(UnusedCapGBPerDay),
    OverCapGBPerDay = sum(OverCapGBPerDay)
  | extend
    RowType = "Summary",
    WorkspaceId = tostring(WorkspaceCount),
    EligibleTableBreakdown = dynamic({})
  | project
    RowType,
    WorkspaceId,
    Nodes,
    CapGBPerDay = round(CapGBPerDay, 3),
    EligibleGBPerDay = round(EligibleGBPerDay, 3),
    EligibleTableBreakdown,
    FreeGBPerDay = round(FreeGBPerDay, 3),
    UnusedCapGBPerDay = round(UnusedCapGBPerDay, 3),
    OverCapGBPerDay = round(OverCapGBPerDay, 3);
union summaryRow, workspaceRows
| sort by RowType asc, FreeGBPerDay desc
```

## How the query works

| # | KQL | What it does |
| --- | --- | --- |
| 1 | `let lookback = 30d;` / `let lookbackDays = lookback / 1d;` | Sets the look-back window (30 days) and converts it to a plain number so later steps can divide by it. |
| 2 | `let coreEligible = dynamic([...])` | Lists the 10 tables that **always** qualify for the P2 benefit. |
| 3 | `let conditionalEligible = dynamic([...])` | Lists the 3 tables that only **sometimes** qualify (`Update`, `UpdateSummary`, and `WindowsEvent`). Review the documented stream and Update Management conditions before treating the expanded amount as covered. |
| 4 | `let allEligibleTables = materialize(...)` | Builds the complete supported-table list so every workspace breakdown includes zero-volume supported tables. |
| 5 | `let allEligibleUsage = materialize(Usage \| ...)` | Filters billable usage to supported tables and retains the workspace, table, and quantity columns. |
| 6 | `let perTableDaily = materialize(...)` | Calculates the 30-day average GB/day for each supported table in each workspace. |
| 7 | `let workspaceIds = materialize(...)` | Includes workspaces found through either `Heartbeat` or eligible `Usage`, including workspaces with no heartbeat nodes. |
| 8 | `let perTableAllEligible = materialize(...)` | Left-joins every supported table to each workspace and packs the values into `EligibleTableBreakdown`. |
| 9 | `let perWorkspace = materialize(...)` | Joins node counts and eligible ingestion, then calculates the daily cap, free amount, unused cap, and over-cap amount per workspace. |
| 10 | `let workspaceRows = perWorkspace ...` | Projects one detail row for each workspace with its numeric values and table breakdown. |
| 11 | `let summaryRow = perWorkspace ...` | Aggregates the workspace rows into one `Summary` row; `WorkspaceId` contains the workspace count for this row. |
| 12 | `union summaryRow, workspaceRows` | Returns the summary followed by workspace detail rows, ordered by row type and free ingestion. |

> **Units:** `Usage.Quantity` is stored in MB, so the query divides by 1,024
> to convert it to GB. Every `...GBPerDay` value is a daily rate, not a period
> total. `EligibleTableBreakdown` is a JSON object containing every supported
> table, including tables with zero observed usage. Select the row's **">"**
> chevron in the results grid to inspect the supported tables and values.

> **Tip:** use **`FreeGBPerDay`** as the estimated daily free ingestion. It is
> the lower of `EligibleGBPerDay` and `CapGBPerDay`. Use the workspace rows
> when combining batches; do not add a `Summary` row to workspace rows.

## Known limits

> - **Subscription/workspace grain**: Microsoft says the daily allowance is calculated across machines in each subscription, while the benefit is applied at the workspace level. `Usage` is hourly workspace-level data and does not provide a reliable subscription key for allocating eligible volume. This query therefore pools nodes and eligible usage by workspace, which is exact for a one-subscription-per-workspace design but can misstate results when multiple subscriptions share one workspace. For shared workspaces, treat the result as an estimate and validate against Microsoft's allocation view or Cost Management data.
> - **Workspace scale**: the Scope picker uses implicit resource-context resolution, not the explicit `workspace()`/`app()` functions — those are capped at 100 workspaces per query, this isn't, but selecting hundreds of workspaces can still slow the query down or hit the Log Analytics query timeout (10 minutes by default). For very large estates, run per-management-group or per-region and sum the results.
> - **RBAC is silent**: you need Log Analytics Reader (or better) on every workspace in scope. Workspaces you can't read are silently omitted from Scope, not flagged as an error — a partial result can look like a complete one.
> - **`Usage` isn't real-time**: ingestion/usage data can lag by hours. A 30-day trailing average (the default `lookback` here) smooths this out; don't shrink `lookback` to 1d and expect an accurate daily number.
> - **Benefit visibility on billing artifacts**: this is a zero-cost allocation,
>   so do not expect a one-to-one billed invoice line named for the benefit;
>   validate allocation in Defender for Cloud and Cost Management exports.
> - **`Heartbeat` undercounts agentless-only nodes**: machines protected only through agentless scanning (no AMA/MMA agent) never send a heartbeat, so `Nodes` — and therefore `CapGBPerDay` — can be understated for agentless-heavy estates.
> - **`Heartbeat` is a monitoring proxy, not proof of P2 protection**: every machine counted here must be sending a heartbeat, but the table does not prove that the machine is covered by Defender for Servers Plan 2. It can therefore overstate the benefit if unprotected or differently licensed machines report to the workspace. Validate `Nodes` against the Defender for Cloud protected-server inventory and Plan 2 scope.
> - **The 30-day node count is not a daily node-day average**: `dcount(Computer)` counts any machine seen during the look-back window, even if it reported briefly. It can overstate the daily capacity for machines that were retired during the window and can misrepresent estates with substantial onboarding or offboarding churn. Use a shorter window or a separate daily node-day analysis when churn is material.
> - **Multiple subscriptions reporting into one workspace**: this query cannot allocate the workspace's aggregated `Usage` back to subscriptions. It pools the observed nodes and eligible usage at workspace grain, so shared-workspace results require validation and should not be presented as an exact subscription-level benefit calculation.

## Example result

Running the query produces one `Summary` row followed by one `Workspace` row
for each workspace. The following fictional example uses the Microsoft output
shape; it is not a tenant result:

| RowType | WorkspaceId | Nodes | CapGBPerDay | EligibleGBPerDay | FreeGBPerDay | UnusedCapGBPerDay | OverCapGBPerDay |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Summary | `6` | 75 | 36.621 | 0.916 | 0.916 | 35.705 | 0.000 |
| Workspace | `workspace-id-redacted-1` | 34 | 16.602 | 0.903 | 0.903 | 15.699 | 0.000 |
| Workspace | `workspace-id-redacted-2` | 1 | 0.488 | 0.011 | 0.011 | 0.477 | 0.000 |
| Workspace | `workspace-id-redacted-3` | 17 | 8.301 | 0.002 | 0.002 | 8.299 | 0.000 |

### CSV export shape

Use **Share → Export to CSV - all columns** in Azure Monitor Logs. The
download contains one header row, one `Summary` row, and one `Workspace` row
per workspace. CSV quoting is normal: JSON fields may be surrounded by double
quotes, while the JSON's internal quotes are doubled for CSV escaping.

The following abbreviated example shows the shape only; values and identifiers
are fictional. The actual export contains these nine columns in this same order:

```csv
RowType,WorkspaceId,Nodes,CapGBPerDay,EligibleGBPerDay,EligibleTableBreakdown,FreeGBPerDay,UnusedCapGBPerDay,OverCapGBPerDay
Summary,6,75,"36.621","0.916","{}","0.916","35.705","0.000"
```

Paste the complete `Summary` row, not the header or workspace rows, into the
Sentinel Optimizer result box. The JSON field is optional for manual entry.

### What to validate

This fictional example is consistent with the Microsoft query:

- The `Summary` row reports six workspaces and 75 observed nodes.
- `75 × 500 MB ÷ 1,024 = 36.621 GB/day`, displayed as `CapGBPerDay`.
- `FreeGBPerDay` is the lower of `EligibleGBPerDay` and `CapGBPerDay`.
- Workspace rows are calculated before the summary, so batch results can be
  combined by adding workspace rows and excluding summary rows.

### Per-table breakdown

`EligibleTableBreakdown` is a JSON object produced for each workspace. Each
property is a supported `DataType` whose value contains its 30-day average in
GB/day and its eligibility classification. The object includes zero-volume
supported tables.

| DataType | GB/day | Eligibility | Interpretation |
| --- | ---: | --- | --- |
| `SecurityEvent` | 0.715 | Core | Largest eligible contributor in this example. |
| `DeviceCustomFileEvents` | 0.188 | Core | Custom file telemetry contributing to eligible ingestion. |
| `WindowsFirewall` | 0.000 | Core | Supported table with no observed usage in this example. |
| `Update` | 0.001 | Conditional | Included only when the documented Update Management condition is satisfied. |

The object contains every supported table for the workspace, including tables
with no matching usage in the look-back window. The eligibility lists remain
the source of truth for supported tables.

The workspace rows are the per-workspace breakdown. The workspace identifier
is fictional and redacted. The summary is calculated from unrounded workspace
values, so totals can differ slightly from adding displayed rounded values.

What each column means, in plain terms:

| Column | Unit | Example value | What it means |
| --- | --- | --- | --- |
| `RowType` | text | `Summary` | `Summary` identifies the aggregate row; `Workspace` identifies a workspace detail row. |
| `WorkspaceId` | ID or count | `6` | The workspace identifier on detail rows; the summary row shows the workspace count. |
| `Nodes` | count | 75 | Distinct machines that sent a heartbeat during the look-back period. |
| `CapGBPerDay` | GB/day | 36.621 | Maximum daily benefit capacity: nodes × 500 MB ÷ 1,024. |
| `EligibleGBPerDay` | GB/day | 0.916 | Daily eligible ingestion, including supported conditional tables. |
| `EligibleTableBreakdown` | JSON object | 4 properties | Per-table daily ingestion and eligibility for every supported table in the workspace. |
| `FreeGBPerDay` | GB/day | 0.916 | Estimated free ingestion: the lower of eligible ingestion and the cap. |
| `UnusedCapGBPerDay` | GB/day | 35.705 | Daily benefit capacity not used by eligible ingestion. |
| `OverCapGBPerDay` | GB/day | 0.000 | Eligible ingestion above the estimated daily capacity, floored at zero. |

> **Note on units:** `Usage.Quantity` is stored in MB, so the query divides by
> 1,024 to convert it to GB. Every `...GBPerDay` value is a daily rate, not a
> period total. The summary and workspace values are calculated from the same
> 30-day look-back window.

**Turning this into a dollar figure:** multiply `FreeGBPerDay` by 30.4368 and
your effective per-GB ingestion price:

```text
Estimated monthly savings = FreeGBPerDay × 30.4368 × price-per-GB
```

Using the fictional Summary row at a rough $2.30/GB list rate:
**0.916 × 30.4368 × 2.30 ≈ $64.20/month** in free ingestion the benefit is
covering. The `UnusedCapGBPerDay` value shows the remaining daily capacity.

### Expected result patterns

The exact values change with your scope, machines, telemetry, and the time the
query runs. These fictional patterns show how to interpret common outcomes;
they are not customer or tenant data:

| Pattern | What you may see | What it usually means |
| --- | --- | --- |
| Core-only activity | The breakdown contains only core tables with non-zero values | No conditional-table usage was observed, or the current service configuration does not write to those tables. This is normal. |
| Conditional activity | `EligibleTableBreakdown` includes `Update`, `UpdateSummary`, or `WindowsEvent` with a non-zero value | Additional data was observed, but the expanded amount may not qualify in full. Review the eligibility conditions before using it for planning. |
| Below the cap | `FreeGBPerDay` equals `EligibleGBPerDay` and `UnusedCapGBPerDay` is positive | The observed eligible volume is below the estimated allowance. |
| At or above the cap | `FreeGBPerDay` equals `CapGBPerDay` and `OverCapGBPerDay` is positive | The estimated allowance is fully used; some eligible ingestion may be charged outside the benefit. |
| No heartbeat data | `Nodes` and `CapGBPerDay` are zero, or lower than the protected-server inventory | The selected scope has no visible heartbeat data, or some protected machines use agentless coverage or lack monitoring data. |
| Multiple workspaces | Several `Workspace` rows follow the `Summary` row | Each workspace was evaluated separately before the displayed totals were combined. Check shared-subscription limitations before treating the aggregate as authoritative. |
| Empty table breakdown | `EligibleTableBreakdown` is empty | No billable `Usage` rows matched the eligible table lists during the look-back window. This does not mean the tables are unsupported. |

For a real run, preserve the complete CSV export and the JSON breakdowns when
investigating a change. Do not replace a real result with these fictional
examples, and do not publish workspace identifiers, timestamps, or raw tenant
breakdowns in documentation or issue reports.

## Automation guidance

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
5. **Store the complete result.** Retain the scalar columns and
  `EligibleTableBreakdown`. The workspace rows explain which tables
  contributed, which makes an alert or cost review easier to investigate.
6. **Apply thresholds to the result.** Alert on conditions such
  as `UnusedCapGBPerDay` approaching zero, `OverCapGBPerDay` becoming positive,
  a sharp increase in `EligibleGBPerDay`, or a sudden drop in `Nodes`. Use the
  workspace rows for investigation and the Summary row for the aggregate.
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
  alongside the explanation so the source values remain auditable. Do not
  combine Summary rows with workspace rows.

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
  `EligibleGBPerDay` per workspace
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
  workspace (or solution targeting is enabled), and `WindowsEvent` is treated
  as conditional because `Usage` cannot prove the required stream. The query
  reports one eligible estimate using all supported tables. Conditional table
  entries are labeled in `EligibleTableBreakdown`; review their conditions
  before treating the full estimate as covered.

   That "Update Management solution" condition refers to the **legacy**
   Log Analytics/Azure Automation-based Update Management solution — not
   [Azure Update Manager](https://learn.microsoft.com/en-us/azure/update-manager/overview),
   Microsoft's current, recommended patching service. Update Manager is built
   natively on Azure VMs/Arc-enabled servers with, in Microsoft's own words,
   "no dependency on Log Analytics and Azure Automation." If your estate has
   fully moved to Update Manager, expect `Update`/`UpdateSummary` to show
   little or no data in your workspace — that's expected, not a query bug,
  and the query reports those tables as conditional when they are present.
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
events therefore contribute to `EligibleGBPerDay` when they are
billable in `Usage`. The article also lists other custom tables, such as
`DeviceCustomProcessEvents`, `DeviceCustomNetworkEvents`, and
`DeviceCustomScriptEvents`; this query does **not** automatically classify
those tables as P2-benefit eligible because the Defender ingestion-benefit
documentation does not establish that eligibility here. Check the official
benefit table list and your own `Usage` data before adding any table to the
query's eligibility set.

## Troubleshooting and FAQ

**Q: The Summary row shows fewer workspaces than I expected — did I miss some?**
Usually one of two things: (1) your **Scope** selection doesn't actually include every subscription you meant to — reopen the Scope picker and confirm each one is checked; or (2) you're missing **Log Analytics Reader** (or better) on some workspaces. Missing RBAC causes a workspace to be silently excluded from Scope rather than showing an error, so a partial result can look complete. Ask your administrator to confirm your role assignments if the count looks low.

**Q: The `Nodes` count looks lower than my actual server count.**
`Heartbeat` only includes machines reporting through the Azure Monitor Agent (AMA) or legacy MMA agent. Servers protected only through **agentless scanning** (no agent installed) never send a heartbeat and won't be counted here, which understates both `Nodes` and `CapGBPerDay`. This is a genuine gap in what KQL can see, not a query bug — cross-check your actual protected-server count in Defender for Cloud's inventory.

**Q: Why did `EligibleGBPerDay` increase after enabling custom data collection?**
If the rule targets files and writes events to `DeviceCustomFileEvents`, the increase is expected: that table is included in the query's core eligible set, and additional billable events consume more of the available benefit. Narrow the rule's device targeting or event filters if the added volume is not worth the security value. For other custom event tables, confirm eligibility separately before changing the query.

**Q: Why is `EligibleGBPerDay` lower than expected?**
Check the workspace scope, the `IsBillable` filter, and whether supported tables
contain data during the look-back period. If you've migrated to [Azure Update
Manager](https://learn.microsoft.com/en-us/azure/update-manager/overview),
`Update` and `UpdateSummary` may show little or no data because Update Manager
doesn't write to those tables the way the legacy solution did.

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

This should be close to `EligibleGBPerDay`. Small differences can
come from rounding or delayed `Usage` records. It checks billable usage only
and uses the same core table list as the main query.

```kql
// Verify eligible ingestion — should be close to EligibleGBPerDay
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

### Confirm total ingested data

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

Run this additional check when you want to explain conditional entries in
`EligibleTableBreakdown`. `Update` and `UpdateSummary` depend on the
legacy Update Management condition, and `WindowsEvent` requires the
`Microsoft-SecurityEvent` stream. Because `Usage` does not preserve enough
detail to prove those conditions per row, treat this output as context rather
than confirmed free-benefit volume.

```kql
// Check conditional tables — context for EligibleGBPerDay
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

Check these relationships in the returned rows:

- `FreeGBPerDay` equals the lower of `EligibleGBPerDay` and `CapGBPerDay`.
- `UnusedCapGBPerDay` is the non-negative difference between `CapGBPerDay`
  and `FreeGBPerDay`.
- `OverCapGBPerDay` is the non-negative difference between `EligibleGBPerDay`
  and `CapGBPerDay`.
- The `Summary` row is calculated from unrounded workspace values. Do not add
  Summary rows to workspace rows when combining batches.

If these relationships do not hold, re-copy the current query and check that
the CSV header, Summary row, and workspace rows were not mixed together. Do not attempt to repair
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

> **Validated:** as of this writing, all 10 tables in `coreEligible`
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
