---
id: sentinel-commitment-tier-sizing
title: "Microsoft Sentinel commitment tier sizing and change review"
status: estimate
lastReviewed: "2026-08-27"
summary: >-
  Analyze complete daily Microsoft Sentinel analytics-tier ingestion across one
  or more selected workspaces and recommend whether to hold, increase, or
  decrease a commitment tier using configurable tier inputs.
tags:
  - microsoft-sentinel
  - cost-optimization
  - commitment-tiers
  - log-analytics
docs:
  - label: "Reduce costs for Microsoft Sentinel - set or change pricing tier"
    url: "https://learn.microsoft.com/en-us/azure/sentinel/billing-reduce-costs#set-or-change-pricing-tier"
  - label: "Manage and Monitor Costs for Microsoft Sentinel"
    url: "https://learn.microsoft.com/en-us/azure/sentinel/billing-monitor-costs"
  - label: "Plan costs and understand pricing and billing for Microsoft Sentinel"
    url: "https://learn.microsoft.com/en-us/azure/sentinel/billing"
  - label: "Log query scope and time range"
    url: "https://learn.microsoft.com/en-us/azure/azure-monitor/logs/scope"
---

> **Important: unofficial community guidance.** This independent Ninja Paws
> project is not affiliated with, sponsored by, endorsed by, or supported by
> Microsoft Corporation. This query is a best-effort planning estimate, not a
> Microsoft billing calculation, price quote, commitment, or entitlement
> decision. Verify the current tier ladder, regional prices, billing model,
> scope, and Cost Management data before changing a pricing tier. Use at your
> own risk. Microsoft trademarks and product names belong to Microsoft
> Corporation.

## Overview

Microsoft Sentinel commitment tiers are daily commitments. Microsoft recommends
monitoring ingestion volume and changing the commitment tier to align with the
observed pattern. You can increase the tier at any time, which restarts the
31-day commitment period. You must wait until that period finishes before
moving to a lower tier or back to pay-as-you-go. Commitment-tier billing is
calculated daily.

This query analyzes billable analytics-tier ingestion from `Usage` for the
complete calendar days in a 31-day review window. It works when run from
Microsoft Sentinel **Logs** with one or more Log Analytics workspaces selected
in **Scope**. It returns:

- one `Summary` row for the selected scope;
- one `Workspace` row for each workspace contributing usage; and
- one `Source` row for each solution/data-type combination.

The recommendation uses the configured percentile and tier ladder. It is a
planning signal, not proof of the best price, because prices vary by region,
pricing model, discounts, commitment tier, and whether classic or simplified
meters are used.

## What Microsoft documents

Microsoft's current guidance says to:

- monitor ingestion volume to keep the commitment tier aligned with changing
  volume patterns;
- increase a commitment tier at any time, restarting the 31-day commitment
  period;
- wait until the 31-day period ends before lowering the tier or returning to
  pay-as-you-go;
- use Cost Analysis with the `Sentinel`, `Log Analytics`, and `Azure Monitor`
  service filters to review costs; and
- use the Workspace Usage Report workbook for workspace and table-level
  ingestion detail.

The current article does not expose a universal KQL value for the active tier,
price, commitment-change date, or the exact tier ladder for every billing
configuration. Enter those values in the query inputs and verify them in
Microsoft Sentinel **Settings > Pricing** and Cost Management.

## Prerequisites

- Microsoft Sentinel is enabled on each Log Analytics workspace in scope.
- You can run read-only queries with Log Analytics Reader or an equivalent
  permission on each selected workspace.
- You know the current commitment tier for the pricing model being reviewed,
  or set `currentTierGBPerDay = 0` when reviewing pay-as-you-go.
- You know when the current commitment began, or set
  `daysSinceCommitmentChange` to `31` only when the 31-day period has ended.
