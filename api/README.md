# Sentinel Optimizer API

The API is an optional AI enhancement for the Sentinel Optimizer web app. It is
one independently installable package with shared validation, prompts, response
shapes, and tests. Small adapters connect that core to Cloudflare Workers,
Azure Functions, or any service that can run the standalone Node.js server or
container.

Azure Functions is the preferred Azure deployment and uses a direct zip
package; it does not build or run a Docker image. TypeScript is compiled first,
then `dist/`, `host.json`, package metadata, and production dependencies are
deployed directly in the zip. Azure Functions runs those JavaScript files.
Raw TypeScript alone is not a deployable Function App package. The Dockerfile
is retained only for users who intentionally choose an OCI host.

Cost calculations, parsing, and deterministic recommendations remain in the
browser. The API accepts only aggregated figures or app-owned example templates;
it must never receive raw logs, full exports, credentials, or customer secrets.

## Architecture

| Path | Responsibility |
| --- | --- |
| `src/core/` | Portable validation, prompts, routing, and HTTP-neutral results |
| `src/providers/` | Workers AI and OpenAI-compatible model clients |
| `src/adapters/cloudflare/` | Cloudflare Worker `fetch` adapter |
| `src/adapters/azure/` | Azure Functions v4 registrations |
| `src/adapters/node/` | Standalone Node.js HTTP server for local and generic hosts |
| `Dockerfile` | Multi-stage production container for the Node adapter |
| `host.json` | Azure Functions host configuration |
| `wrangler.toml` | Cloudflare Worker configuration |

Every adapter delegates route behavior to the same `routeApiRequest` function.
The small entry adapters remain necessary because Azure registers `app.http`
functions, Cloudflare exposes `fetch` with environment bindings, and Node owns
an HTTP server and request streams. Adding another platform should require only
request and response conversion plus an `AiProvider` implementation when its
model API is not OpenAI-compatible.

## HTTP contract

| Method and path | Purpose |
| --- | --- |
| `POST /api/recommend` | Generate prose from an aggregated cost summary |
| `POST /api/example` | Generate an app-owned sample export |
| `GET /api/health` | Liveness status on every adapter |

Successful generation returns `{ "text": "...", "model": "..." }`. Important
status codes are:

| Status | Meaning |
| --- | --- |
| `400` | Invalid JSON or request shape |
| `404` | Unknown standalone/Worker route |
| `405` | Unsupported method |
| `413` | Body exceeds the endpoint limit |
| `501` | No AI provider is configured; deterministic web features still work |
| `502` | The configured model service failed or returned unusable output |

Responses are non-cacheable and include MIME-sniffing and referrer protections.
Model errors, credentials, and provider configuration state are not returned to
clients. Production builds do not emit source maps.

## Install and verify

From this directory:

```sh
npm install
npm run typecheck
npm test
npm run build
```

The package requires Node.js 22.12 or newer. Commit `package-lock.json` and use
`npm ci` in automation.

## Local development

The easiest full-stack path is from the repository root:

```sh
npm install
npm --prefix api install
npm --prefix web install
cp api/.env.example api/.env
npm run dev
```

`npm run dev` starts the standalone API on port `7071` and Astro on port `4321`.
Astro proxies `/api/*` to the local API, so the browser uses the same-origin
paths it uses in production. Set `LOCAL_API_URL` before starting Astro to proxy
to a different backend. If `.env` has no valid model configuration, health
checks still succeed and AI routes return `501` by design.

Run the services independently when needed:

```sh
npm run dev:api
npm run dev:web
curl http://localhost:7071/api/health
```

Do not commit `.env`, `.dev.vars`, or `local.settings.json`.

Public defaults shared with the web package live in
`../shared/config/user.config.ts`. Environment variables override those values
for each deployment, so keep secrets in the host's secret manager or local
ignored files. `../shared/config/internal.config.ts` contains route and protocol
invariants and should not be used for deployment customization.

## AI providers

### OpenAI-compatible APIs

The standalone Node adapter supports OpenAI and compatible chat-completion
services:

```dotenv
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=replace-me
AI_MODEL=replace-me
AI_TOKEN_PARAMETER=max_tokens
```

`OPENAI_BASE_URL`, `OPENAI_API_KEY`, and `OPENAI_MODEL` are accepted aliases.
Omit `AI_BASE_URL` for the OpenAI default. Set `AI_TOKEN_PARAMETER` to
`max_completion_tokens` only when required by the selected model API.

### Azure OpenAI

Use these settings for Azure OpenAI:

```dotenv
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=YOUR-DEPLOYMENT-NAME
```

The provider uses `DefaultAzureCredential` and the
`https://ai.azure.com/.default` scope when `AZURE_OPENAI_API_KEY` is absent.
Managed identity is recommended in Azure; `az login` supplies the developer
identity locally. `AZURE_OPENAI_API_KEY` exists only for hosts where managed
identity is unavailable and should be stored in that host's secret manager.

### Cloudflare Workers AI

The Worker adapter uses the `AI` binding configured in `wrangler.toml`.
Override `AI_MODEL` when another Workers AI chat model is required.

```sh
cp .dev.vars.example .dev.vars
npm run dev:cloudflare
```

Set `ALLOWED_ORIGINS` to a comma-separated list of exact frontend origins. Do
not use `*` for a production API. CORS controls browser response access; it does
not authenticate callers or prevent direct requests.

## Deploy independently

The web app and API have separate workflows and can be released independently.
Set the web build variable `PUBLIC_AI_API_BASE` to the API origin when they are
hosted separately. Leave it unset when another host provides same-origin
`/api/*` routing, including an intentionally linked Static Web Apps Standard
backend.

### Azure Functions

