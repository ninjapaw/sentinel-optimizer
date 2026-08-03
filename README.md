# sentinel-optimizer

SentinelOptimizer is a client-side analysis tool that helps organizations migrate to
Microsoft Sentinel and optimize their data ingestion strategy. It evaluates log
sources, tables, and event volumes to identify cost-saving opportunities, reduce
noise, and streamline onboarding. Deterministic analysis stays in your browser;
optional AI uses the bounded data contract described below.

> Parsing, estimation, and deterministic recommendations run locally. Optional
> AI features send only an aggregated summary or app-owned example template to
> the separately configured API; raw exports and credentials are never sent.

## Positioning copy

- Enterprise-focused:
  SentinelOptimizer accelerates your move to Microsoft Sentinel by providing a secure,
  client-side assessment of your existing SIEM data. It maps ingestion patterns,
  highlights unnecessary or high-cost data streams, and delivers actionable
  recommendations to reduce spend and improve operational efficiency — all without
  transmitting customer data.

- Migration-focused:
  SentinelOptimizer simplifies the transition to Microsoft Sentinel by analyzing your
  current SIEM logs and identifying the optimal ingestion approach. It highlights
  redundant, noisy, or high-cost data sources and provides guidance for structuring
  your Sentinel workspace for performance and cost efficiency. All processing happens
  locally in your browser.

- Cost-optimization-focused:
  SentinelOptimizer helps organizations cut Microsoft Sentinel costs by analyzing log
  ingestion patterns and identifying waste, duplication, and unnecessary data. It
  provides clear recommendations for tuning data connectors, table usage, and
  retention settings — with all analysis performed securely on the client side.

- Short description:
  A privacy-preserving tool that helps you migrate to Microsoft Sentinel and optimize
  your log ingestion for cost, clarity, and performance.

## Trust model

- **No credentials.** Never asks for tokens, keys, or secrets.
- **Local analysis.** Parsing and cost calculations are pure and deterministic;
  raw exports are not transmitted.
- **Optional AI boundary.** AI requests contain only bounded aggregate fields
  or app-owned example templates and can be disabled entirely.
- **You run the queries.** Paste exported JSON from your own SIEM; the engine
  never connects to it.

## Supported vendors

Parsers implemented: **Sentinel**, **Splunk**, **Elastic**. The normalized
schema is vendor-agnostic and designed to extend to additional SIEMs.

## Project layout

| Path | Purpose |
| ---- | ------- |
| `schema/normalization.ts` | Canonical normalized schema + pure helpers |
| `parsers/<vendor>.ts` | Vendor-specific parsers (pure, deterministic) |
| `parsers/index.ts` | Parser registry |
| `estimators/dataVolumeEstimator.ts` | Inventory-based GB/day estimator + source catalog |
| `estimators/index.ts` | Estimator registry |
| `pricing/sentinelPricing.ts` | Sentinel monthly cost model + public rate card |
| `pricing/index.ts` | Pricing registry |
| `shared/config/user.config.ts` | Supported public project customization |
| `shared/config/internal.config.ts` | Protocol and compatibility invariants; not a customization surface |
| `shared/utils/` | Pure helpers shared across runtime boundaries |
| `api/` | Independently deployable, provider-neutral optional AI API |
| `web/` | Static Astro and React frontend |
| `samples/<vendor>.json` | Sample query/export output used by tests |
| `test/` | Unit tests (Vitest) |

## Documentation

- [Web application and static hosting](web/README.md)
- [Portable API, providers, and deployment](api/README.md)
- [Shared configuration and utility contract](shared/README.md)
- [Security policy and vulnerability reporting](SECURITY.md)

## Normalized schema

Every parser returns the same shape:

```ts
{
  vendor: string,
  sources: [
    { name: string, events?: number, bytes?: number, gbPerDay?: number, storage?: string }
  ],
  connectors?: [...],
  dcrs?: [...],
  totals?: { gbPerDay?: number, events?: number, bytes?: number }
}
```

## Usage

```ts
import { parseSentinel } from "./parsers/index.js";

// `usage` is the JSON output of a KQL Usage query you ran in your tenant.
const result = parseSentinel({ usage, windowDays: 30 });
console.log(result.totals?.gbPerDay);
```

### Example: Microsoft Sentinel (KQL)

Run this in Log Analytics, then paste the JSON result:

```kql
Usage
| where TimeGenerated > ago(30d)
| summarize QuantityMB = sum(Quantity) by DataType
```

`Quantity` in the `Usage` table is reported in MBytes, and is commonly
converted to GB by dividing by 1000 in Microsoft examples.

### Example: Splunk (SPL)

```spl
index=_internal source=*license_usage.log type=Usage
| stats sum(b) as bytes by idx
```

### Example: Elasticsearch

```http
GET _cat/indices?format=json&bytes=b
```

## Data Volume Estimator

When no logs are available yet, estimate Sentinel ingestion volume from an
infrastructure inventory — node/endpoint/user counts per data-source type. No
logs, credentials, or live environment are touched; it is a pure calculation.