- You confirm the tier ladder in the current Microsoft Sentinel pricing page.
- You select only workspaces you are authorized to review. Azure Monitor Logs
  supports up to 100 workspaces in a cross-workspace query.

## How to use it

1. Open a Microsoft Sentinel workspace and select **Logs**.
2. In **Scope**, select the starting Log Analytics workspace and any other
   Sentinel workspaces that share the pricing decision. Do not select only a
   subscription, resource group, or individual resource; `Usage` must resolve
   from workspace scope.
3. Set `currentTierGBPerDay` to the tier shown as **Current tier** under
   **Microsoft Sentinel > Settings > Pricing**. Use `0` for pay-as-you-go.
4. Set `daysSinceCommitmentChange` from the current commitment start date. Use
   `31` when the lower-tier waiting period has elapsed; use a smaller value if
   a decrease is not currently allowed.
5. Review the `commitmentTiers` list and replace it with the current valid tier
   ladder for the pricing model and region you are reviewing. The example list
   is a planning input, not an authoritative price catalog.
6. Paste the query and select **Run**.
7. Use the `Summary` row for the recommendation. Use `Workspace` and `Source`
   rows to identify what is driving the result.
8. Compare the recommendation with Cost Analysis, the Workspace Usage Report
   workbook, current prices, discounts, and any pre-purchase commitment units
   before changing the tier.

## Query

> **Before running:** set the three manual inputs in the query: the current
> tier, the number of days since the current commitment started, and the valid
> tier ladder. A commitment tier is a billing setting, not something this KQL
> can discover reliably from workspace telemetry.

