# Sentinel Optimizer

Sentinel Optimizer is a client-side demo for estimating Microsoft Sentinel ingestion costs and comparing SIEM migration options. Parsing, normalization, estimation, pricing, and deterministic recommendations run in the browser.

Optional AI features are disabled by default. When enabled, only the bounded API contract is sent to the configured API. Raw exports, credentials, and customer secrets are not sent by this project.

> **Independent community project.** This repository is not a Microsoft product,
> assessment, endorsement, or official pricing source. Some contributors may be
> Microsoft employees acting in an individual or community capacity. Use at your
> own risk and verify cost, security, and licensing decisions with official
> Microsoft sources. See [DISCLAIMER.md](DISCLAIMER.md).

## Contents

- [Sentinel Optimizer](#sentinel-optimizer)
  - [Contents](#contents)
  - [Features](#features)
  - [Repository layout](#repository-layout)
  - [Development](#development)
  - [Configuration management](#configuration-management)
    - [Deployment targets](#deployment-targets)
    - [Deployment environment variables](#deployment-environment-variables)
    - [GitHub environment secrets](#github-environment-secrets)
  - [Azure deployment](#azure-deployment)
    - [Environment variables](#environment-variables)
    - [Environment secrets](#environment-secrets)
    - [Built-in GitHub token](#built-in-github-token)
    - [Infrastructure workflow inputs](#infrastructure-workflow-inputs)
  - [Key Vault secret management](#key-vault-secret-management)
  - [Security](#security)
  - [License](#license)

## Features

- **Sentinel Cost Calculator**: Parse Sentinel, Splunk, and Elastic exports into one normalized model. Estimate data volume from infrastructure inventory. Model ingestion, retention, search, SOAR, and related costs.
- **Defender for Cloud Cost Estimator**: Calculate monthly costs for various Azure Defender protection plans (Servers, Databases, Storage, App Service, Containers, Key Vault).
- **Usage & Quota Tracker**: Monitor resource usage and quotas with real-time progress indicators and status alerts.
- Export results for planning and review.
- Run without an API, credentials, database, or cloud account.
- Optionally deploy a static site and a separate Azure Functions API.
- All processing runs client-side in the browser—no data sent externally unless AI features are enabled.

## Query and export examples

The calculator accepts ingestion-by-source exports for the vendors below. Run the
recommended query over the last 30 days, export the results as JSON, and paste
the result into the calculator. Keep `windowDays` set to the number of days in
the query window. Byte values are totals for the full window, not daily values.

The examples use the same fields recognized by the parsers. Source names can be
represented by fields such as `name`, `source`, `idx`, `log_source_name`, or
`log_source`. Volume can be supplied as `bytes`, `gb`, `mb`, or `gbPerDay`.

### Microsoft Sentinel

Run in Microsoft Sentinel Logs (Log Analytics), then select **Export > JSON**:

```kusto
Usage
| where TimeGenerated > ago(30d) and IsBillable == true
| summarize QuantityMB = sum(Quantity) by DataType
| order by QuantityMB desc
```

Example result:

```json
{
  "windowDays": 30,
  "usage": [
    { "DataType": "SecurityEvent", "QuantityMB": 1228800 },
    { "DataType": "SigninLogs", "QuantityMB": 307200 },
    { "DataType": "CommonSecurityLog", "QuantityMB": 921600 }
  ],
  "connectors": [
    {
      "name": "AzureActiveDirectory",
      "kind": "AzureActiveDirectory",
      "enabled": true
    },
    {
      "name": "MicrosoftThreatProtection",
      "kind": "MicrosoftThreatProtection",
      "enabled": false
    }
  ]
}
```

### Splunk

Run in Splunk Search:

```spl
index=_internal source=*license_usage.log type=Usage earliest=-30d@d
| stats sum(b) AS bytes count AS events BY idx
| sort - bytes
```

Example result:

```json
{
  "windowDays": 30,
  "results": [
    { "idx": "main", "bytes": 32212254720, "events": 48000000 },
    { "idx": "firewall", "bytes": 16106127360, "events": 21000000 },
    { "idx": "windows", "bytes": 8053063680 }
  ]
}
```

### Elastic

Run against Elasticsearch:

```http
GET _cat/indices?bytes=b&format=json&h=index,docs.count,store.size&s=store.size:desc
```

Example result:

```json
[
  {
    "index": "logs-2026.05",
    "docs.count": "12500000",
    "store.size": "21474836480"
  },
  {
    "index": "metrics-2026.05",
    "docs.count": "8000000",
    "store.size": "5368709120"
  },
  { "index": "audit-2026.05", "docs.count": "450000" }
]
```

### Rapid7 InsightIDR

Run in InsightIDR Log Search (LEQL) over the last 30 days. If the log source
does not expose `size_bytes`, export event counts and use the InsightIDR
**Settings > Data Collection > Data Usage (GB)** report for the volume total.

```text
where(/.*/)
groupby(log_source_name)
calculate(sum:size_bytes)
```

Example result:

```json
{
  "windowDays": 30,
  "sources": [
    { "name": "AWS CloudTrail", "bytes": 18253611008 },
    { "name": "Windows Event Log", "bytes": 9663676416 },
    { "name": "Palo Alto Firewall", "bytes": 5368709120 }
  ]
}
```

### IBM QRadar

Run in Log Activity > Advanced Search (AQL):

```sql
SELECT LOGSOURCENAME(logsourceid) AS name, SUM(eventcount) AS events
FROM events
GROUP BY logsourceid
ORDER BY events DESC
LAST 30 DAYS
```

Example result:

```json
{
  "windowDays": 30,
  "results": [
    { "name": "Cisco ASA", "events": 240000000 },
    { "name": "Windows Security", "events": 180000000 },
    { "name": "Linux Auth", "events": 36000000 }
  ]
}
```

QRadar reports event counts rather than raw bytes in this example. The
calculator estimates volume using its configured average bytes per event.

### Sumo Logic

Run against the Sumo Logic volume index:

```text
_index=sumologic_volume
| sum(sizeInBytes) as bytes by _sourceCategory
| sort by bytes
```

Example result:

```json
{
  "windowDays": 30,
  "results": [
    { "_sourceCategory": "prod/aws/cloudtrail", "bytes": 21474836480 },
    { "_sourceCategory": "prod/firewall/palo", "bytes": 12884901888 },
    { "_sourceCategory": "prod/os/linux", "bytes": 6442450944 }
  ]
}
```

### CrowdStrike Falcon LogScale

Run over the last 30 days and all repositories:

```text
#repo=*
| groupBy([#repo], function=sum(@rawstring.length, as=bytes))
| sort(bytes, order=desc)
```

Example result:

```json
{
  "windowDays": 30,
  "rows": [
    { "#repo": "edr", "bytes": 32212254720 },
    { "#repo": "firewall", "bytes": 10737418240 },
    { "#repo": "identity", "bytes": 4294967296 }
  ]
}
```

### Google SecOps Chronicle

Run against the BigQuery ingestion metrics export:

```sql
SELECT log_type AS name, SUM(size_bytes) AS bytes
FROM `datalake.ingestion_metrics`
WHERE _PARTITIONDATE >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY log_type
ORDER BY bytes DESC
```

Example result:

```json
{
  "windowDays": 30,
  "sources": [
    { "name": "WINEVTLOG", "bytes": 16106127360 },
    { "name": "GCP_CLOUDAUDIT", "bytes": 9663676416 },
    { "name": "PAN_FIREWALL", "bytes": 6442450944 }
  ]
}
```

### Datadog

Use Logs > Usage or the Usage Metering API for the last 30 days. Export rows
with the log source and ingested GB:

```text
{ "source": "<log source>", "gb": "<ingested GB>" }
```

API endpoint:

```text
GET https://api.datadoghq.com/api/v2/usage/logs_by_retention
```

Example result:

```json
{
  "windowDays": 30,
  "rows": [
    { "source": "cloudtrail", "gb": 540 },
    { "source": "nginx", "gb": 320 },
    { "source": "kubernetes", "gb": 210 }
  ]
}
```

### Exabeam

Run in Exabeam Search over the last 30 days:

```text
groupBy(log_source)
| stats sum(message_size) as bytes, count() as events by log_source
| sort bytes desc
```

Example result:

```json
{
  "windowDays": 30,
  "results": [
    { "log_source": "Windows Security", "bytes": 19327352832 },
    { "log_source": "Okta", "bytes": 6442450944 },
    { "log_source": "Zscaler", "bytes": 4294967296 }
  ]
}
```

### LogRhythm

Run in the Web Console, LogRhythm DX, or SIEM export for the last 30 days:

```sql
SELECT LogSourceName AS name, COUNT(*) AS events
FROM LogMart
WHERE NormalDate >= DATEADD(day, -30, GETDATE())
GROUP BY LogSourceName
ORDER BY events DESC
```

Example result:

```json
{
  "windowDays": 30,
  "results": [
    { "name": "Windows Security", "events": 210000000 },
    { "name": "Cisco ASA", "events": 150000000 },
    { "name": "Linux Syslog", "events": 42000000 }
  ]
}
```

LogRhythm is message-rate based in this example, so the calculator estimates
volume at approximately 0.5 KB per message.

### Arctic Wolf

Arctic Wolf does not provide a customer query language for this report. Request
an ingestion report from your Concierge Security Team, or export from the
Arctic Wolf portal under **Reports > Log Search / Data Ingestion > by log
source** for the last 30 days.

Example result:

```json
{
  "windowDays": 30,
  "sources": [
    { "name": "Firewall (Fortinet)", "bytes": 15032385536 },
    { "name": "Microsoft 365", "bytes": 8589934592 },
    { "name": "Windows Event Log", "bytes": 5368709120 }
  ]
}
```

## Repository layout

| Path                  | Purpose                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `parsers/`, `schema/` | Pure vendor parsing and normalized contracts                                                                                                 |
| `estimators/`         | Data-volume estimation                                                                                                                       |
| `pricing/`            | Sentinel pricing model                                                                                                                       |
| `shared/`             | Shared configuration, contracts, and utilities; `config/internal.config.ts` contains source-controlled safety limits and protocol invariants |
| `api/`                | Provider-neutral Node/Azure Functions API                                                                                                    |
| `web/`                | Astro and React static frontend                                                                                                              |
| `infra/azure/`        | Bicep stacks and zip-deployment support                                                                                                      |
| `test/`               | Engine tests                                                                                                                                 |

## Development

Requirements: Node.js `22.12.0` and npm `11.9.0`.

```bash
npm ci
npm --prefix api ci
npm --prefix web ci
npm run typecheck
npm test
npm run build
```

Run locally:

```bash
npm run dev
```

The web app runs on `http://localhost:4321`; the portable API runs on
`http://localhost:7071`. The app works without model credentials.

Copy `web/.env.example` to `web/.env` for local public settings. Never place API
keys, tokens, connection strings, customer exports, tenant secrets, or deployment
credentials in source code, browser-exposed `PUBLIC_*` values, or committed
configuration files.

## Configuration management

The repository has one shared configuration boundary:

| Location                           | Ownership                   | What belongs there                                                                                                                                                  |
| ---------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/deploy.config.json`        | Source-controlled deploy config | Non-secret dev/prod subscriptions, branches, domains, resource names, SKUs, feature flags, and cost limits.                                                       |
| `shared/config/user.config.ts`     | Source-controlled fallback  | Browser-safe identity and branding defaults used locally or when an Environment variable is deliberately unset.                                                     |
| `shared/config/internal.config.ts` | Source-controlled invariant | API route contracts, payload limits, timeout/retry limits, CORS fallback, and UI input size limits. Change these only with tests and a security/performance review. |
| GitHub Environment variables       | Deployment operator         | Tenant/client/principal identifiers and External ID settings that cannot be inferred from the repository. `PUBLIC_*` values are browser-visible.                    |
| GitHub Environment secrets         | Deployment operator         | Deployment tokens and third-party API keys only.                                                                                                                    |

The **Deploy Application** workflow consumes these values from its selected
GitHub Environment. Do not use repository-wide variables for production
settings: environment scope prevents development and production values from
being mixed.

### Deployment targets

Create `dev` and `prod` in **Settings > Environments**. The workflows map `dev`
to the `dev` environment and `main` to `prod`; a mismatched manual selection is
rejected.

| `DEPLOYMENT_TARGET`     | Deploys                                                                           | Required configuration                                                                |
| ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `azure-static-web-app`  | Azure Static Web Apps site and, when `AZURE_DEPLOY_API=true`, Azure Functions API | Azure variables and secrets below. Recommended for production.                        |
| `github-pages`          | Static site only                                                                  | `PUBLIC_SITE_URL` and `PUBLIC_SITE_BASE`; GitHub Pages must be enabled.               |
| `cloudflare-worker-api` | Cloudflare Worker API only                                                        | `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. It does not host the static site. |

An unset or unsupported target stops the workflow. One Environment selects one
provider; do not combine provider enable flags to create an ambiguous release.

### Deployment environment variables

Create or edit public values in the selected deployment Environment. Empty
optional values fall back to `shared/config/user.config.ts`.

| Variable                              | Required              | Recommended value                             | Purpose and guidance                                                                                                                   |
| ------------------------------------- | --------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `DEPLOYMENT_TARGET`                   | Yes                   | `azure-static-web-app`                        | Provider selected by the protected Environment.                                                                                        |
| `PUBLIC_SITE_URL`                     | GitHub Pages          | `https://sentineloptimizer.com`               | Canonical URL for a Pages target. Azure uses `AZURE_PUBLIC_SITE_URL`.                                                                  |
| `PUBLIC_SITE_BASE`                    | GitHub Pages          | `/`                                           | Astro base path for a Pages target. Azure Static Web Apps always uses `/`.                                                             |
| `PUBLIC_SITE_NAME`                    | Optional              | `Sentinel Optimizer`                          | Browser-visible product name and document-export branding.                                                                             |
| `PUBLIC_SITE_TAGLINE`                 | Optional              | `SIEM cost & migration estimator`             | Browser-visible short description.                                                                                                     |
| `PUBLIC_SITE_OWNER`                   | Optional              | `Sentinel Optimizer contributors`             | Browser-visible metadata and document-export owner.                                                                                    |
| `PUBLIC_SITE_REPOSITORY`              | Optional              | `ninjapaw/sentinel-optimizer`                 | GitHub repository slug used for repository links.                                                                                      |
| `PUBLIC_SITE_DESCRIPTION`             | Optional              | The default in `shared/config/user.config.ts` | SEO and social-card description. Keep it concise and accurate.                                                                         |
| `PUBLIC_AI_API_BASE`                  | GitHub Pages          | Empty for same-origin API                     | HTTPS origin for the optional aggregated-AI API. Azure derives its API origin from `AZURE_FUNCTIONAPP_NAME` when `AZURE_USE_API=true`. |
| `CLOUDFLARE_ACCOUNT_ID`               | Cloudflare Worker API | Cloudflare account ID                         | Non-secret account identifier used only by the `cloudflare-worker-api` target.                                                         |
| `PUBLIC_ADMIN_API_BASE`               | Optional              | Empty until admin APIs are enabled            | HTTPS origin for the authenticated admin API. Set this only with the External ID variables below.                                      |
| `PUBLIC_ENTRA_EXTERNAL_ID_CLIENT_ID`  | Optional              | SPA application/client ID                     | Public SPA identifier for External ID. It is not a secret.                                                                             |
| `PUBLIC_ENTRA_EXTERNAL_ID_AUTHORITY`  | Optional              | External ID authority URL                     | MSAL authority for the SPA. Must match the tenant and application registration.                                                        |
| `PUBLIC_ENTRA_EXTERNAL_ID_API_SCOPE`  | Optional              | `api://.../access_as_user`                    | Scope requested for admin API calls.                                                                                                   |
| `PUBLIC_ENTRA_EXTERNAL_ID_ADMIN_ROLE` | Optional              | `SentinelOptimizer.Admin`                     | UI role hint only; the API must enforce authorization independently.                                                                   |

The public identity variables are supported by every target. Keep them
independent per Environment when development and production identities differ.

### GitHub environment secrets

The static browser site must not receive a secret. GitHub Pages needs no
provider secret; use the following Environment secrets only in their matching
provider jobs:

| Environment                                       | Secret                            | Required by target         | Purpose and recommendation                                                                                  |
| ------------------------------------------------- | --------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `dev`, `prod` | `CLOUDFLARE_API_TOKEN`            | `cloudflare-worker-api`    | Scoped Cloudflare deployment token. Pair it with non-secret `CLOUDFLARE_ACCOUNT_ID` and rotate on exposure. |
| `dev`, `prod` | `AZURE_STATIC_WEB_APPS_API_TOKEN` | Azure Static Web Apps site | Long-lived Static Web Apps deployment token. Rotate it immediately if exposed.                              |

Runtime API secrets such as `AI_API_KEY`, `AZURE_OPENAI_API_KEY`, and
Cosmos access uses `COSMOS_ENDPOINT` with managed identity. Runtime third-party
API keys belong in Azure Key Vault or the Function App's own settings, not in
GitHub build variables. See
[Key Vault secret management](#key-vault-secret-management). Use
`api/.env.example` and `api/.dev.vars.example` only as local templates; their
real counterparts are ignored by Git.

## Azure deployment

The lowest-cost topology is:

1. Azure Static Web Apps Free for the frontend.
2. Azure Functions Flex Consumption for the optional API, deployed as a zip package.
3. Azure OpenAI only when a required feature justifies its separate usage cost.

The repository uses Bicep. It does not require Docker for the Azure Functions deployment. The API Dockerfile remains available for local/container scenarios.

Shared Bicep compilation and committed-template drift checks are provided by
the immutable reusable validator in [Pawprint](https://github.com/ninjapaw/pawprint).
Sentinel-specific Functions, Cosmos DB, Key Vault, and Static Web Apps settings
remain owned by this repository; Pawprint supplies the cross-repository IaC
validation contract rather than replacing those application resources.

Set the subscription ID in the selected GitHub Environment with bootstrap, or
set `environments.dev.subscriptionId` and `environments.prod.subscriptionId`
in `config/deploy.config.json`; they must identify different subscriptions.
Then run:

```bash
bash infra/azure/bootstrap.sh --environment dev
bash infra/azure/bootstrap.sh --environment prod
```

Bootstrap reads names, domains, SKUs, and feature flags from that file. It
creates GitHub OIDC federation and scoped role assignments without a client
secret. Command-line options remain available for exceptional one-off overrides.

### Cloudflare DNS for Azure Static Web Apps

Cloudflare can remain the authoritative DNS provider while Azure Static Web
Apps hosts the site. The Azure deployment creates the Static Web App first; DNS
validation is a separate, explicit step because it changes records in the
Cloudflare zone.

The supported connector is
[`infra/azure/site/connect-cloudflare-dns.sh`](infra/azure/site/connect-cloudflare-dns.sh).
It discovers or starts the Azure custom-domain validation, creates the required
non-proxied `_dnsauth.<domain>` TXT record, and creates the non-proxied CNAME
from the custom hostname to the Static Web Apps default hostname. It is
idempotent and updates existing records rather than creating duplicates.

Run it after the Static Web App exists:

```bash
az login
export AZURE_RESOURCE_GROUP=NP-SentinelOptimizer-Dev-CentralUS
export AZURE_STATIC_WEB_APP_NAME=np-sentineloptimizer-dev-centralus
export AZURE_CUSTOM_DOMAIN=dev.sentineloptimizer.com
export CLOUDFLARE_ZONE_ID=<zone-id>
export CLOUDFLARE_API_TOKEN=<scoped-dns-edit-token>
bash infra/azure/site/connect-cloudflare-dns.sh
```

The Cloudflare token is the only sensitive input. Create it with zone-scoped
DNS edit permission, use it only in the local shell or a protected GitHub
Environment secret, and never commit it. Keep the records **DNS only** while
Azure validates the hostname; proxying can be reconsidered after validation if
the resulting TLS and origin behavior are tested. DNS propagation can take
time. Verify the Azure custom-domain status with the command printed by the
connector. The connector does not replace Cloudflare's registrar, name-server,
zone, or certificate settings.

### Branching and promotion

| Branch | GitHub Environment | Domain                          | Resource group                              |
| ------ | ------------------ | ------------------------------- | ------------------------------------------- |
| `dev`  | `dev`              | `dev.sentineloptimizer.com`     | `NP-SentinelOptimizer-Dev-CentralUS`        |
| `main` | `prod`             | `sentineloptimizer.com`         | `NP-SentinelOptimizer-CentralUS`            |

Each row targets the subscription configured for that environment. Do not use
the same subscription ID for both environments.

The **Deploy Application** workflow refuses to deploy an environment from the wrong branch: `dev` must run from `dev`, and `prod` must run from `main`.

To ship a change:

1. Merge work into `dev` and run **Deploy Application** from `dev` with the `dev` environment.
2. Verify the development site.
3. Run **Promote Dev to Main**, which opens a `dev` → `main` pull request after confirming Continuous Integration passed on the `dev` head commit.
4. Merge the pull request, then run **Deploy Application** from `main` with the `prod` environment.

**Promote Dev to Main** needs *Settings → Actions → General → Allow GitHub Actions to create and approve pull requests* enabled.

### Environment variables

`scripts/deploy-config.mjs` supplies deployment names, subscription, region,
domains, SKUs, feature flags, and secret-expiration policy from
`config/deploy.config.json`. Bootstrap supplies these remaining non-secret
GitHub Environment variables:

| Variable                              | Purpose |
| ------------------------------------- | ------- |
| `AZURE_CLIENT_ID`                     | Infrastructure OIDC application client ID. |
| `AZURE_API_CLIENT_ID`                 | Separate Functions deployment OIDC client ID. |
| `AZURE_TENANT_ID`                     | Tenant containing the OIDC applications. |
| `AZURE_API_PRINCIPAL_OBJECT_ID`       | Principal receiving scoped Function App deployment access. |
| `AZURE_INFRA_PRINCIPAL_OBJECT_ID`     | Principal receiving scoped infrastructure and secret-management access. |
| `ENTRA_EXTERNAL_ID_ISSUER`            | Exact JWT issuer accepted by the API. |
| `ENTRA_EXTERNAL_ID_JWKS_URI`          | Signing-key endpoint used for token validation. |
| `ENTRA_EXTERNAL_ID_AUDIENCE`          | Expected API access-token audience. |
| `ENTRA_EXTERNAL_ID_ADMIN_ROLE`        | Required administrator app-role claim. |
| `PUBLIC_ENTRA_EXTERNAL_ID_CLIENT_ID`  | Public SPA application identifier. |
| `PUBLIC_ENTRA_EXTERNAL_ID_AUTHORITY`  | MSAL authority for the SPA. |
| `PUBLIC_ENTRA_EXTERNAL_ID_API_SCOPE`  | Delegated API scope requested by the SPA. |
| `PUBLIC_ADMIN_API_BASE`               | Authenticated administration API origin. |
| `CLOUDFLARE_ZONE_ID`                   | Cloudflare zone identifier used by the optional Static Web Apps DNS connector. |

The API receives `COSMOS_ENDPOINT` from the consolidated Bicep deployment and
uses the Function App managed identity for Cosmos data access.

### Environment secrets

Create only true credentials as secrets in `dev` and `prod`:

| Secret                            | Purpose |
| --------------------------------- | ------- |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Static Web Apps deployment credential, scoped to one site. |
| `AI_API_KEY`                      | Optional third-party model credential synchronized to Key Vault. |
| `CLOUDFLARE_API_TOKEN`            | Optional Cloudflare DNS-edit or Worker deployment credential, scoped to the required zone/account. |

Azure client, tenant, subscription, and principal IDs are identifiers, not
credentials. The subscription IDs and public site URLs live in the versioned
deployment config; OIDC identifiers live in Environment variables.

### Built-in GitHub token

`GITHUB_TOKEN` is automatically created by GitHub Actions and is used for
Static Web Apps pull-request integration. Do not create or copy it manually.

### Infrastructure workflow inputs

The **Validate and Deploy Azure Infrastructure** workflow also has manual
inputs. These are not stored as Environment variables or secrets:

| Input                        | Recommended default | Applies to | Guidance                                                           |
| ---------------------------- | ------------------- | ---------- | ------------------------------------------------------------------ |
| `environment`                | Auto-detect         | All stacks | Branch `dev` selects `dev`; branch `main` selects `prod`.           |
| `component`                  | `all`               | All stacks | Deploy the consolidated subscription-scope stack; component mode remains available for recovery. |
| `operation`                  | `what-if`           | All stacks | Review the preview before selecting `deploy`.                      |

SKUs and capacity settings come from `config/deploy.config.json`, so reviews see
cost changes in source control. Use `what-if` before applying infrastructure
changes and require reviewers for `prod`.

## Key Vault secret management

Azure Key Vault holds the API's runtime secrets. The Function App reads them
with its own managed identity, so no secret value is stored in GitHub, in the
Bicep templates, or in the browser bundle.

### Design

| Control             | Choice                                              | Why                                                                                                                         |
| ------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Authorization       | Azure RBAC, not access policies                     | Roles are auditable, scoped, and managed the same way as the rest of the subscription.                                      |
| Function App access | `Key Vault Secrets User` on the vault               | Read-only data-plane access for unavoidable third-party secrets.      |
| Pipeline access     | `Key Vault Secrets Officer` on the vault            | Lets the deployment identity rotate secrets without granting read access to other resources.                                |
| Deletion protection | Soft delete plus purge protection                   | Prevents irreversible secret loss. Purge protection cannot be turned off once enabled.                                      |
| App settings        | `@Microsoft.KeyVault(VaultName=...;SecretName=...)` | Versionless references pick up a rotated secret without redeploying the API.                                                |
| Audit               | Optional `AuditEvent` diagnostic setting            | Sends vault access logs to Log Analytics when a workspace is supplied.                                                      |

### Secrets stored in the vault

| Secret name                | Consumed as                | Required when                                                                                      |
| -------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| `ai-api-key`               | `AI_API_KEY`               | The API calls a third-party AI provider. Not needed for Azure OpenAI, which uses managed identity. |

Non-secret settings such as `AI_BASE_URL`, `AI_MODEL`, `COSMOS_DATABASE`, and
the `ENTRA_EXTERNAL_ID_*` values stay as plain Function App settings.

### First-time setup order

The Function App must exist before the vault can grant its identity access, and
the secrets must exist before the API references them:

1. Run the infrastructure workflow with `component: all` and `operation: what-if`.
2. After review, run it with `operation: deploy`. This creates monitoring,
  Static Web Apps, Functions, Cosmos RBAC, and Key Vault in dependency order.
3. Run the **Manage Key Vault Secrets** workflow with `operation: sync`. Leave
   `dry_run: true` for a preview, then rerun with `dry_run: false`.

### Rotation and auditing

Run the **Manage Key Vault Secrets** workflow with `operation: sync` to rotate.
[`sync-secrets.sh`](infra/azure/keyvault/sync-secrets.sh) is idempotent: it
creates a new secret version only when the value actually changed, and
otherwise refreshes the expiration date. Because app settings reference secrets
without a version, the API picks up a rotated value without a redeployment.

Cosmos credentials are not synchronized: the Function App uses its managed
identity and `COSMOS_ENDPOINT`.

[`audit-secrets.sh`](infra/azure/keyvault/audit-secrets.sh) runs after every
sync and on a weekly schedule. It fails the run when a secret has expired, warns
when one expires within `AZURE_SECRET_WARN_DAYS`, and reports secrets that have
no expiration date. If the production Environment requires reviewers, the
scheduled audit waits for an approval; point the schedule at a different
environment or remove it if that is not wanted.

Both scripts run locally too:

```bash
az login
bash infra/azure/keyvault/sync-secrets.sh --vault <vault-name> --dry-run
bash infra/azure/keyvault/audit-secrets.sh --vault <vault-name>
```

### Further hardening

The session storage client accepts `COSMOS_ENDPOINT` and uses
`DefaultAzureCredential`. The consolidated Bicep deployment disables Cosmos
local authentication and grants the Function App its data-plane role. Private
endpoints require a non-consumption networking design and are intentionally
deferred until the recovery and traffic requirements justify that cost.

## Security

This is a planning and estimation tool, not a security boundary. Review inputs and outputs before relying on them. Keep public API routes disabled unless authentication, rate limiting, CORS restrictions, abuse monitoring, quotas, and cost controls are configured. Do not enable AI routes without provider budgets and alerts.

Report suspected vulnerabilities privately through the repository owner’s configured security process. Do not publish secrets, customer data, or exploit details in an issue.

## License

MIT. See [LICENSE](LICENSE).

[Microsoft Sentinel documentation](https://learn.microsoft.com/azure/sentinel/) · [Azure Functions documentation](https://learn.microsoft.com/azure/azure-functions/) · [Azure Static Web Apps documentation](https://learn.microsoft.com/azure/static-web-apps/)
