---
id: always-free-sentinel-data-sources
title: "Always-free Microsoft Sentinel data sources"
status: estimate
lastReviewed: "2026-08-27"
summary: >-
  Measure ingestion volume from Microsoft Sentinel data sources documented as
  free, while keeping free-volume estimates separate from billed cost.
tags:
  - microsoft-sentinel
  - cost-optimization
docs:
  - label: "Microsoft Sentinel billing - free data sources"
    url: "https://learn.microsoft.com/en-us/azure/sentinel/billing#free-data-sources"
---

> **Important: unofficial community guidance.** This independent Ninja Paws
> project is not affiliated with, sponsored by, endorsed by, or supported by
> Microsoft Corporation. This query is a best-effort estimate based on public
> documentation, not billing or licensing advice. Verify current Microsoft
> documentation and your own billing data before relying on the result. Use at
> your own risk. Microsoft trademarks and product names belong to Microsoft
> Corporation.

## Overview

This query measures average daily ingestion from the Microsoft Sentinel data
types that current Microsoft documentation identifies as free. Run it from a
Microsoft Sentinel workspace's **Logs** experience and select one or more
Log Analytics workspaces in **Scope**. The query returns one `Summary` row and
one `Workspace` row per selected workspace, so it works for a single Sentinel
workspace or a set of Sentinel workspaces, subject to the portal's scope limit.

The result is an ingestion estimate, not an invoice calculation. A source can
be free by policy while related raw data, analysis, retention, connectors, or
other Azure services remain billable.

## Free sources in Microsoft Sentinel

The following sources and data types are listed as free in Microsoft's billing
documentation:

| Sentinel source or connector | Free data type | Scope of the free treatment |
| --- | --- | --- |
| Azure Activity | `AzureActivity` | Azure Activity Logs |
| Health monitoring for Microsoft Sentinel | `SentinelHealth` | Sentinel health data |
| Microsoft Entra ID Protection | `SecurityAlert` | IPC alerts |
| Microsoft 365 | `OfficeActivity` | SharePoint, Exchange, and Teams audit activity |
| Microsoft Defender for Cloud | `SecurityAlert` | Azure Security Center alerts |
| Microsoft Defender for IoT | `SecurityAlert` | Azure Security Center for IoT alerts |
| Microsoft Defender XDR | `SecurityIncident`, `SecurityAlert` | Incidents and alerts |
| Microsoft Defender for Endpoint | `SecurityAlert` | MDATP alerts |
| Microsoft Defender for Identity | `SecurityAlert` | AATP alerts |
| Microsoft Defender for Cloud Apps | `SecurityAlert` | MCAS alerts |
| Microsoft Defender for Office 365 (Preview) | `SecurityAlert` | OATP alerts |

`Usage` generally exposes the table name, not the originating connector or
alert source. Therefore the query can measure free volume by table, but it
cannot reliably attribute a `SecurityAlert` row to a specific Defender or
Entra source. Validate connector-level attribution in the connector settings
or Microsoft Sentinel data and Cost Management views.

## Prerequisites

- Microsoft Sentinel enabled on each Log Analytics workspace you select.
- Log Analytics Reader access, or an equivalent query-read role, on each
  selected workspace.
- `Usage` data for the complete seven-day analysis window.
- A scope limited to workspaces you are authorized to review. The Logs scope
  selector can include up to 100 workspaces; run separate batches for larger
  estates.

## How to use it

1. Open **Microsoft Sentinel** for a workspace and select **Logs**.
2. In **Scope**, select the starting workspace and any other Sentinel
  workspaces to include. Do not select a subscription or resource group as
  the query scope.
3. Switch to KQL mode, paste the query, and select **Run**.
4. Review the `Summary` row and the per-workspace rows. Use workspace rows for
  combining batches and do not add `Summary` rows together.

## Query

