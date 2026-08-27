---
id: always-free-sentinel-data-sources
title: "Always-free Microsoft Sentinel data sources"
status: estimate
lastReviewed: "2026-08-22"
summary: >-
  Measure ingestion volume from data sources Microsoft never bills for, so
  it can be excluded from billable-cost estimates.
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
types that current Microsoft documentation identifies as free. Use the result
to separate "free by policy" volume from paid ingestion and product-specific
benefits.

## Prerequisites

- Read access to every Log Analytics workspace in the selected scope.
- `Usage` data for the complete seven-day analysis window.
- A scope limited to subscriptions and workspaces you are authorized to review.

## How to use it

1. Open Azure Monitor Logs and select the intended workspace scope.
2. Switch the editor to KQL mode, paste the query, and select **Run**.
3. Use `FreeGBPerDay` as contextual nonbillable volume, not as a cash saving.

## Query

```kql
// Always-free Microsoft Sentinel data sources (not charged for ingestion).
// Azure Activity, Sentinel Health, Office 365 audit, and security alerts/incidents.
let lookback = 7d;
let lookbackDays = lookback / 1d;
let freeTypes = dynamic([
  "AzureActivity","SentinelHealth","OfficeActivity","SecurityAlert","SecurityIncident"]);
Usage
| where TimeGenerated > ago(lookback)
| where DataType in (freeTypes)
| summarize FreeGBPerDay = round(sum(Quantity) / 1024.0 / lookbackDays, 3)
```

## How the query works

The query filters `Usage` to the documented free data types, sums megabytes
across the selected seven-day window, converts to gigabytes, and divides by all
seven calendar days. Days with no matching rows therefore remain part of the
average instead of being silently omitted.

## Result fields

| Field | Meaning |
| --- | --- |
| `FreeGBPerDay` | Average daily volume, in GB, from the listed free data types across the selected scope. |

Do not subtract this value from an invoice line without confirming how the
tenant's pricing tier and meters represent free ingestion.

## Known limits

- **`Usage` isn't real-time:** usage data can lag by hours. The seven-day
  window smooths this delay but does not eliminate it.
- **The list can change:** Microsoft can add or retire free data types. The
  `lastReviewed` date records when this list was last checked.
- **No `IsBillable == true` filter:** this is intentional because these data
  types are generally nonbillable. Investigate unexpected billable rows rather
  than assuming this estimate supersedes billing data.
- **Scope and RBAC:** unreadable or unselected workspaces are absent and can
  make the result incomplete.

## Sources

- [Microsoft Sentinel billing - free data sources](https://learn.microsoft.com/en-us/azure/sentinel/billing#free-data-sources)
