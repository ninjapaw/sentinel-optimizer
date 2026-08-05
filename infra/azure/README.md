# Azure infrastructure

These independent Bicep stacks provision the Azure resources used by Sentinel
Optimizer. They do not deploy application code or create GitHub credentials.
The checked-in `azuredeploy.json` files are compiled from `main.bicep` because
the Azure Portal **Deploy to Azure** flow accepts ARM JSON templates, not Bicep
source URLs.

## IaC and repository recommendation

Use Bicep for this project. It is Azure-native, supports Functions Flex
Consumption directly, requires no remote state backend, and is already compiled
into ARM JSON for portal deployment. Terraform would be reasonable for a
multi-cloud platform team with an existing state, policy, and module ecosystem;
adding it here would introduce state management without improving these
Azure-only deployments.

Keep infrastructure in this repository. Application contracts, configuration,
workflows, and resource settings change together, while the separate `site/`,
`api/`, and `ai/` stacks already allow independent deployment. Split into an
infrastructure repository only when a separate platform team owns Azure access,
deployments require a different approval/audit boundary, or these modules serve
multiple applications.

Do not put deployment values or secrets in `shared/config`. That code is
browser-safe and can be published in frontend bundles. Public application
defaults belong in `shared/config/user.config.ts`; public Azure deployment
values belong in `infra/azure/config.json`; credentials belong only in GitHub
secrets or Azure-managed identities.

### Shared deployment configuration

Edit `infra/azure/config.json` once for this repository. It is the source of
truth for the resource group, resource names, public site URL, API deployment
flag, and Azure OpenAI model/deployment names. Its schema provides editor
validation, and CI validates it with `infra/azure/export-config.jq`.

This file is public. Do not add tenant IDs, subscription IDs, client IDs,
tokens, keys, connection strings, or customer data. Keep organization-wide
`AZURE_LOCATION` as the sole GitHub variable. Keep OIDC identifiers in the
protected GitHub environment secrets described below.

Sizing remains in the manual workflow form so each `what-if` or deployment has
an explicit, reviewable choice. The cheapest options are preselected. Portal
and CLI deployments continue to use the component `.bicepparam` files because
external Azure Portal deployments cannot read repository workflow config.

## Deployment order

1. Run `infra/azure/bootstrap.sh` once from authenticated Azure and GitHub CLIs.
2. Deploy `site/` for an Azure Static Web Apps Free site.
3. Deploy `api/` for an Azure Functions Flex Consumption API if optional AI is
   required. The workflow reads the deployed site hostname for CORS.
4. Deploy `ai/` only when Azure OpenAI-backed features are required. The
   Function App from step 3 must be in the same resource group.
5. Set `deployApi` to `true` and manually run **Deploy Azure API**. After its
   health endpoint succeeds, set `useApi` to `true` to build the site against it.

Deploying the static site alone is the lowest-cost option. Deterministic parsing,
estimation, and recommendations do not require the API or Azure OpenAI.

## Sizing and cost defaults

Every configurable SKU uses Bicep `@allowed` values, so **Deploy to Azure**
shows a dropdown in the portal. The GitHub infrastructure workflow provides the
same choices, while numeric scale and capacity values use number fields. CLI
deployments can set the equivalent parameters in a `.bicepparam` file.