```kql
// Microsoft Sentinel commitment-tier sizing for the selected workspace Scope.
// Review the manual inputs against Microsoft Sentinel Settings > Pricing.
let lookbackDays = 31;
let currentTierGBPerDay = 0.0;       // 0 means pay-as-you-go for this review
let daysSinceCommitmentChange = 31;  // 31+ permits a decrease; increase anytime
let recommendationPercentile = 95;   // 95 is a planning default; change deliberately
// Replace with the current valid tier ladder for your pricing model and region.
let commitmentTiers = dynamic([100, 200, 300, 400, 500, 1000, 2000, 5000, 10000]);
let reviewStart = startofday(ago(lookbackDays + 1d));
let reviewEnd = startofday(now());
let billableUsage = materialize(
    Usage
    | where TimeGenerated >= reviewStart and TimeGenerated < reviewEnd
    | where IsBillable == true
    | where StartTime >= reviewStart and EndTime < reviewEnd
    | project
        WorkspaceId = TenantId,
        Solution = iff(Solution == "SecurityInsights", "AzureSentinel", Solution),
        DataType,
        StartTime,
        EndTime,
        Quantity
);
let dailyUsage = materialize(
    billableUsage
    | summarize BillableGBPerDay = sum(Quantity) / 1000.0 by WorkspaceId, Day = startofday(StartTime)
);
let workspaceIds = materialize(
    union
        (dailyUsage | summarize by WorkspaceId),
        (billableUsage | summarize by WorkspaceId)
    | distinct WorkspaceId
);
let completeDays = materialize(
    range Day from startofday(ago(lookbackDays + 1d)) to startofday(now(-1d)) step 1d
    | project Day
);
let workspaceDaily = materialize(
    workspaceIds
    | extend JoinKey = 1
    | join kind=inner (completeDays | extend JoinKey = 1) on JoinKey
    | project WorkspaceId, Day
    | join kind=leftouter dailyUsage on WorkspaceId, Day
    | extend BillableGBPerDay = coalesce(BillableGBPerDay, 0.0)
);
let workspaceStats = materialize(
    workspaceDaily
    | summarize
        AverageGBPerDay = avg(BillableGBPerDay),
        P50GBPerDay = percentile(BillableGBPerDay, 50),
        P75GBPerDay = percentile(BillableGBPerDay, 75),
        P90GBPerDay = percentile(BillableGBPerDay, 90),
        P95GBPerDay = percentile(BillableGBPerDay, 95),
        PeakGBPerDay = max(BillableGBPerDay),
        DaysOverCurrentTier = countif(BillableGBPerDay > currentTierGBPerDay),
        ReviewDays = count()
      by WorkspaceId
);
let sourceStats = materialize(
    billableUsage
    | summarize
        TotalGB = sum(Quantity) / 1000.0,
        AverageGBPerDay = sum(Quantity) / 1000.0 / lookbackDays
      by WorkspaceId, Solution, DataType
    | extend SourceKey = strcat(Solution, ":", DataType)
);
let scopeDaily = materialize(
    workspaceDaily
    | summarize BillableGBPerDay = sum(BillableGBPerDay) by Day
);
let scopeStats = materialize(
    scopeDaily
    | summarize
        AverageGBPerDay = avg(BillableGBPerDay),
        P50GBPerDay = percentile(BillableGBPerDay, 50),
        P75GBPerDay = percentile(BillableGBPerDay, 75),
        P90GBPerDay = percentile(BillableGBPerDay, 90),
        P95GBPerDay = percentile(BillableGBPerDay, 95),
        PeakGBPerDay = max(BillableGBPerDay),
        DaysOverCurrentTier = countif(BillableGBPerDay > currentTierGBPerDay),
        ReviewDays = count()
);
    let planningVolumeGBPerDay = case(
      recommendationPercentile == 50, toreal(toscalar(scopeStats | project P50GBPerDay)),
      recommendationPercentile == 75, toreal(toscalar(scopeStats | project P75GBPerDay)),
      recommendationPercentile == 90, toreal(toscalar(scopeStats | project P90GBPerDay)),
      toreal(toscalar(scopeStats | project P95GBPerDay))
    );
let recommendedTier = toscalar(
    print TierGBPerDay = commitmentTiers
    | mv-expand TierGBPerDay to typeof(real)
      | where TierGBPerDay >= planningVolumeGBPerDay
    | summarize RecommendedTierGBPerDay = min(TierGBPerDay)
);
let scaleAction = case(
    currentTierGBPerDay <= 0 and recommendedTier > 0, "Consider commitment tier",
    recommendedTier > currentTierGBPerDay, "Consider stepping up",
    recommendedTier < currentTierGBPerDay and daysSinceCommitmentChange >= 31, "Consider stepping down",
    recommendedTier < currentTierGBPerDay, "Hold until 31-day period ends",
    "Hold current tier"
);
let summaryRow = scopeStats
| extend
    RowType = "Summary",
    WorkspaceId = tostring(toscalar(workspaceIds | summarize WorkspaceCount = dcount(WorkspaceId))),
    QualifyingInputTierGBPerDay = currentTierGBPerDay,
    RecommendedTierGBPerDay = recommendedTier,
    Recommendation = scaleAction,
    RecommendationPercentile = recommendationPercentile,
    TierChangeEligible = daysSinceCommitmentChange >= 31,
    CurrentTierHeadroomGBPerDay = max_of(currentTierGBPerDay - planningVolumeGBPerDay, 0.0),
    PlanningVolumeOverCurrentTierGBPerDay = max_of(planningVolumeGBPerDay - currentTierGBPerDay, 0.0),
    AverageMonthlyCommittedGB = currentTierGBPerDay * 30.4368,
    AverageMonthlyRecommendedGB = recommendedTier * 30.4368,
    AnalysisWindowDays = ReviewDays
| project RowType, WorkspaceId, QualifyingInputTierGBPerDay, RecommendedTierGBPerDay,
    Recommendation, RecommendationPercentile, TierChangeEligible, AverageGBPerDay,
    P50GBPerDay, P75GBPerDay, P90GBPerDay, P95GBPerDay, PeakGBPerDay,
    DaysOverCurrentTier, AnalysisWindowDays, CurrentTierHeadroomGBPerDay,
    PlanningVolumeOverCurrentTierGBPerDay, AverageMonthlyCommittedGB, AverageMonthlyRecommendedGB;
let workspaceRows = workspaceStats
| extend
    RowType = "Workspace",
    QualifyingInputTierGBPerDay = currentTierGBPerDay,
    CurrentTierOverageDaysPct = round(100.0 * DaysOverCurrentTier / ReviewDays, 1)
| project RowType, WorkspaceId, QualifyingInputTierGBPerDay,
    AverageGBPerDay, P50GBPerDay, P75GBPerDay, P90GBPerDay, P95GBPerDay,
    PeakGBPerDay, DaysOverCurrentTier, CurrentTierOverageDaysPct, ReviewDays;
let sourceRows = sourceStats
| extend RowType = "Source"
| project RowType, WorkspaceId, SourceKey, Solution, DataType, TotalGB, AverageGBPerDay;
union summaryRow, workspaceRows, sourceRows
| sort by RowType asc, AverageGBPerDay desc
```

