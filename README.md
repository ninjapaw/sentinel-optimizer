# Sentinel Optimizer

Sentinel Optimizer is a client-side demo for estimating Microsoft Sentinel ingestion costs and comparing SIEM migration options. Parsing, normalization, estimation, pricing, and deterministic recommendations run in the browser.

Optional AI features are disabled by default. When enabled, only the bounded API contract is sent to the configured API. Raw exports, credentials, and customer secrets are not sent by this project.

> **Unofficial community helper.** Ninja Paws is a fictional demo organization used by this repository. This is an independent community project, not a Microsoft product, and is not affiliated with, sponsored by, endorsed by, or supported by Microsoft Corporation. Contributions from Microsoft employees, if any, are made in an individual capacity and do not imply Microsoft endorsement or sponsorship. The project is provided publicly **at your own risk**. Cost figures are planning estimates based on public list pricing; verify Microsoft Sentinel pricing and entitlements with your Microsoft account team. The Microsoft Product Terms and [Azure pricing](https://azure.microsoft.com/pricing/) are the source of truth. Validate all estimates, security controls, costs, and deployment settings before using them in production. Microsoft trademarks and product names belong to Microsoft Corporation. See [License](LICENSE) and the official [Microsoft Product Terms](https://www.microsoft.com/licensing/terms/productoffering).

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
| `shared/config/user.config.ts`     | Source-controlled fallback  | Browser-safe identity and branding defaults used locally or when an Environment variable is deliberately unset.                                                     |
| `shared/config/internal.config.ts` | Source-controlled invariant | API route contracts, payload limits, timeout/retry limits, CORS fallback, and UI input size limits. Change these only with tests and a security/performance review. |
| GitHub Environment variables       | Deployment operator         | Non-secret public build values and deployment names. `PUBLIC_*` values are embedded in the static browser bundle and must be treated as public.                     |
| GitHub Environment secrets         | Deployment operator         | Credentials, OIDC identifiers, deployment tokens, and API keys. They are never included in browser builds.                                                          |

The **Deploy Application** workflow consumes these values from its selected
GitHub Environment. Do not use repository-wide variables for production
settings: environment scope prevents development and production values from
being mixed.

### Deployment targets

Create `deployment-development` and `deployment-production` in **Settings >
Environments**. The manual **Deploy Application** workflow selects one and
validates `DEPLOYMENT_TARGET` before it reads provider credentials.

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
| `deployment-development`, `deployment-production` | `CLOUDFLARE_API_TOKEN`            | `cloudflare-worker-api`    | Scoped Cloudflare deployment token. Pair it with non-secret `CLOUDFLARE_ACCOUNT_ID` and rotate on exposure. |
| `deployment-development`, `deployment-production` | `AZURE_CLIENT_ID`                 | Azure infrastructure       | OIDC application client ID with least-privilege Azure roles.                                                |
| `deployment-development`, `deployment-production` | `AZURE_API_CLIENT_ID`             | Azure Functions API        | Separate OIDC identity for Functions code deployment.                                                       |
| `deployment-development`, `deployment-production` | `AZURE_TENANT_ID`                 | Azure target               | Tenant containing the OIDC applications.                                                                    |
| `deployment-development`, `deployment-production` | `AZURE_SUBSCRIPTION_ID`           | Azure target               | Subscription that owns the Environment resource group.                                                      |
| `deployment-development`, `deployment-production` | `AZURE_API_PRINCIPAL_OBJECT_ID`   | Azure infrastructure       | Object ID used for the scoped Function App deployment role.                                                 |
| `deployment-development`, `deployment-production` | `AZURE_STATIC_WEB_APPS_API_TOKEN` | Azure Static Web Apps site | Long-lived Static Web Apps deployment token. Rotate it immediately if exposed.                              |

Runtime API secrets such as `AI_API_KEY`, `AZURE_OPENAI_API_KEY`, and
`COSMOS_CONNECTION_STRING` belong in the deployed provider's secret store or
Function App settings, not in GitHub build variables. Use `api/.env.example`
and `api/.dev.vars.example` only as local templates; their real counterparts
are ignored by Git.

## Azure deployment

The lowest-cost topology is:

1. Azure Static Web Apps Free for the frontend.
2. Azure Functions Flex Consumption for the optional API, deployed as a zip package.
3. Azure OpenAI only when a required feature justifies its separate usage cost.

The repository uses Bicep. It does not require Docker for the Azure Functions deployment. The API Dockerfile remains available for local/container scenarios.

Azure deployment values belong in protected GitHub Environments, not this public repository. Create:

- `deployment-development`
- `deployment-production`

Use `infra/azure/bootstrap.sh --environment development` to seed one environment, then repeat for production. The bootstrap creates short-lived GitHub OIDC federation and scoped role assignments; it does not create a client secret.

### Environment variables

Create these as **GitHub Environment variables** in both environments. Use
separate names and URLs for development and production.

| Variable                              | Required       | Development example                         | Production example                        | Purpose and guidance                                                                                                  |
| ------------------------------------- | -------------- | ------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `DEPLOYMENT_TARGET`                   | Yes            | `azure-static-web-app`                      | `azure-static-web-app`                    | Selects the validated application deployment provider.                                                                |
| `AZURE_ENVIRONMENT`                   | Yes            | `development`                               | `production`                              | Environment tag applied by Bicep.                                                                                     |
| `AZURE_LOCATION`                      | Yes            | `centralus`                                 | `centralus`                               | Azure deployment region. Confirm service availability and quota first.                                                |
| `AZURE_RESOURCE_GROUP`                | Yes            | `sentinel-optimizer-development`            | `sentinel-optimizer-production`           | Resource group owned by this environment.                                                                             |
| `AZURE_STATIC_WEB_APP_NAME`           | Yes            | `sentinel-optimizer-development-site`       | `sentinel-optimizer-production-site`      | Globally unique Static Web Apps resource name.                                                                        |
| `AZURE_FUNCTIONAPP_NAME`              | Yes            | `sentinel-optimizer-development-api`        | `sentinel-optimizer-production-api`       | Globally unique Azure Functions app name.                                                                             |
| `AZURE_PUBLIC_SITE_URL`               | Yes            | Generated dev URL or dev custom domain      | Production custom domain or generated URL | Canonical site URL embedded into the static build. Must use `https://`.                                               |
| `AZURE_DEPLOY_API`                    | Yes            | `false` initially; `true` when API is ready | `true` only when approved                 | Enables API code deployment. Keep `false` for a static-only deployment.                                               |
| `AZURE_USE_API`                       | Yes            | `false` until health check passes           | `true` after API validation               | Makes the frontend call the separate Functions API. Requires `AZURE_DEPLOY_API=true`.                                 |
| `AZURE_ENABLE_ANONYMOUS_AI_ROUTES`    | Yes            | `false`                                     | `false`                                   | Controls paid anonymous AI routes. Keep `false` unless authentication, rate limits, quotas, and budgets are in place. |
| `AZURE_OPENAI_ACCOUNT_NAME`           | Yes for AI IaC | `sentinel-optimizer-development-openai`     | `sentinel-optimizer-production-openai`    | Azure OpenAI account name. Do not deploy the AI stack unless needed.                                                  |
| `AZURE_OPENAI_MODEL_NAME`             | Yes for AI IaC | `gpt-4.1-mini`                              | Approved supported model                  | Model identifier used by the optional AI stack. Check regional quota.                                                 |
| `AZURE_OPENAI_MODEL_DEPLOYMENT`       | Yes for AI IaC | `sentinel-optimizer-model`                  | `sentinel-optimizer-model`                | Deployment name written to the Function App settings.                                                                 |
| `ENTRA_EXTERNAL_ID_ISSUER`            | Admin API      | External ID issuer URL                      | External ID issuer URL                    | Exact JWT issuer accepted by the admin API.                                                                           |
| `ENTRA_EXTERNAL_ID_JWKS_URI`          | Admin API      | External ID JWKS URL                        | External ID JWKS URL                      | Signing-key endpoint used for token validation.                                                                       |
| `ENTRA_EXTERNAL_ID_AUDIENCE`          | Admin API      | API application/client ID                   | API application/client ID                 | Expected access-token audience.                                                                                       |
| `ENTRA_EXTERNAL_ID_ADMIN_ROLE`        | Admin API      | `SentinelOptimizer.Admin`                   | `SentinelOptimizer.Admin`                 | Required app-role claim.                                                                                              |
| `PUBLIC_ENTRA_EXTERNAL_ID_CLIENT_ID`  | Admin site     | SPA application/client ID                   | SPA application/client ID                 | Public SPA identifier; never a client secret.                                                                         |
| `PUBLIC_ENTRA_EXTERNAL_ID_AUTHORITY`  | Admin site     | External ID authority URL                   | External ID authority URL                 | MSAL authority used for login.                                                                                        |
| `PUBLIC_ENTRA_EXTERNAL_ID_API_SCOPE`  | Admin site     | `api://.../access_as_user`                  | `api://.../access_as_user`                | Scope requested for the admin API access token.                                                                       |
| `PUBLIC_ENTRA_EXTERNAL_ID_ADMIN_ROLE` | Admin site     | `SentinelOptimizer.Admin`                   | `SentinelOptimizer.Admin`                 | UI hint only; the API remains the authorization boundary.                                                             |
| `PUBLIC_ADMIN_API_BASE`               | Admin site     | `https://...azurewebsites.net`              | `https://...azurewebsites.net`            | Admin API origin used by the management console.                                                                      |

### Environment secrets

Create these as **GitHub Environment secrets**. Do not commit them, place them
in `PUBLIC_*` variables, or print them in workflow logs.

| Secret                            | Required by                   | Recommended value/source                                  | Purpose and guidance                                                                                                       |
| --------------------------------- | ----------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `AZURE_CLIENT_ID`                 | Infrastructure workflow       | Infrastructure OIDC application client ID                 | Short-lived GitHub OIDC sign-in for Bicep deployment. No client secret is required.                                        |
| `AZURE_API_CLIENT_ID`             | API workflow                  | API deployment OIDC application client ID                 | Separate least-privilege identity for publishing the Functions zip package.                                                |
| `AZURE_TENANT_ID`                 | Azure workflows               | Microsoft Entra tenant ID                                 | Tenant containing the OIDC applications. This identifier is not a password, but keep environment configuration consistent. |
| `AZURE_SUBSCRIPTION_ID`           | Azure workflows               | Target Azure subscription ID                              | Select the subscription that owns the environment resource group.                                                          |
| `AZURE_API_PRINCIPAL_OBJECT_ID`   | Infrastructure API deployment | Object ID of the API deployment service principal         | Used by Bicep to grant Website Contributor only on the Function App.                                                       |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Static site deployment        | Retrieve from the Static Web App deployment-token command | Long-lived site deployment token. Store only in the selected GitHub Environment and rotate if exposed.                     |

### Built-in GitHub token

`GITHUB_TOKEN` is automatically created by GitHub Actions and is used for
Static Web Apps pull-request integration. Do not create or copy it manually.

### Infrastructure workflow inputs

The **Validate and Deploy Azure Infrastructure** workflow also has manual
inputs. These are not stored as Environment variables or secrets:

| Input                        | Recommended default | Applies to | Guidance                                                           |
| ---------------------------- | ------------------- | ---------- | ------------------------------------------------------------------ |
| `environment`                | `development`       | All stacks | Select `production` only with environment approvals.               |
| `component`                  | `site`              | All stacks | Deploy in order: `site`, `api`, then optional `ai`.                |
| `operation`                  | `what-if`           | All stacks | Review the preview before selecting `deploy`.                      |
| `site-sku`                   | `Free`              | Site       | Use `Standard` only when its features or SLA are required.         |
| `function-memory-mb`         | `512`               | API        | Increase only after measured memory or latency pressure.           |
| `storage-sku`                | `Standard_LRS`      | API        | Choose ZRS/GRS variants only for a defined resilience requirement. |
| `always-ready-instances`     | `0`                 | API        | Keeps scale-to-zero and avoids baseline instance cost.             |
| `function-maximum-instances` | `40`                | API        | Increase only after load testing and cost review.                  |
| `openai-deployment-sku`      | `GlobalStandard`    | AI         | Azure OpenAI is separately billed and has quota requirements.      |
| `openai-model-capacity`      | `1`                 | AI         | Increase only when measured throughput requires it.                |

Use `what-if` before applying infrastructure changes and require reviewers for `deployment-production`. Do not deploy from pull requests. Keep runtime secrets in Azure Key Vault or managed identity-backed services. The public frontend must never contain a client secret.

## Security

This is a planning and estimation tool, not a security boundary. Review inputs and outputs before relying on them. Keep public API routes disabled unless authentication, rate limiting, CORS restrictions, abuse monitoring, quotas, and cost controls are configured. Do not enable AI routes without provider budgets and alerts.

Report suspected vulnerabilities privately through the repository owner’s configured security process. Do not publish secrets, customer data, or exploit details in an issue.

## License

MIT. See [LICENSE](LICENSE).

[Microsoft Sentinel documentation](https://learn.microsoft.com/azure/sentinel/) · [Azure Functions documentation](https://learn.microsoft.com/azure/azure-functions/) · [Azure Static Web Apps documentation](https://learn.microsoft.com/azure/static-web-apps/)
