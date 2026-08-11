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

## Repository layout

| Path | Purpose |
| --- | --- |
| `parsers/`, `schema/` | Pure vendor parsing and normalized contracts |
| `estimators/` | Data-volume estimation |
| `pricing/` | Sentinel pricing model |
| `shared/` | Browser-safe shared configuration, contracts, and utilities |
| `api/` | Provider-neutral Node/Azure Functions API |
| `web/` | Astro and React static frontend |
| `infra/azure/` | Bicep stacks and zip-deployment support |
| `test/` | Engine tests |

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

Public defaults belong in `shared/config/user.config.ts`. Never place API keys,
tokens, connection strings, customer exports, tenant secrets, or deployment
credentials in source code, browser-exposed `PUBLIC_*` values, or committed
configuration files.

## Azure deployment

The lowest-cost topology is:

1. Azure Static Web Apps Free for the frontend.
2. Azure Functions Flex Consumption for the optional API, deployed as a zip package.
3. Azure OpenAI only when a required feature justifies its separate usage cost.

The repository uses Bicep. It does not require Docker for the Azure Functions deployment. The API Dockerfile remains available for local/container scenarios.

Azure deployment values belong in protected GitHub Environments, not this public repository. Create:

- `azure-development`
- `azure-production`

Use `infra/azure/bootstrap.sh --environment development` to seed one environment, then repeat for production. The bootstrap creates short-lived GitHub OIDC federation and scoped role assignments; it does not create a client secret.

### Environment variables

Create these as **GitHub Environment variables** in both environments. Use
separate names and URLs for development and production.

| Variable | Required | Development example | Production example | Purpose and guidance |
| --- | --- | --- | --- | --- |
| `AZURE_ENVIRONMENT` | Yes | `development` | `production` | Environment tag applied by Bicep. |
| `AZURE_LOCATION` | Yes | `centralus` | `centralus` | Azure deployment region. Confirm service availability and quota first. |
| `AZURE_RESOURCE_GROUP` | Yes | `sentinel-optimizer-development` | `sentinel-optimizer-production` | Resource group owned by this environment. |
| `AZURE_STATIC_WEB_APP_NAME` | Yes | `sentinel-optimizer-development-site` | `sentinel-optimizer-production-site` | Globally unique Static Web Apps resource name. |
| `AZURE_FUNCTIONAPP_NAME` | Yes | `sentinel-optimizer-development-api` | `sentinel-optimizer-production-api` | Globally unique Azure Functions app name. |
| `AZURE_PUBLIC_SITE_URL` | Yes | Generated dev URL or dev custom domain | Production custom domain or generated URL | Canonical site URL embedded into the static build. Must use `https://`. |
| `AZURE_DEPLOY_API` | Yes | `false` initially; `true` when API is ready | `true` only when approved | Enables API code deployment. Keep `false` for a static-only deployment. |
| `AZURE_USE_API` | Yes | `false` until health check passes | `true` after API validation | Makes the frontend call the separate Functions API. Requires `AZURE_DEPLOY_API=true`. |
| `AZURE_ENABLE_ANONYMOUS_AI_ROUTES` | Yes | `false` | `false` | Controls paid anonymous AI routes. Keep `false` unless authentication, rate limits, quotas, and budgets are in place. |
| `AZURE_OPENAI_ACCOUNT_NAME` | Yes for AI IaC | `sentinel-optimizer-development-openai` | `sentinel-optimizer-production-openai` | Azure OpenAI account name. Do not deploy the AI stack unless needed. |
| `AZURE_OPENAI_MODEL_NAME` | Yes for AI IaC | `gpt-4.1-mini` | Approved supported model | Model identifier used by the optional AI stack. Check regional quota. |
| `AZURE_OPENAI_MODEL_DEPLOYMENT` | Yes for AI IaC | `sentinel-optimizer-model` | `sentinel-optimizer-model` | Deployment name written to the Function App settings. |
| `ENTRA_EXTERNAL_ID_ISSUER` | Admin API | External ID issuer URL | External ID issuer URL | Exact JWT issuer accepted by the admin API. |
| `ENTRA_EXTERNAL_ID_JWKS_URI` | Admin API | External ID JWKS URL | External ID JWKS URL | Signing-key endpoint used for token validation. |
| `ENTRA_EXTERNAL_ID_AUDIENCE` | Admin API | API application/client ID | API application/client ID | Expected access-token audience. |
| `ENTRA_EXTERNAL_ID_ADMIN_ROLE` | Admin API | `SentinelOptimizer.Admin` | `SentinelOptimizer.Admin` | Required app-role claim. |
| `PUBLIC_ENTRA_EXTERNAL_ID_CLIENT_ID` | Admin site | SPA application/client ID | SPA application/client ID | Public SPA identifier; never a client secret. |
| `PUBLIC_ENTRA_EXTERNAL_ID_AUTHORITY` | Admin site | External ID authority URL | External ID authority URL | MSAL authority used for login. |
| `PUBLIC_ENTRA_EXTERNAL_ID_API_SCOPE` | Admin site | `api://.../access_as_user` | `api://.../access_as_user` | Scope requested for the admin API access token. |
| `PUBLIC_ENTRA_EXTERNAL_ID_ADMIN_ROLE` | Admin site | `SentinelOptimizer.Admin` | `SentinelOptimizer.Admin` | UI hint only; the API remains the authorization boundary. |
| `PUBLIC_ADMIN_API_BASE` | Admin site | `https://...azurewebsites.net` | `https://...azurewebsites.net` | Admin API origin used by the management console. |