## How the query works

1. `lookbackDays` and the `StartTime`/`EndTime` filters select complete calendar
   days, matching Microsoft's cost-monitoring query pattern. The query uses
   `/ 1000.0` because `Usage.Quantity` is measured in MB and Microsoft Sentinel
   billing examples express ingestion in decimal GB.
2. `billableUsage` filters to `IsBillable == true`, then normalizes the
   `SecurityInsights` solution label to `AzureSentinel` as in Microsoft's
   examples.
3. `workspaceDaily` creates a row for every selected workspace and every day in
   the review period. Missing usage becomes zero, so quiet days are not removed
   from the percentile or average.
4. `scopeStats` calculates average, percentile, peak, and over-current-tier
   values after adding the selected workspaces for each day. This is the
   commitment decision's aggregate volume.
5. `recommendedTier` chooses the smallest configured tier at or above the
   selected percentile. The default P95 protects against ordinary daily
   variation while avoiding sizing solely for a single extreme peak.
6. `workspaceRows` shows which workspace contributes to the aggregate. These
   rows are diagnostic and must not be used to apply the same commitment tier
   separately to every workspace.
7. `sourceRows` groups usage by normalized solution and table so you can identify
   noisy sources, exclude non-Sentinel operations data in a separate workspace,
   and evaluate data collection changes before changing the pricing tier.

## Example result

The values below are fictional:

| RowType | WorkspaceId | QualifyingInputTierGBPerDay | RecommendedTierGBPerDay | Recommendation | AverageGBPerDay | P95GBPerDay | PeakGBPerDay | DaysOverCurrentTier |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| Summary | `2` | 100 | 100 | Hold current tier | 76.4 | 88.2 | 109.7 | 0 |
| Workspace | `workspace-redacted-1` | 100 |  | 61.2 | 70.1 | 82.0 | 95.0 | 0 |
| Workspace | `workspace-redacted-2` | 100 |  | 15.2 | 18.1 | 24.0 | 31.0 | 0 |
| Source | `workspace-redacted-1` |  |  |  |  |  |  |  |

`Recommendation` is a planning signal. It does not calculate a dollar saving
because the query does not know the regional price, discount, pricing model,
pre-purchase credits, or whether a classic Log Analytics meter is billed
separately.

## Result fields