```kql
// Microsoft Sentinel free data sources for the selected workspace scope.
let lookback = 7d;
let lookbackDays = lookback / 1d;
let freeTypes = dynamic(["AzureActivity", "SentinelHealth", "OfficeActivity", "SecurityAlert", "SecurityIncident"]);
let allFreeTypes = materialize(
  print DataType = freeTypes
  | mv-expand DataType to typeof(string)
  | project DataType
);
let freeUsage = materialize(
  Usage
  | where TimeGenerated > ago(lookback)
  | where DataType in (freeTypes)
  | project WorkspaceId = TenantId, DataType, Quantity
);
let perWorkspace = materialize(
  freeUsage
  | summarize FreeGBPerDay = sum(Quantity) / 1024.0 / lookbackDays by WorkspaceId
);
let workspaceIds = materialize(
  union
    (freeUsage | summarize by WorkspaceId),
    (Heartbeat | where TimeGenerated > ago(lookback) | summarize by WorkspaceId = TenantId)
  | distinct WorkspaceId
);
let perTable = materialize(
  workspaceIds
  | extend JoinKey = 1
  | join kind=inner (allFreeTypes | extend JoinKey = 1) on JoinKey
  | project WorkspaceId, DataType
  | join kind=leftouter (
      freeUsage
      | summarize GBPerDayRaw = sum(Quantity) / 1024.0 / lookbackDays by WorkspaceId, DataType
    ) on WorkspaceId, DataType
  | extend GBPerDay = round(coalesce(GBPerDayRaw, 0.0), 3)
  | summarize FreeSourceBreakdown = make_bag(pack(DataType, pack("GBPerDay", GBPerDay))) by WorkspaceId
);
let workspaceRows = workspaceIds
| join kind=leftouter perWorkspace on WorkspaceId
| join kind=leftouter perTable on WorkspaceId
| extend FreeGBPerDay = round(coalesce(FreeGBPerDay, 0.0), 3)
| extend FreeSourceBreakdown = coalesce(FreeSourceBreakdown, dynamic({}))
| project RowType = "Workspace", WorkspaceId, FreeSourceCount = array_length(freeTypes), FreeGBPerDay, FreeSourceBreakdown;
let summaryRow = workspaceRows
| summarize WorkspaceCount = dcount(WorkspaceId), FreeGBPerDay = sum(FreeGBPerDay)
| extend RowType = "Summary", WorkspaceId = tostring(WorkspaceCount), FreeSourceCount = array_length(freeTypes), FreeSourceBreakdown = dynamic({})
| project RowType, WorkspaceId, FreeSourceCount, FreeGBPerDay, FreeSourceBreakdown;
union summaryRow, workspaceRows
| sort by RowType asc, FreeGBPerDay desc
```

## How the query works

The query creates the documented free table list, aggregates billable and
nonbillable `Usage` rows by workspace and table, fills missing supported tables
with `0.000`, and converts the seven-day quantity to an average GB/day. It then
returns the aggregate `Summary` row followed by workspace detail rows. The
query deliberately does not filter on `IsBillable`: Microsoft policy, rather
than a single Usage flag, is the source of the free classification.

## Example result

The query returns one aggregate row and one row for each workspace. Values are
fictional and rounded for display.

| RowType | WorkspaceId | FreeSourceCount | FreeGBPerDay |
| --- | --- | ---: | ---: |
| Summary | `2` | 5 | 1.250 |
| Workspace | `workspace-id-redacted-1` | 5 | 1.100 |
| Workspace | `workspace-id-redacted-2` | 5 | 0.150 |

The `Summary` row is calculated from the workspace rows before display
rounding. When more than 100 workspaces must be reviewed, run separate
batches, retain the workspace rows, remove duplicate workspaces, and add only
those rows. Do not add the Summary rows from each batch together.

## Result fields

| Field | Meaning |
| --- | --- |
| `RowType` | `Summary` identifies the aggregate row; `Workspace` identifies a workspace detail row. |
| `WorkspaceId` | Workspace identifier on detail rows; the Summary row contains the workspace count as text. |
| `FreeSourceCount` | Number of documented free table types in the query's supported list. It is not the number of connectors enabled. |
| `FreeGBPerDay` | Average daily volume, in GB, from the listed free data types. |
| `FreeSourceBreakdown` | JSON object with one property per supported free table type and its average GB/day. |

Do not subtract this value from an invoice line without confirming how the
tenant's pricing tier and meters represent free ingestion.

## Recommended use

Use `FreeGBPerDay` from the `Summary` row as the free-source volume input to a
cost model, and keep it separate from paid ingestion and the Defender for
Servers Plan 2 benefit. Use `FreeSourceBreakdown` from workspace rows to see
which supported tables contributed volume. Treat a zero value as “no matching
Usage was observed,” not as proof that a connector is disabled or that the
source is unavailable.

For cost reconciliation, compare the result with Azure Cost Management and the
free-data meters documented by Microsoft. The query is useful for sizing and
trend analysis, but the billing artifacts remain authoritative.

## Known limits

- **`Usage` isn't real-time:** usage data can lag by hours. The seven-day
  window smooths this delay but does not eliminate it.
- **The list can change:** Microsoft can add or retire free data types. The
  `lastReviewed` date records when this list was last checked.
- **Source attribution:** `Usage` is aggregated by table and does not reliably
  identify which connector produced each `SecurityAlert`. Treat the table
  value as the measurable boundary and do not allocate it across connectors
  without independent evidence.
- **Free trial is separate:** Microsoft's 31-day Sentinel free trial provides
  up to 10 GB/day and is limited to 20 workspaces per tenant. This query
  measures listed free data sources and does not determine trial eligibility
  or remaining trial capacity.
- **Other Sentinel meters:** data lake ingestion, data processing, storage,
  queries, graph operations, retention beyond included periods, and connector
  or Azure service costs may still apply.
- **Scope limit:** the Logs scope selector supports up to 100 workspaces. Run
  batches and add only the workspace rows when reviewing larger estates.
- **No `IsBillable == true` filter:** this is intentional because these data
  types are generally nonbillable. Investigate unexpected billable rows rather
  than assuming this estimate supersedes billing data.
- **Scope and RBAC:** unreadable or unselected workspaces are absent and can
  make the result incomplete.

## Sources

- [Microsoft Sentinel billing - free data sources](https://learn.microsoft.com/en-us/azure/sentinel/billing#free-data-sources)
