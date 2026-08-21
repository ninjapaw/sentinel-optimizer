---
id: always-free-sentinel-data-sources
title: "Always-free Microsoft Sentinel data sources"
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

## Query

```kql
// Always-free Microsoft Sentinel data sources (not charged for ingestion).
// Azure Activity, Sentinel Health, Office 365 audit, and security alerts/incidents.
let lookback = 7d;
let freeTypes = dynamic([
  "AzureActivity","SentinelHealth","OfficeActivity","SecurityAlert","SecurityIncident"]);
Usage
| where TimeGenerated > ago(lookback)
| where DataType in (freeTypes)
| summarize GB = sum(Quantity) / 1024.0 by bin(TimeGenerated, 1d)
| summarize FreeGBPerDay = round(avg(GB), 3)
```

> **Tip:** paste `FreeGBPerDay` wherever you're reconciling billable vs.
> total ingestion — this volume never appears on the invoice regardless of
> plan.

> **Known limits:**
> - **`Usage` isn't real-time**: usage data can lag by hours, so a short `lookback` can understate `FreeGBPerDay`. The default 7-day average smooths this out.
> - **List isn't exhaustive**: Microsoft can add or retire always-free source types over time (see the source link below); treat `freeTypes` as a starting point and cross-check it against the current docs periodically, not a permanent list.
> - **Doesn't include `IsBillable == true` filter**: intentionally, since these types are typically flagged non-billable already — if your workspace shows billable rows for these types, double-check your table plan/tier configuration rather than assuming the query is wrong.

## Discussion

Microsoft Sentinel and Log Analytics never bill for a small set of data
types, independent of any Defender for Servers or Microsoft 365 E5 benefit:
`AzureActivity` (Azure control-plane logs), `SentinelHealth` (Sentinel's own
operational health data), `OfficeActivity` (Office 365 audit logs), and the
alert/incident tables `SecurityAlert` and `SecurityIncident`. Raw Defender or
Entra ID logs that feed those alerts are still paid ingestion — only the
resulting alert/incident records and the sources above are free. This query
exists to separate "free by policy" volume from "free by benefit" volume
(Defender for Servers P2, Microsoft 365 E5) so cost estimates don't
double-count or misattribute savings.

### Sources

- [Microsoft Sentinel billing - free data sources](https://learn.microsoft.com/en-us/azure/sentinel/billing#free-data-sources)