| Field | Meaning |
| --- | --- |
| `RowType` | `Summary`, `Workspace`, or `Source`. |
| `WorkspaceId` | Workspace GUID for detail rows; the Summary row contains the selected workspace count as text. |
| `QualifyingInputTierGBPerDay` | Manual current tier input. Zero means pay-as-you-go for this review. |
| `RecommendedTierGBPerDay` | Summary-only smallest configured tier at or above the selected percentile. |
| `Recommendation` | Hold, consider stepping up, consider stepping down, hold until the 31-day period ends, or consider a commitment tier. |
| `RecommendationPercentile` | Percentile used for the recommendation; default is 95. |
| `TierChangeEligible` | Whether `daysSinceCommitmentChange` is at least 31. |
| `AverageGBPerDay` | Complete-calendar-day average billable analytics ingestion. |
| `P50GBPerDay`, `P75GBPerDay`, `P90GBPerDay`, `P95GBPerDay` | Daily ingestion percentiles used to understand normal and high-volume days. |
| `PeakGBPerDay` | Highest complete-day billable ingestion in the review window. |
| `DaysOverCurrentTier` | Number of complete days above the manually entered current tier. |
| `CurrentTierHeadroomGBPerDay` | Summary-only headroom below the current tier at the selected planning percentile, floored at zero. |
| `PlanningVolumeOverCurrentTierGBPerDay` | Summary-only selected planning-percentile volume above the current tier, floored at zero. |
| `AverageMonthlyCommittedGB` | Current tier multiplied by the average 30.4368-day month; a volume reference, not a charge. |
| `AverageMonthlyRecommendedGB` | Recommended tier multiplied by the average 30.4368-day month; a volume reference, not a charge. |
| `CurrentTierOverageDaysPct` | Workspace percentage of complete days above the current tier. |
| `SourceKey`, `Solution`, `DataType` | Source detail dimensions. |
| `TotalGB` | Source total for the review period, expressed in decimal GB. |

## Recommended decision workflow

### Step up

Consider stepping up when the Summary row says `Consider stepping up`, the
P95 or P90 volume is consistently above the current tier, and Cost Analysis
shows that the commitment price is lower than the expected pay-as-you-go and
overage alternative. Increasing is allowed at any time, but it restarts the
31-day commitment period.

Before increasing, review `Source` rows and the Workspace Usage Report. A
recent onboarding event, noisy connector, duplicate collection rule, or
retention/configuration change can make a short spike unrepresentative.

### Hold

Hold when the recommendation is `Hold current tier` and the current tier
contains the selected percentile with acceptable headroom. Continue monitoring
for at least another review period when ingestion is changing quickly.

### Step down

Consider stepping down only when the Summary row recommends a lower configured
tier, the lower tier has enough headroom for the normal daily pattern, and the
31-day commitment period has ended. Microsoft says lowering the tier or moving
back to pay-as-you-go is restricted until that period finishes. Confirm the
change date in Microsoft Sentinel **Settings > Pricing**; this query cannot
infer it.

Do not choose a lower tier solely because the average is low if P90/P95 or
seasonal peaks regularly exceed it. Compare the cost of the lower commitment,
expected overage, and pay-as-you-go volume.

### Pay-as-you-go review

When `currentTierGBPerDay = 0`, the query reports `Consider commitment tier`
when the configured ladder contains a tier above the selected percentile. A
commitment tier may not be cheaper when volume is highly variable, discounts
apply, or a workload is temporary. Use Cost Analysis and the current pricing
page for the decision.

## Sources and billing validation

Use the Microsoft Sentinel cost-management sources alongside this query:

- **Microsoft Sentinel > Settings > Pricing**: confirm the current pricing
  model and tier.
- **Cost Management > Cost Analysis**: filter Service name to `Sentinel`,
  `Log Analytics`, and `Azure Monitor`; review daily and accumulated views.
- **Workspace Usage Report workbook**: validate workspace and table-level
  ingestion against the `Workspace` and `Source` rows.
- **Cost Management exports**: retain daily cost data for trend and forecast
  analysis. Cost data is the billing record; `Usage` is telemetry for sizing.

## Automation

Run this query daily or weekly with the same complete-day window. Store the
Summary, Workspace, and Source rows together. Alert when:

- `PlanningVolumeOverCurrentTierGBPerDay` becomes positive for several reviews;
- `CurrentTierHeadroomGBPerDay` approaches zero;
- the recommendation changes from hold to step up or step down; or
- a Source row changes sharply after a connector or collection-rule change.