```ts
import { estimateDataVolume } from "./estimators/index.js";

const result = estimateDataVolume({
  rows: [
    { name: "Windows Servers w/ medium EPS", count: 200 },
    { name: "Network Firewalls (DMZ)", count: 4 },
  ],
});
console.log(result.totals?.gbPerDay);
```

Each source type carries a default average event size and events-per-second
(see `DATA_SOURCE_CATALOG`), both overridable per row. Volume is computed with:

```text
GB/day = (avgEventSizeBytes × (count × avgEpsPerNode) × 86400) / 1024³
```

The estimator output uses the same normalized schema as the vendor parsers, so
it feeds directly into cost modeling and optimization.

## Cost model

Turn normalized ingestion volume into an estimated monthly Sentinel cost. Rates
default to Microsoft Sentinel's public, per-GB list pricing (USD) and are fully
overridable for region, currency, or negotiated tiers.

```ts
import { estimateMonthlyCost } from "./pricing/index.js";

const cost = estimateMonthlyCost({
  analyticsGbPerDay: 500,
  dataLakeGbPerDay: 2000,
  searchTbPerMonth: 500,
  benefits: { m365E5FreeGbPerDay: 50, defenderP2FreeGbPerDay: 30 },
});
console.log(cost.monthlyCost, cost.breakdown);
```

The model covers Analytics and Data Lake ingestion, interactive retention (with
the free window), long-term storage, data search, SOAR, Security Copilot, and
Sentinel for SAP. It also accounts for free-ingestion benefits (Microsoft 365
E5, Defender for Servers P2, always-free sources) and an optional weekend
ingestion-optimization discount. Pass a `NormalizedResult` directly with
`estimateMonthlyCostFromResult(result, options)`.

For data lake storage, the default model applies a 6:1 raw-to-billable
compression ratio, which aligns with current Microsoft Sentinel data lake
documentation.

All rates live in `DEFAULT_SENTINEL_RATES`; nothing is hard-coded to a customer
or contract.

Rates and meter semantics can change by region, offer, and date. Validate
production decisions with the Azure pricing calculator and current vendor billing
exports.

## Development

### Project configuration

Edit `shared/config/user.config.ts` for public branding, canonical URLs, local
ports, model defaults, CORS defaults, and bounded API behavior. Do not put API
keys, tokens, connection strings, or other secrets there because shared code is
included in browser and server builds.

Treat `shared/config/internal.config.ts` as application code rather than user
configuration. It centralizes route names, storage identifiers, response
headers, and other compatibility invariants; change it only with the consumers
and tests that implement the same contract. Environment variables take
precedence over shared defaults where a deployment supports an override.

```bash
npm install
npm --prefix api install
npm --prefix web install
npm run typecheck # engine + API + web
npm test          # engine + shared API core
npm run build     # API + static web build
```

For full-stack local development, optionally configure a model and start both
services:

```bash
cp api/.env.example api/.env
npm run dev
```

The standalone API listens on `http://localhost:7071`; Astro listens on
`http://localhost:4321` and proxies `/api/*` to the API. Without model settings,
the application still runs and deterministic recommendations remain available.

Parsers are pure and deterministic, and each vendor has a sample fixture in
`samples/` plus a unit test in `test/`. Portable API behavior is tested under
`api/src/core/`.

## Frontend/backend deployment modes

The frontend and API are separate packages and deployment boundaries:

- Frontend app: `web/`
- Portable API: `api/`

The API has one shared core with adapters for Azure Functions, Cloudflare
Workers, standalone Node.js, and OCI containers. Frontends use same-origin
`/api/*` by default or `PUBLIC_AI_API_BASE` when hosted separately.
Azure deployment uses the Functions adapter and a zip package; Docker is not
part of the Azure site or API workflows.

### Lowest-cost Azure topology

- Host `web/` on **Azure Static Web Apps Free**. It needs no App Service plan,
  server process, or linked backend.
- Leave the optional API undeployed for a static-site-only footprint. Parsing,
  pricing, and deterministic recommendations still work.
- When AI is needed, host `api/` separately on **Azure Functions Flex
  Consumption** in on-demand mode with zero always-ready instances. Set the
  site build variable `PUBLIC_AI_API_BASE` to the Function App origin and add
  the exact site origin to the Function App CORS allowlist.
- Do not link the Function App under Static Web Apps **APIs** unless
  intentionally upgrading the site to Standard. Bring-your-own backend linking
  is not available on the Free plan.

Functions free grants can make light on-demand hosting very low cost, but they
are quotas rather than a zero-cost guarantee. Model inference, storage, logs,
bandwidth overages, custom DNS, and other attached services can incur charges.

Deployment workflows:

- `.github/workflows/deploy-github-pages-site.yml`
- `.github/workflows/deploy-azure-site.yml`
- `.github/workflows/deploy-azure-api.yml`
- `.github/workflows/deploy-cloudflare-api.yml`

See the [API README](api/README.md) for provider settings, local commands,
identity and secret requirements, CORS, container deployment, and instructions
for another adapter. Review the [security policy](SECURITY.md) before exposing
configured AI routes publicly.
