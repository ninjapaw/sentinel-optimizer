---
id: microsoft-365-e5-sentinel-benefit
title: "Microsoft Sentinel benefit for Microsoft 365 E5/A5/F5/G5 customers"
status: estimate
lastReviewed: "2026-08-22"
summary: >-
  Size the up-to-5-MB/user/day free Microsoft Sentinel ingestion benefit for
  a fixed set of Microsoft 365 / Entra ID / Defender data types.
tags:
  - microsoft-sentinel
  - microsoft-365
  - cost-optimization
docs:
  - label: "Microsoft Sentinel benefit for Microsoft 365 E5 customers"
    url: "https://azure.microsoft.com/en-us/offers/sentinel-microsoft-365-offer/"
---

> **Important: unofficial community guidance.** This independent Ninja Paws
> project is not affiliated with, sponsored by, endorsed by, or supported by
> Microsoft Corporation. This query is a best-effort estimate based on public
> documentation, not billing or licensing advice. Verify qualifying licenses,
> current offer terms, and billing data before relying on the result. Use at
> your own risk. Microsoft trademarks and product names belong to Microsoft
> Corporation.

## Overview

This query estimates the Microsoft Sentinel data benefit available to
qualifying Microsoft 365 E5/A5/F5/G5 customers. The benefit is capped at 5 MB
per qualifying user per day and applies only to the offer's eligible data
types.

## Prerequisites

- Read access to every Log Analytics workspace in the selected scope.
- A current count of users assigned a qualifying license.
- `Usage` data for the complete seven-day analysis window.
- Confirmation that the offer and listed data types apply to the customer.

## How to use it

1. Run the Microsoft Graph helper under [License-count query](#license-count-query).
2. Set `e5Users` to the resulting qualifying-user count. Do not leave it at `0`.
3. Open Azure Monitor Logs, select the intended scope, and switch to KQL mode.
4. Paste the KQL query and select **Run**.

## Query

> **Before running:**
>
> 1. Set `e5Users` to your qualifying license count (see the
>    [license-count query](#license-count-query) below).
> 2. Open [Azure Monitor → Logs](https://portal.azure.com/#view/Microsoft_Azure_Monitoring/AzureMonitoringBrowseBlade/~/logs).
> 3. Check the mode dropdown at the top-right of the query editor — if it
>    says **Simple mode**, switch it to **KQL mode** before pasting this
>    query.

```kql
// Microsoft 365 E5/A5/F5/G5 benefit — up to 5 MB/user/day of free Sentinel ingestion.
// Eligible Microsoft data types per the offer; grant = min(eligible ingest, users x 5 MB).
let lookback = 7d;
let lookbackDays = lookback / 1d;
let e5Users = 0;  // <-- your assigned E5/A5/F5/G5 user count (see the license query below)
let eligible = dynamic([
  "SigninLogs","AuditLogs","AADNonInteractiveUserSignInLogs","AADServicePrincipalSignInLogs",
  "AADManagedIdentitySignInLogs","AADProvisioningLogs","ADFSSignInLogs","AADUserRiskEvents",
  "AADRiskyUsers","OfficeActivity","McasShadowItReporting","InformationProtectionLogs_CL",
  "DeviceEvents","DeviceFileEvents","DeviceImageLoadEvents","DeviceInfo","DeviceLogonEvents",
  "DeviceNetworkEvents","DeviceNetworkInfo","DeviceProcessEvents","DeviceRegistryEvents",
  "DeviceFileCertificateInfo","EmailEvents","EmailUrlInfo","EmailAttachmentInfo","EmailPostDeliveryEvents"]);
Usage
| where TimeGenerated > ago(lookback) and IsBillable == true
| where DataType in (eligible)
| summarize EligibleGBPerDay = round(sum(Quantity) / 1024.0 / lookbackDays, 3)
| extend CapGBPerDay = round(e5Users * 5.0 / 1024.0, 3)
| extend FreeGBPerDay = min_of(EligibleGBPerDay, CapGBPerDay)
```

## How the query works

The query totals billable ingestion from the documented eligible tables over
the full lookback and divides by seven calendar days. It then calculates the
license-based daily cap and returns the smaller of eligible ingestion and the
cap. With `e5Users = 0`, the result is intentionally `0` rather than an
unsupported assumption that all eligible ingestion is free.

## Result fields

| Field | Meaning |
| --- | --- |
| `EligibleGBPerDay` | Average daily billable ingestion from the listed eligible data types. |
| `CapGBPerDay` | Maximum modeled benefit: qualifying users multiplied by 5 MB/day, converted to GB. |
| `FreeGBPerDay` | Smaller of eligible ingestion and the license-based cap; use this in the cost model. |

## Known limits

- **`Usage` isn't real-time:** usage data can lag by hours. The seven-day
  average smooths this delay but does not eliminate it.
- **`e5Users` is manual:** stale or incorrect assignments directly change the
  cap. Re-run the license helper when assignments materially change.
- **SKU part numbers vary:** the helper's SKU list is a reviewed starting point,
  not proof of offer eligibility. Compare it with `Get-MgSubscribedSku` and
  current offer terms.
- **Scope and RBAC:** missing workspaces understate eligible ingestion.
- **Estimate, not allocation evidence:** use Cost Management exports and the
  documented benefit meter to verify the benefit actually received.

## License-count query

Licenses live in Microsoft Entra ID, not Log Analytics, so counting qualifying
users requires Microsoft Graph rather than KQL:

```powershell
# Count users with an eligible Microsoft 365 E5/A5/F5/G5 license assigned.
# Microsoft Graph PowerShell — needs delegated User.Read.All + Organization.Read.All.
Connect-MgGraph -Scopes "User.Read.All","Organization.Read.All"
# Eligible SKU part numbers — adjust to match your tenant's plans:
$eligible = @("SPE_E5","ENTERPRISEPREMIUM","SPE_F5_SECCOMP","M365_F5_SECURITY",
  "M365EDU_A5_FACULTY","M365EDU_A5_STUUSEBNFT","Microsoft_365_G5")
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

- [Microsoft Sentinel benefit for Microsoft 365 E5 customers](https://azure.microsoft.com/en-us/offers/sentinel-microsoft-365-offer/) — offer terms and eligible data types.
- [View data allocation benefits](https://learn.microsoft.com/en-us/azure/azure-monitor/fundamentals/cost-usage#view-data-allocation-benefits) — billing-export verification guidance.