For more than 100 workspaces, run batches with a stable workspace inventory.
Add the daily workspace volumes across batches before calculating percentiles
for the combined estate; do not average batch percentiles and do not add
batch recommendations. A script, workbook, or approved data store should
combine the workspace rows into one daily series first.

## Known limits

- **Manual billing inputs:** the current tier, commitment age, tier ladder,
  prices, discounts, and commercial terms are not present in the query. Validate
  them in Microsoft Sentinel, the pricing page, and Cost Management.
- **Analytics tier only:** this query measures billable `Usage` rows for the
  selected analytics-tier tables. Data lake ingestion, data processing,
  storage, data lake queries, graph operations, retention, automation, and
  other Azure services use separate meters.
- **Classic versus simplified billing:** classic Sentinel and Log Analytics
  charges can appear as separate meters; simplified pricing combines them.
  Interpret `Usage` alongside the active pricing model.
- **Decimal GB:** the query follows Microsoft's cost-monitoring examples and
  uses 1,000 MB per decimal GB. This differs from reports that use 1,024 MB per
  binary GB; compare like units.
- **`Usage` latency:** records can lag by hours. Complete-day filtering reduces
  partial-day noise but does not remove reporting delay.
- **Scope and RBAC:** the query includes only explicitly selected and readable
  workspaces. It does not discover every Sentinel-enabled workspace.
- **Shared commitment boundary:** workspace rows are diagnostic. The query
  assumes the selected workspaces share the pricing decision; do not apply the
  same tier independently to every workspace unless Microsoft billing is
  configured that way.
- **Tier ladder:** the example `commitmentTiers` list must be checked against
  the current Microsoft pricing experience. Do not treat it as a price list.
- **Percentile choice:** P95 is a planning default. A regulated or seasonal
  workload may require a different percentile, a longer history, or explicit
  peak/seasonal modeling.
- **No causal attribution:** `Source` rows show solution/table volume, not
  connector ownership or the reason a source changed.

## Frequently asked questions

**Q: Can this query tell me the current commitment tier?**

No. Enter it manually from Microsoft Sentinel **Settings > Pricing**. The
`Usage` table describes observed ingestion, not the workspace's commercial
commitment setting.

**Q: Can I lower the tier as soon as the average drops?**

No. Microsoft says you must wait until the 31-day commitment period finishes
before lowering the tier or returning to pay-as-you-go. Confirm the start date
in the portal.

**Q: Why does a workspace row have no recommendation?**

The commitment decision is calculated from the aggregate daily series. A
workspace row is diagnostic; applying a separate recommendation to every
workspace could multiply the commitment assumption.

**Q: Why is the recommendation different from the invoice?**

The query estimates volume, not price. Commitment charges, overage, discounts,
classic versus simplified meters, pre-purchase credits, free data sources,
benefits, and Cost Management timing can change the billed result.

**Q: What should I do before stepping up?**

Inspect the Source rows and Workspace Usage Report, check for recent ingestion
changes, confirm the tier and price, then compare commitment and pay-as-you-go
costs in Cost Analysis. Do not change a tier based on this estimate alone.

## Sources

- [Reduce costs for Microsoft Sentinel](https://learn.microsoft.com/en-us/azure/sentinel/billing-reduce-costs#set-or-change-pricing-tier) — commitment-tier change timing and pricing-tier workflow.
- [Manage and Monitor Costs for Microsoft Sentinel](https://learn.microsoft.com/en-us/azure/sentinel/billing-monitor-costs) — Cost Analysis filters, ingestion KQL patterns, Workspace Usage Report, budgets, and exports.
- [Plan costs and understand pricing and billing for Microsoft Sentinel](https://learn.microsoft.com/en-us/azure/sentinel/billing) — billing models, commitment tiers, free meters, and separate service charges.
- [Log query scope and time range](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/scope) — workspace scope and cross-workspace limits.
