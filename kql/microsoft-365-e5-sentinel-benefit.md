---
id: microsoft-365-e5-sentinel-benefit
title: "Microsoft Sentinel benefit for Microsoft 365 E7/E5/A5/F5/G5 customers"
status: estimate
lastReviewed: "2026-08-27"
summary: >-
  Size the up-to-5-MB/user/day free Microsoft Sentinel ingestion benefit for
  a fixed set of Microsoft 365 / Entra ID / Defender data types.
tags:
  - microsoft-sentinel
  - microsoft-365
  - cost-optimization
docs:
  - label: "Microsoft Sentinel benefit for Microsoft 365 E7, E5, A5, F5, and G5 customers"
    url: "https://azure.microsoft.com/en-us/pricing/offers/sentinel-microsoft-365-offer/"
---

> **Important: unofficial community guidance.** This independent Ninja Paws
> project is not affiliated with, sponsored by, endorsed by, or supported by
> Microsoft Corporation. This query is a best-effort estimate based on public
> documentation, not billing or licensing advice. Verify qualifying licenses,
> current offer terms, and billing data before relying on the result. Use at
> your own risk. Microsoft trademarks and product names belong to Microsoft
> Corporation.

## Overview

This query estimates the Microsoft Sentinel data grant available to qualifying
Microsoft 365 E7/E5/A5/F5/G5 customers and corresponding Security customers.
The grant is capped at 5 MB per qualifying user per day and applies only to the
offer's eligible Microsoft 365 data types.

Run it from a Microsoft Sentinel workspace's **Logs** experience. Select one
or more Sentinel-enabled Log Analytics workspaces in **Scope**. The query
returns one `Summary` row and one `Workspace` row per selected workspace. The
grant cap is calculated once in the Summary row so selecting multiple
workspaces does not multiply the user allowance.

## Offer coverage

Microsoft describes the grant as covering these Microsoft 365 data-source
groups:

| Offer data-source group | Tables represented in this sizing query |
| --- | --- |
| Microsoft Entra ID sign-in and audit logs | `SigninLogs`, `AuditLogs`, `AADNonInteractiveUserSignInLogs`, `AADServicePrincipalSignInLogs`, `AADManagedIdentitySignInLogs`, `AADProvisioningLogs`, `ADFSSignInLogs`, `AADUserRiskEvents`, `AADRiskyUsers` |
| Microsoft Defender for Cloud Apps Guard shadow IT discovery logs | `McasShadowItReporting` |
| Microsoft Purview Information Protection logs | `InformationProtectionLogs_CL` |
| Microsoft 365 advanced hunting data | `Device*` and `Email*` tables listed in the query |

The table list is an operational allowlist for sizing. It does not prove that
a table's rows were produced by an eligible connector or that the customer's
offer entitlement is active. `Usage` normally exposes the table name, not the
originating connector.

## Prerequisites

- Read access to every Log Analytics workspace in the selected scope.
- A current count of users assigned a qualifying Microsoft 365 E7, E5, A5, F5,
  or G5 license, or the corresponding Security plan.
- `Usage` data for the complete seven-day analysis window.
- Confirmation that the offer and listed data types apply to the customer.

## How to use it

