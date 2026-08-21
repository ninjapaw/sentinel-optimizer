---
id: microsoft-365-e5-sentinel-benefit
title: "Microsoft Sentinel benefit for Microsoft 365 E5/A5/F5/G5 customers"
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
| summarize GB = sum(Quantity) / 1024.0 by bin(TimeGenerated, 1d)
| summarize EligibleGBPerDay = round(avg(GB), 3)
| extend CapGBPerDay = round(e5Users * 5.0 / 1024.0, 3)
| extend FreeGBPerDay = iff(e5Users > 0, min_of(EligibleGBPerDay, CapGBPerDay), EligibleGBPerDay)
```

> **Tip:** paste `FreeGBPerDay` into the "M365 E5 (GB/day)" field.

> **Known limits:**
> - **`Usage` isn't real-time**: usage data can lag by hours, so a short `lookback` can understate `EligibleGBPerDay`. The default 7-day average smooths this out.
> - **`e5Users` is a manual input, not queried**: if you forget to update it after license changes, `CapGBPerDay` (and therefore `FreeGBPerDay`) will be stale. Re-run the license-count query below whenever assignments change materially.
> - **SKU part numbers vary by tenant/region**: the `$eligible` list in the license query is a starting point, not exhaustive — Microsoft periodically renames or adds SKUs, so verify against your own `Get-MgSubscribedSku` output.
> - **Requires tenant-wide `Usage` visibility**: if you only have access to a subset of workspaces, `EligibleGBPerDay` will be understated for the same reason described in the Defender for Servers P2 query's RBAC note.

## Discussion

The Microsoft Sentinel benefit for Microsoft 365 E5/A5/F5/G5 customers grants
up to 5 MB/user/day of free Sentinel ingestion across a fixed set of Microsoft
Entra ID, Microsoft 365/Office activity, Defender XDR/Defender for Endpoint
raw event, Defender for Cloud Apps Shadow IT, and Information Protection data
types. Because the cap depends on your qualifying license count (not a
discoverable table in Log Analytics), you need a separate license-count
lookup — see the [license-count query](#license-count-query) below — and feed
that number into `e5Users` before running this query.

Unlike the Defender for Servers Plan 2 benefit, this offer isn't
subscription-pooled in the same documented way; the cap scales with your
tenant-wide qualifying user count, so a single tenant-wide run is sufficient
(no per-subscription split is required here).

### License-count query

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

### Sources

- [Microsoft Sentinel benefit for Microsoft 365 E5 customers](https://azure.microsoft.com/en-us/offers/sentinel-microsoft-365-offer/) — offer terms and eligible data types.