The repository workflow is `.github/workflows/deploy-azure-api.yml`. It builds,
tests, removes development dependencies, packages the root `api/` Function App,
and deploys the zip through GitHub OIDC and `Azure/functions-action`. It does not
use a container registry, Dockerfile, or custom image. Validation always runs;
deployment occurs only when repository variable `AZURE_API_ENABLED` is `true`.

1. Create a Linux Node.js 22 Azure Function App on **Flex Consumption**.
1. Keep **Always ready instances** at `0` so the app can scale to zero and use
   on-demand free grants. Start with the 512 MB instance size for this small
   HTTP API, then move to 2,048 MB if measured memory use or latency requires it.
1. For a personal, low-traffic deployment, cap maximum instances only after
   load testing. A limit of `1` minimizes burst spend but accepts throttling;
   Azure warns that HTTP limits below `40` can cause failures during bursts.
1. Enable its system-assigned managed identity.
1. Grant that identity **Cognitive Services OpenAI User** on only the Azure
   OpenAI resource.
1. Add `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, and
   `FUNCTIONS_NODE_BLOCK_ON_ENTRY_POINT_ERROR=true` as Function App settings.
1. Create the GitHub environment `azure-api`.
1. Create an Entra federated credential with subject
   `repo:ninjapaw/sentinel-optimizer:environment:azure-api`.
1. Grant its service principal **Website Contributor** at the Function App
   scope.
1. Add GitHub secrets `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and
   `AZURE_SUBSCRIPTION_ID`, plus variable `AZURE_FUNCTIONAPP_NAME`.
1. Add repository variable `AZURE_API_ENABLED=true` only when the API should be
   deployed. Leave it unset or `false` for a site-only setup.
1. Run **Deploy Azure API**.

The checked-in Functions use anonymous HTTP triggers so a separately hosted
static frontend can call them. Do not expose a configured paid API without an authenticating
gateway or platform access control, per-client rate limits, quotas, and provider
budgets. If the API is not used by a public frontend, change the trigger access
model to match the host's authentication mechanism.

For local Functions host testing:

```sh
cp local.settings.json.example local.settings.json
az login
npm run build
npm run start:azure
```

For the lowest-cost topology, do not link this Function App to Static Web Apps.
Keep the site on Free, set its `PUBLIC_AI_API_BASE` build variable to the direct
Function App origin, and add the exact site origin to the Function App's
**API > CORS** allowlist. Linking an existing Function App under **Settings >
APIs** requires Static Web Apps Standard and is an intentional paid upgrade.

Flex Consumption free grants and prices can change and apply at the subscription
scope. Always-ready instances have baseline charges and no free grant. Azure
OpenAI or another model provider is billed separately from Functions hosting,
so set model quotas, budgets, and alerts before enabling public AI traffic.
Review the current Azure Functions
[consumption cost model](https://learn.microsoft.com/azure/azure-functions/functions-consumption-costs)
before deployment; it points to the current pricing and free-grant details.

### Cloudflare Worker

The repository workflow is `.github/workflows/deploy-cloudflare-api.yml`. Its
build job always validates API changes. Deployment is opt-in:

1. Create the GitHub environment `cloudflare-api`.
1. Add environment secret `CLOUDFLARE_API_TOKEN` with Worker edit permission.
1. Add variable `CLOUDFLARE_ACCOUNT_ID`.
1. Set repository variable `CLOUDFLARE_API_ENABLED=true`.
1. Review the Worker name, compatibility date, model, and allowed origins in
   `wrangler.toml`.
1. Run **Deploy Cloudflare API**.

For direct deployment from an authenticated workstation, run
`npm run deploy:cloudflare`.

### Optional non-serverless hosts

Any Node.js host can run:

```sh
npm ci
npm run build
npm prune --omit=dev
PORT=7071 npm start
```

Docker is not needed for local development, CI, Azure Static Web Apps, or Azure
Functions. Use it only when targeting Container Apps, Kubernetes, Cloud Run,
ECS, or another OCI host:

```sh
docker build -f api/Dockerfile -t sentinel-optimizer-api .
docker run --rm -p 7071:7071 --env-file api/.env sentinel-optimizer-api
```

Configure HTTPS, secrets, ingress, scaling, and health checks in the target
platform. The image runs as the non-root `node` user and exposes
`GET /api/health`.

## Add another platform

1. Import `routeApiRequest` or the two endpoint handlers from `src/core/`.
1. Convert the platform request body to a string and pass the method/path.
1. Convert `ApiResult.status` and `ApiResult.body` to the platform response.
1. Reuse `createOpenAiProvider` for OpenAI-compatible services, or implement the
   small `AiProvider.complete` contract in `src/core/contracts.ts`.
1. Apply strict origin controls, body limits, authentication, and rate limits at
   the adapter or gateway.
1. Add adapter-level tests without duplicating core validation tests.

## Production recommendations

- Require authentication for paid AI features or place a gateway in front of
  anonymous routes with per-client quotas and abuse controls.
- Keep model credentials server-side and prefer managed/workload identity.
- Restrict CORS to exact frontend origins when the API is cross-origin.
- Configure model token-per-minute quotas, budgets, and spending alerts.
- Alert on 5xx rate, latency, throttling, and invocation volume without logging
  request bodies.
- Review model content filters, regional processing, and retention requirements.
- Scan all three lockfiles and, when used, container images during dependency
   updates.
- Roll back by redeploying a last-known-good commit or immutable image tag.

The deterministic frontend remains the fallback whenever this optional API is
disabled, unconfigured, rate-limited, or unavailable.

## Related documentation

- [Project overview](../README.md)
- [Web application and static hosting](../web/README.md)
- [Shared configuration contract](../shared/README.md)
- [Security policy](../SECURITY.md)