1. Confirm the customer and agreement meet the offer terms, then run the
  Microsoft Graph helper under [License-count query](#license-count-query).
2. Set `e5Users` to the resulting qualifying-user count. Do not leave it at `0`.
3. Open a Microsoft Sentinel workspace and select **Logs**. Use **Scope** to
  select the Sentinel workspaces to include, then switch to KQL mode.
4. Paste the KQL query and select **Run**.

## Query

> **Before running:**
>
> 1. Set `e5Users` to your qualifying license count (see the
>    [license-count query](#license-count-query) below).
> 2. Open [Azure Monitor → Logs](https://portal.azure.com/#view/Microsoft_Azure_Monitoring/AzureMonitoringBrowseBlade/~/logs).
> 3. In **Scope**, select the Sentinel-enabled Log Analytics workspaces to
>    include. A subscription or resource-group scope does not provide the
>    workspace `Usage` data required by this query.
> 4. Check the mode dropdown at the top-right of the query editor — if it
>    says **Simple mode**, switch it to **KQL mode** before pasting this
>    query.

```kql
// Microsoft 365 E7/E5/A5/F5/G5 benefit — up to 5 MB/user/day of free Sentinel ingestion.
// The grant cap is calculated once for the selected Sentinel workspace scope.
let lookback = 7d;
let lookbackDays = lookback / 1d;
let e5Users = 0;  // <-- qualifying E7/E5/A5/F5/G5 user count
let eligible = dynamic([
  "SigninLogs","AuditLogs","AADNonInteractiveUserSignInLogs","AADServicePrincipalSignInLogs",
  "AADManagedIdentitySignInLogs","AADProvisioningLogs","ADFSSignInLogs","AADUserRiskEvents",
  "AADRiskyUsers","McasShadowItReporting","InformationProtectionLogs_CL",
  "DeviceEvents","DeviceFileEvents","DeviceImageLoadEvents","DeviceInfo","DeviceLogonEvents",
  "DeviceNetworkEvents","DeviceNetworkInfo","DeviceProcessEvents","DeviceRegistryEvents",
  "DeviceFileCertificateInfo","EmailEvents","EmailUrlInfo","EmailAttachmentInfo","EmailPostDeliveryEvents"]);
let eligibleUsage = materialize(
  Usage
  | where TimeGenerated > ago(lookback) and IsBillable == true
  | where DataType in (eligible)
  | project WorkspaceId = TenantId, DataType, Quantity
);
let allEligibleTables = materialize(
  print DataType = eligible
  | mv-expand DataType to typeof(string)
  | project DataType
);
let workspaceIds = materialize(
  union
    (eligibleUsage | summarize by WorkspaceId),
    (Heartbeat | where TimeGenerated > ago(lookback) | summarize by WorkspaceId = TenantId)
  | distinct WorkspaceId
);
let perTable = materialize(
  workspaceIds
  | extend JoinKey = 1
  | join kind=inner (allEligibleTables | extend JoinKey = 1) on JoinKey
  | project WorkspaceId, DataType
  | join kind=leftouter (
      eligibleUsage
      | summarize GBPerDayRaw = sum(Quantity) / 1024.0 / lookbackDays by WorkspaceId, DataType
    ) on WorkspaceId, DataType
  | extend GBPerDay = round(coalesce(GBPerDayRaw, 0.0), 3)
  | summarize EligibleTableBreakdown = make_bag(pack(DataType, pack("GBPerDay", GBPerDay))) by WorkspaceId
);
let workspaceRows = workspaceIds
| join kind=leftouter (
    eligibleUsage
    | summarize EligibleGBPerDay = sum(Quantity) / 1024.0 / lookbackDays by WorkspaceId
  ) on WorkspaceId
| join kind=leftouter perTable on WorkspaceId
| extend EligibleGBPerDay = round(coalesce(EligibleGBPerDay, 0.0), 3)
| extend EligibleTableBreakdown = coalesce(EligibleTableBreakdown, dynamic({}))
| project RowType = "Workspace", WorkspaceId, QualifyingUsers = e5Users, EligibleGBPerDay, EligibleTableBreakdown;
let summaryRow = workspaceRows
| summarize WorkspaceCount = dcount(WorkspaceId), EligibleGBPerDay = sum(EligibleGBPerDay)
| extend RowType = "Summary", WorkspaceId = tostring(WorkspaceCount), QualifyingUsers = e5Users
| extend CapGBPerDay = round(e5Users * 5.0 / 1024.0, 3)
| extend FreeGBPerDay = round(min_of(EligibleGBPerDay, CapGBPerDay), 3)
| extend UnusedCapGBPerDay = round(max_of(CapGBPerDay - FreeGBPerDay, 0.0), 3)
| extend OverCapGBPerDay = round(max_of(EligibleGBPerDay - CapGBPerDay, 0.0), 3)
| extend EligibleTableBreakdown = dynamic({})
| project RowType, WorkspaceId, QualifyingUsers, CapGBPerDay, EligibleGBPerDay, EligibleTableBreakdown, FreeGBPerDay, UnusedCapGBPerDay, OverCapGBPerDay;
union summaryRow, workspaceRows
| sort by RowType asc, FreeGBPerDay desc
```

## How the query works

The query totals billable ingestion from the documented eligible tables for
each workspace over the full seven-day lookback. It preserves a breakdown for
every supported table, including zero-volume tables. The `Summary` row totals
the workspace values, calculates the single license-based daily cap, and
returns the smaller of eligible ingestion and that cap. With `e5Users = 0`,
the Summary row reports no free capacity rather than assuming all eligible
ingestion is covered.

## Example result

The query returns one `Summary` row followed by one `Workspace` row per
selected workspace. Values below are fictional and rounded for display.

| RowType | WorkspaceId | QualifyingUsers | CapGBPerDay | EligibleGBPerDay | FreeGBPerDay | UnusedCapGBPerDay | OverCapGBPerDay |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Summary | `3500` | 3500 | 17.090 | 12.400 | 12.400 | 4.690 | 0.000 |
| Workspace | `workspace-id-redacted-1` | 3500 |  | 9.800 |  |  |  |
| Workspace | `workspace-id-redacted-2` | 3500 |  | 2.600 |  |  |  |

The grant cap is calculated once for the selected scope. Do not sum the
`QualifyingUsers` or `CapGBPerDay` values from workspace rows, and do not add
Summary rows from separate batches when the same users are represented in
each batch.

## Result fields

| Field | Meaning |
| --- | --- |
| `RowType` | `Summary` identifies the aggregate row; `Workspace` identifies a workspace detail row. |
| `WorkspaceId` | Workspace identifier on detail rows; the Summary row contains the workspace count as text. |
| `QualifyingUsers` | The manually supplied qualifying-user count used for the grant cap. It is not calculated from workspace telemetry. |
| `CapGBPerDay` | Summary-only maximum modeled benefit: qualifying users × 5 MB/day, converted to GB. |
| `EligibleGBPerDay` | Average daily billable ingestion from the listed E5-benefit data types. Workspace rows show each contribution; the Summary row totals them. `OfficeActivity` is excluded because it is covered by the separate always-free Sentinel data-source policy. |
| `EligibleTableBreakdown` | JSON object containing each supported table and its average GB/day for a workspace. The Summary row leaves this empty. |
| `FreeGBPerDay` | Summary-only smaller value of total eligible ingestion and the license-based cap. |
| `UnusedCapGBPerDay` | Summary-only capacity remaining after eligible ingestion, floored at zero. |
| `OverCapGBPerDay` | Summary-only eligible ingestion above the license-based cap, floored at zero. |

Use the `Summary` row for the cost model. Workspace rows are diagnostic detail,
and their cap/free columns are intentionally empty because the grant is one
license-based allowance across the selected scope.

## Known limits

- **`Usage` isn't real-time:** usage data can lag by hours. The seven-day
  average smooths this delay but does not eliminate it.
- **`e5Users` is manual:** stale or incorrect assignments directly change the
  cap. Re-run the license helper when assignments materially change.
- **SKU part numbers vary:** the helper's SKU list is a reviewed starting point,
  not proof of offer eligibility. Compare it with `Get-MgSubscribedSku` and
  current offer terms.
- **Scope and RBAC:** missing workspaces understate eligible ingestion.
- **Grant scope:** the query assumes the selected workspaces belong to the
  same customer grant. It does not discover Sentinel-enabled workspaces or
  allocate qualifying users across workspaces. Include all relevant workspaces
  in Scope before using the Summary row.
- **Workspace limit:** Azure Monitor Logs supports up to 100 workspaces in a
  cross-workspace query. Run batches for larger estates and use an approved
  aggregation process; do not add batch Summary rows if the same user grant is
  represented in every batch.
- **Source attribution:** `Usage` identifies tables, not necessarily the
  connector or product that generated each row. Validate offer eligibility
  against connector configuration and Microsoft billing data.
- **Estimate, not allocation evidence:** use Cost Management exports and the
  documented benefit meter to verify the benefit actually received.

## License-count query

Licenses live in Microsoft Entra ID, not Log Analytics, so counting qualifying
users requires Microsoft Graph rather than KQL:

```powershell
# Count users with a candidate Microsoft 365 E7/E5/A5/F5/G5 license assigned.
# Microsoft Graph PowerShell — needs delegated User.Read.All + Organization.Read.All.
Connect-MgGraph -Scopes "User.Read.All","Organization.Read.All"
# Candidate SKU part numbers — adjust to match your tenant's plans. This list
# counts licenses, but cannot prove the customer's EA, EAS, or CSP eligibility.
$eligible = @("Microsoft_365_E7","Microsoft_365_E5","SPE_E5","ENTERPRISEPREMIUM",
  "M365_E5_SECURITY","SPE_F5_SECCOMP","M365_F5_SECURITY","M365EDU_A5_FACULTY",
  "M365EDU_A5_STUUSEBNFT","Microsoft_365_G5")
$skuIds = (Get-MgSubscribedSku | Where-Object { $_.SkuPartNumber -in $eligible }).SkuId
(Get-MgUser -All -Property assignedLicenses |
  Where-Object { $_.AssignedLicenses.SkuId | Where-Object { $_ -in $skuIds } } |
  Measure-Object).Count
```

> [!TIP]
> Adjust the `$eligible` SKU part numbers to match the exact plans in your
> tenant — run `Get-MgSubscribedSku | Select SkuPartNumber` to see what's
> actually provisioned before filtering.

## Sources

- [Microsoft Sentinel benefit for Microsoft 365 E7, E5, A5, F5, and G5 customers](https://azure.microsoft.com/en-us/pricing/offers/sentinel-microsoft-365-offer/) — offer terms and eligible data-source groups.
- [View data allocation benefits](https://learn.microsoft.com/en-us/azure/azure-monitor/fundamentals/cost-usage#view-data-allocation-benefits) — billing-export verification guidance.