The checked-in defaults minimize idle and baseline cost. Azure prices and free
grants vary by agreement and region, so confirm current estimates in the
[Azure pricing calculator](https://azure.microsoft.com/pricing/calculator/)
before production deployment.

| Resource or control | Cheapest recommended default | Other recommended choices | Choose a higher option when |
| --- | --- | --- | --- |
| Static Web Apps plan | `Free` | `Standard` | You need a production SLA, Standard-only networking/authentication features, or higher service limits. See [Static Web Apps plans](https://learn.microsoft.com/azure/static-web-apps/plans). |
| Functions hosting plan | `FC1` Flex Consumption | None in this serverless stack | `FC1` is the required Flex Consumption plan SKU. A Premium or Dedicated architecture is a separate design, justified by sustained traffic, specialized networking, or predictable reserved capacity. |
| Functions instance memory | `512` MB | `2048` MB, `4096` MB | Use 2 GB for general workloads that approach the 512 MB ceiling; use 4 GB for measured memory/CPU pressure. Larger instances cost more while active. See [Flex Consumption memory](https://learn.microsoft.com/azure/azure-functions/flex-consumption-plan). |
| Functions always-ready instances | `0` | Start with `1` | Add one only when measured cold-start latency is unacceptable. Always-ready instances create baseline charges and prevent full scale-to-zero savings. |
| Functions maximum instances | `40` | Increase up to `1000` | Increase only when load tests show throttling at the current burst ceiling. This limit controls concurrency and cost exposure; it does not create idle instances. |
| Functions storage redundancy | `Standard_LRS` | `Standard_ZRS`, `Standard_GRS`, `Standard_GZRS` | Choose ZRS for zone-failure tolerance, GRS for regional disaster recovery, or GZRS for both. Availability varies by region. See [Azure Storage redundancy](https://learn.microsoft.com/azure/storage/common/storage-redundancy). |
| Azure OpenAI account SKU | `S0` | None | `S0` is the account SKU for standard Azure OpenAI usage and is not a free tier. Do not deploy the `ai/` stack when AI summaries are unnecessary. |
| Azure OpenAI deployment type | `GlobalStandard` | `DataZoneStandard`, `Standard` | Keep Global Standard for broad availability and quota. Use Data Zone Standard when processing must remain within the US or EU data zone, or Standard when processing must stay in the deployment region and the model is supported there. See [deployment types](https://learn.microsoft.com/azure/ai-foundry/openai/how-to/deployment-types). |
| Azure OpenAI model capacity | `1` thousand tokens/minute | Increase in measured increments | Increase when API telemetry shows rate-limit responses or sustained throughput near the allocation. Standard deployment capacity controls throughput; token usage remains separately billed. Model-specific minimums and quota availability can require a larger value. |

Start with the defaults, observe memory, latency, throttling, and availability
requirements, and change one control at a time. Run `what-if` before applying a
SKU change. Some plan changes can alter behavior or availability even when the
Bicep deployment is otherwise idempotent.

## Automated infrastructure workflow

`.github/workflows/deploy-azure-infrastructure.yml` performs credential-free
validation on pull requests and pushes. It compiles every Bicep source, verifies
that the checked-in `azuredeploy.json` files have no drift, and compiles every
example parameter file.

Run **Validate and Deploy Azure Infrastructure** manually to execute either a
`what-if` preview or a deployment for one component. `what-if` is the default.
Choose SKU, memory, storage redundancy, warm instances, scale ceiling, and
model capacity in that workflow's form; its cheapest values are preselected.
The deployment job uses the protected `azure-infrastructure` GitHub environment
and OIDC, so it has no client secret. Add required reviewers to that environment
before allowing production deployment.

## One-time OIDC bootstrap

The recommended bootstrap is the idempotent script. A single run:

- validates `infra/azure/config.json` and the active Azure/GitHub sessions;
- creates the resource group with subscription-scope Bicep when absent;
- registers the Web, Storage, and Cognitive Services resource providers;
- creates or reuses separate infrastructure and API Entra applications and
   service principals;
- creates GitHub environment OIDC credentials restricted to the `main` branch;
- grants the infrastructure principal **Contributor** and **Role Based Access
   Control Administrator** only on the configured resource group;
- creates the `azure-infrastructure` and `azure-api` GitHub environments;
- writes OIDC identifiers directly to environment secrets and sets
   `AZURE_LOCATION` for infrastructure deployment;
- on reruns after the site exists, sends its deployment token directly to the
   repository secret without printing it.

It does not create a client secret and does not write credentials to disk or
tracked files. The caller needs permission to create Entra applications,
register providers, create the resource group, assign roles, and administer the
repository's Actions environments and secrets.

From the repository root:

```sh
az login
gh auth login
infra/azure/bootstrap.sh --location eastus2
```

The script defaults the repository from `gh repo view`, the subscription from
`az account show`, and location from `AZURE_LOCATION` or `eastus2`. Override
them with `--repository owner/name`, `--subscription id`, or `--location
region`. Rerunning repairs missing role assignments, federated credentials,
environment secrets, and provider registrations. It refuses duplicate Entra
application display names rather than selecting an ambiguous identity.

Add required reviewers to the protected `azure-infrastructure` environment
after bootstrap. GitHub does not allow a script to choose an appropriate human
reviewer safely. The script restricts both OIDC environments to `main`; retain
that policy because an environment-scoped federated credential trusts workflow
code allowed to deploy through that environment.

### Deploy to Azure bootstrap boundary

[![Create Azure resource group](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fninjapaw%2Fsentinel-optimizer%2Fmain%2Finfra%2Fazure%2Fbootstrap%2Fazuredeploy.json)

The button provides the IaC-only fallback: it creates the resource group. It
cannot configure GitHub secrets, and a portal ARM deployment does not have the
Microsoft Graph authorization needed to create the Entra applications used by
this design. Run `bootstrap.sh` afterward; it detects and reuses the resource
group. Using the script alone is simpler because it deploys the same checked-in
bootstrap ARM template automatically.

### GitHub configuration

Configure these as secrets in the `azure-infrastructure` environment:

| Secret | Purpose |
| --- | --- |
| `AZURE_CLIENT_ID` | Client ID of the infrastructure GitHub OIDC application |
| `AZURE_TENANT_ID` | Microsoft Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Target Azure subscription ID |
| `AZURE_API_PRINCIPAL_OBJECT_ID` | API deployment service-principal object ID passed to API Bicep for scoped RBAC |

Configure one organization or environment variable:

| Variable | Required for | Example |
| --- | --- | --- |
| `AZURE_LOCATION` | All stacks | `eastus2` |

The bootstrap script creates these environments, secrets, and the
`AZURE_LOCATION` environment variable. No repository variables are required by
the Azure workflows. The Static Web Apps deployment token is added separately
after that resource exists. Cloudflare and GitHub Pages retain provider-specific
variables.

The infrastructure OIDC application needs **Contributor** and **Role Based
Access Control Administrator** at the resource-group scope. Contributor creates resources;
the RBAC role permits only the role assignments required for the Function App's
managed identities. Do not grant subscription-wide Owner.

The separate API principal receives no resource-group role. API Bicep assigns
it **Website Contributor** only on the Function App, using the object ID placed
in `AZURE_API_PRINCIPAL_OBJECT_ID` by bootstrap.

### Workflow prerequisites and failures

| Workflow | Prerequisites | Explicit failure behavior |
| --- | --- | --- |
| Azure infrastructure | Bootstrap complete; selected component names configured | Reports missing OIDC values/resource group and directs operators to bootstrap; API requires site first; AI requires API first. |
| Azure API code | `deployApi=true`, API infrastructure deployed, `azure-api` OIDC secrets present | Reports placeholder name, missing OIDC bootstrap, or missing Function App before invoking the deployment action. Config changes do not auto-deploy code; run manually after infrastructure. |
| Azure site code | Static Web Apps deployment token; API healthy when `useApi=true` | Reports missing token or failed `/api/health` check before deployment. Keep `useApi=false` until API infrastructure and code are live. |
| Cloudflare API | `CLOUDFLARE_API_ENABLED=true`, account ID and token configured | Reports missing account ID/token before Wrangler. |
| GitHub Pages | `PAGES_DEPLOY_ENABLED=true`; repository Pages enabled with GitHub Actions as source | Deployment is skipped unless explicitly enabled; native Pages actions report invalid Pages configuration. No Azure resources are required. |
| Continuous Integration | None beyond repository checkout/package access | Always runs without cloud credentials or resources. |

## Static website

[![Deploy static website to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fninjapaw%2Fsentinel-optimizer%2Fmain%2Finfra%2Fazure%2Fsite%2Fazuredeploy.json)

This creates one Azure Static Web Apps resource. Keep the default **Free** plan
unless the sizing guidance above identifies a Standard requirement. After
deployment:

1. Rerun `infra/azure/bootstrap.sh` to send the deployment token directly to
   the protected `azure-site` GitHub environment as
   `AZURE_STATIC_WEB_APPS_API_TOKEN` without printing it. Alternatively,
   retrieve it from **Manage deployment token** and add that environment secret
   manually.
2. Set `publicSiteUrl` in `infra/azure/config.json` to the generated URL or
   custom-domain origin.
3. Run the **Deploy Azure Site** workflow.

## Functions API

[![Deploy Functions API to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fninjapaw%2Fsentinel-optimizer%2Fmain%2Finfra%2Fazure%2Fapi%2Fazuredeploy.json)

This creates a Linux Node.js 22 Function App on Flex Consumption, an FC1 plan,
and private deployment/host storage. By default the app uses 512 MB instances,
scales to zero, has no always-ready instances, and uses Standard LRS storage.
It uses its system-assigned identity for storage and stores no storage
connection string. Paid AI routes are disabled by default. Keep
`enableAnonymousAiRoutes=false` unless an external gateway provides
authentication, rate limits, quotas, and spending controls. The deploying
identity needs permission to create role assignments in the resource group.

Bootstrap configures the `azure-api` GitHub environment, OIDC credential, and
secrets before the Function App exists. API Bicep later grants that principal
access only to the created Function App. Set `deployApi` to `true`, manually run
**Deploy Azure API**, verify health, then set `useApi` to `true`. The site
workflow derives the Function App origin from the configured name.

Use a separate OIDC application for `azure-api`, scoped to the Function App
with **Website Contributor**. Its federated subject is
`repo:ninjapaw/sentinel-optimizer:environment:azure-api`. This keeps routine
code deployment unable to modify infrastructure or role assignments.

The values share secret names with the infrastructure identity because GitHub
environments isolate them. Do not copy the infrastructure client ID into the
API environment; the identities deliberately have different privileges.

## Optional Azure OpenAI

[![Deploy Azure OpenAI components](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fninjapaw%2Fsentinel-optimizer%2Fmain%2Finfra%2Fazure%2Fai%2Fazuredeploy.json)

This creates an Azure OpenAI account with local key authentication disabled, a
configurable standard model deployment, and a least-privilege role assignment
for an existing Function App. Global Standard at 1 thousand tokens/minute is
the default. It merges `AZURE_OPENAI_ENDPOINT` and
`AZURE_OPENAI_DEPLOYMENT` into that Function App's settings; no API key is
created or stored by the application.

Model and region availability varies by subscription. Select a supported
region/model combination in the deployment form. Azure OpenAI inference is a
separately billed service, so configure quotas, budgets, and alerts before
enabling the public AI routes.

No Azure OpenAI key, storage key, connection string, or client secret is needed.
The API uses its system-assigned managed identity for Azure OpenAI and host
storage. The Static Web Apps deployment token is the only long-lived deployment
secret: store `AZURE_STATIC_WEB_APPS_API_TOKEN` as an `azure-site` environment
secret, never in a parameter file or shared config, and rotate it if exposed.

After creating the site, send the token directly from Azure CLI to GitHub CLI
without printing it:

```sh
az staticwebapp secrets list \
   --resource-group <resource-group> \
   --name <static-web-app-name> \
   --query properties.apiKey --output tsv \
   | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --env azure-site
```

## Command-line deployment

Copy the relevant `main.bicepparam`, replace its placeholder names, then run:

```sh
az deployment group create \
  --resource-group <resource-group> \
  --template-file infra/azure/site/main.bicep \
  --parameters infra/azure/site/main.bicepparam
```

Use `infra/azure/api` or `infra/azure/ai` in both paths for the other stacks.
Redeployment is idempotent, but the AI stack intentionally updates the named
Function App settings and role assignment.

For local values, copy a sample to a file ending in `.local.bicepparam`; those
files are ignored by Git. Do not add secrets to parameter files even locally.

## Decisions required before first deployment

No additional code decisions are blocking. The Azure operator must choose:

1. Subscription, tenant, resource group, and primary region.
2. Globally unique names for the site, Function App, and Azure OpenAI account.
3. Whether optional AI is enabled at all; if enabled, a model/region combination
   with available quota plus an inference budget and alert threshold.
4. Whether the default 512 MB Functions memory, zero always-ready instances,
   maximum of 40 instances, and LRS storage meet the measured performance and
   resilience requirements.
5. Whether to add a custom domain. DNS and certificates are intentionally not
   provisioned until the domain and DNS owner are known.
6. Which maintainers must approve the protected `azure-infrastructure` GitHub
   environment before a deployment can run.