### Environment secrets

Create these as **GitHub Environment secrets**. Do not commit them, place them
in `PUBLIC_*` variables, or print them in workflow logs.

| Secret | Required by | Recommended value/source | Purpose and guidance |
| --- | --- | --- | --- |
| `AZURE_CLIENT_ID` | Infrastructure workflow | Infrastructure OIDC application client ID | Short-lived GitHub OIDC sign-in for Bicep deployment. No client secret is required. |
| `AZURE_API_CLIENT_ID` | API workflow | API deployment OIDC application client ID | Separate least-privilege identity for publishing the Functions zip package. |
| `AZURE_TENANT_ID` | Azure workflows | Microsoft Entra tenant ID | Tenant containing the OIDC applications. This identifier is not a password, but keep environment configuration consistent. |
| `AZURE_SUBSCRIPTION_ID` | Azure workflows | Target Azure subscription ID | Select the subscription that owns the environment resource group. |
| `AZURE_API_PRINCIPAL_OBJECT_ID` | Infrastructure API deployment | Object ID of the API deployment service principal | Used by Bicep to grant Website Contributor only on the Function App. |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Static site deployment | Retrieve from the Static Web App deployment-token command | Long-lived site deployment token. Store only in the selected GitHub Environment and rotate if exposed. |

### Built-in GitHub token

`GITHUB_TOKEN` is automatically created by GitHub Actions and is used for
Static Web Apps pull-request integration. Do not create or copy it manually.

### Infrastructure workflow inputs

The **Validate and Deploy Azure Infrastructure** workflow also has manual
inputs. These are not stored as Environment variables or secrets:

| Input | Recommended default | Applies to | Guidance |
| --- | --- | --- | --- |
| `environment` | `development` | All stacks | Select `production` only with environment approvals. |
| `component` | `site` | All stacks | Deploy in order: `site`, `api`, then optional `ai`. |
| `operation` | `what-if` | All stacks | Review the preview before selecting `deploy`. |
| `site-sku` | `Free` | Site | Use `Standard` only when its features or SLA are required. |
| `function-memory-mb` | `512` | API | Increase only after measured memory or latency pressure. |
| `storage-sku` | `Standard_LRS` | API | Choose ZRS/GRS variants only for a defined resilience requirement. |
| `always-ready-instances` | `0` | API | Keeps scale-to-zero and avoids baseline instance cost. |
| `function-maximum-instances` | `40` | API | Increase only after load testing and cost review. |
| `openai-deployment-sku` | `GlobalStandard` | AI | Azure OpenAI is separately billed and has quota requirements. |
| `openai-model-capacity` | `1` | AI | Increase only when measured throughput requires it. |

Use `what-if` before applying infrastructure changes and require reviewers for `azure-production`. Do not deploy from pull requests. Keep runtime secrets in Azure Key Vault or managed identity-backed services. The public frontend must never contain a client secret.

## Security

This is a planning and estimation tool, not a security boundary. Review inputs and outputs before relying on them. Keep public API routes disabled unless authentication, rate limiting, CORS restrictions, abuse monitoring, quotas, and cost controls are configured. Do not enable AI routes without provider budgets and alerts.

Report suspected vulnerabilities privately through the repository owner’s configured security process. Do not publish secrets, customer data, or exploit details in an issue.

## License

MIT. See [LICENSE](LICENSE).

[Microsoft Sentinel documentation](https://learn.microsoft.com/azure/sentinel/) · [Azure Functions documentation](https://learn.microsoft.com/azure/azure-functions/) · [Azure Static Web Apps documentation](https://learn.microsoft.com/azure/static-web-apps/)
