# Sentinel Optimizer Web App

Interactive SIEM ingestion and Microsoft Sentinel cost analyzer built with
[Astro](https://astro.build/) and a React island. Astro produces a static site;
all parsing and cost calculations run in the browser, so raw input does not
leave the user's device.

## Architecture

- Framework: Astro 7 with `@astrojs/react` and React 18.
- Rendering: static output; no Astro server adapter is required.
- Build command: `npm run build`.
- Output directory: `web/dist` (`dist` relative to the web app root).
- Runtime: static files on any CDN/static web host.
- Node.js: use Node 22.12 or newer for Astro 7 builds.
- `src/components/Optimizer.tsx` is the interactive island, mounted with
  `client:load`.
- `src/lib/*` contains formatting, examples, recommendations, exports, and the
  optional AI client.
- The `@engine` and `@shared` Vite aliases import source from the repository
  root. A deployment must check out the whole repository even when its app root
  is `web`.

## Local development

```sh
cd web
npm install
npm run dev        # http://localhost:4321
npm run build      # static output in web/dist
npm run typecheck  # astro check
```

To run the web app with the portable local API, install all packages and run
`npm run dev` from the repository root. Astro proxies `/api/*` to port `7071`;
set `LOCAL_API_URL` to override that development target.

## Build-time settings

Edit `../shared/config/user.config.ts` for supported public site identity,
branding, URLs, and local defaults. Do not add secrets: shared configuration is
bundled into the static site. Treat `../shared/config/internal.config.ts` as
application code; it contains storage and protocol compatibility identifiers.
The build-time variables below override shared defaults where applicable.

Astro embeds variables prefixed with `PUBLIC_` in the browser bundle. They are
public configuration, not secrets.

| Variable | Default | When to set it |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | `https://sentineloptimizer.com` | Set to the production origin used for canonical URLs, with no trailing path. |
| `PUBLIC_SITE_BASE` | `/` | Set to a subpath such as `/sentinel-optimizer/` when the host publishes below an origin. |
| `PUBLIC_AI_API_BASE` | Same origin and base path | Set to the absolute URL of a separately hosted compatible API. |

For a host-provided domain, a typical build is:

```sh
PUBLIC_SITE_URL="https://example-host.invalid" \
PUBLIC_SITE_BASE="/" \
npm run build
```

Do not put API keys, deployment tokens, or other credentials in a `PUBLIC_*`
variable. Rebuild after changing any build-time setting.

Model credentials are never accepted or stored by the browser application.
Configure them only on the portable API host using a secret manager or managed
identity.

Pasted and uploaded inputs are limited to 5 MB and are parsed locally. Optional
AI summaries send ranked source shares with placeholder names; original source
names and raw exports remain in the browser.

## Azure Static Web Apps

Use **Azure Static Web Apps**, not Azure App Service, for the current frontend.
It is a static Astro build and does not need a continuously running web server.
The recommended default is the **Free** plan. Under current Azure quotas it
includes global static hosting, managed TLS, two custom domains, three preview
environments, 100 GB monthly bandwidth, and up to 250 MB per app. It has no SLA
or private endpoint. Verify current limits in the Azure
[hosting plans](https://learn.microsoft.com/azure/static-web-apps/plans) and
[quotas](https://learn.microsoft.com/azure/static-web-apps/quotas) documentation.

### Create the resource from the Azure portal

1. In the Azure portal, select **Create a resource**, search for **Static Web
  App**, and select **Create**.
1. Choose the subscription and resource group, enter a globally recognizable
  app name, and select the **Free** plan. Use Standard only when you explicitly
  need its SLA, private endpoint, larger quotas, custom authentication
  registration, or linked bring-your-own backend.
1. Select the region closest to the primary audience. Static assets are
  distributed globally; the region matters most if an API is added later.
1. Under **Deployment details**, select **Other** as the deployment source. The
  repository already contains `.github/workflows/deploy-azure-site.yml`, so this
  avoids Azure creating a duplicate generated workflow.
1. No portal build fields are required for the **Other** source. The checked-in
  workflow builds first and deploys the generated static files with these
  action settings:

  | Azure setting | Value |
  | --- | --- |
  | Build preset | Prebuilt output |
  | App location | `/web/dist` |
  | API location | leave empty |
  | Output location | leave empty |

1. Create the resource. From its **Overview** page, select **Manage deployment
  token** and copy the token.
1. In GitHub, open **Settings > Secrets and variables > Actions** and create:

  | Type | Name | Value |
  | --- | --- | --- |
  | Secret | `AZURE_STATIC_WEB_APPS_API_TOKEN` | The Azure deployment token |
  | Variable | `AZURE_STATIC_WEB_APP_URL` | The generated URL from the Azure resource Overview page |

  The existing workflow deploys the output produced by its preceding build
  step:

```yaml
with:
  app_location: "web/dist"
  api_location: ""
  output_location: ""
  skip_app_build: true
```

1. The `AZURE_STATIC_WEB_APP_URL` repository variable is exposed to the Astro
  build as follows:

```yaml
env:
  PUBLIC_SITE_URL: ${{ vars.AZURE_STATIC_WEB_APP_URL }}
  PUBLIC_SITE_BASE: "/"
```

1. Run **Deploy Azure Site** from the repository's **Actions**
   tab. After it succeeds, open the Static Web App's URL. Add a custom domain
   under **Settings > Custom domains** if needed, then change
   `AZURE_STATIC_WEB_APP_URL` to that origin and rerun the workflow.

### Free site with optional consumption API

Keep the Function App separate to preserve the Static Web Apps Free plan:

1. Deploy the API using the Flex Consumption guidance in the
  [API README](../api/README.md).
1. Set repository variable `PUBLIC_AI_API_BASE` to the Function App origin,
  such as `https://YOUR-APP.azurewebsites.net`.
1. Add the exact Static Web Apps or custom-domain origin to the Function App's
  **API > CORS** allowlist. Do not use `*`.
1. Rerun **Deploy Azure Site** so Astro embeds the API origin.

Do not use **Settings > APIs > Link** for this topology. Linking an existing
Function App is a Static Web Apps Standard feature. The site remains fully
usable at no API hosting or model cost when `PUBLIC_AI_API_BASE` is unset and
the API is not deployed.

Pull requests targeting `main` from the same repository receive Azure preview
environments. Pull requests from forks run the type-check and build but skip
deployment because GitHub does not expose deployment secrets to fork workflows.
For this monorepo, the site workflow includes `web/**`, `shared/**`,
`parsers/**`, `estimators/**`, `pricing/**`, and `schema/**` because the web
build imports root source. Azure Function changes trigger the separate API
workflow.

## Other static hosts

Use the same static Astro build on any provider. Provider labels vary, but the
important values are the app root, build command, output directory, and base
path.

| Provider | Framework/preset | App root | Build command | Publish/output | Base path |
| --- | --- | --- | --- | --- | --- |
| Azure Static Web Apps | Custom | `web` | `npm run build` | `dist` | `/` |
| GitHub Pages | Astro or custom GitHub Action | repository root; run npm commands in `web` | `npm run build` | upload `web/dist` as the Pages artifact | `/sentinel-optimizer/` for a project site |
| Cloudflare Pages | Astro | `web` | `npm run build` | `dist` | `/` |
| Netlify | Astro | `web` | `npm run build` | `dist` | `/` |
| Vercel | Astro | `web` | `npm run build` | `dist` | `/` |
| Generic static host | Custom/static | `web` | `npm run build` | `dist` | host-dependent |

For GitHub Pages project sites, set the origin and repository subpath separately:

```sh
PUBLIC_SITE_URL="https://<owner>.github.io" \
PUBLIC_SITE_BASE="/sentinel-optimizer/" \
npm run build
```

A user/organization Pages site or a custom domain normally uses `/` instead.
Hosts with a configurable root directory should use `web`; do not deploy only a
detached copy of that folder because the build imports code from its parent.

The repository workflow is `.github/workflows/deploy-github-pages-site.yml`. In
GitHub **Settings > Pages**, set **Source** to **GitHub Actions**. Its default
URL and base path are derived from the repository owner and name. For a custom
domain, add these public repository variables under **Settings > Secrets and
variables > Actions > Variables**:

| Variable | Value for a custom domain |
| --- | --- |
| `PUBLIC_SITE_URL` | `https://www.example.com` |
| `PUBLIC_SITE_BASE` | `/` |
| `PUBLIC_AI_API_BASE` | Optional absolute URL of a separately hosted API |

## Optional AI enhancement

The deterministic recommendations always work without a backend. The UI can
also call `/api/recommend` and `/api/example`, sending only aggregated data or
app-owned example templates. A missing or unconfigured API returns a graceful
fallback while the deterministic analysis remains usable.

The independent package in `../api` contains one shared implementation with
adapters for Azure Functions, Cloudflare Workers, standalone Node.js, and OCI
containers. Use `PUBLIC_AI_API_BASE` for a cross-origin deployment. Leave it
unset when the frontend and API share an origin. Azure Static Web Apps can proxy
a linked Function App only on its Standard plan; the Free-plan default is the
separate API origin described above.

For production, keep model credentials server-side, restrict CORS to exact
origins, and protect paid routes with authentication, rate limits, and quotas.
Azure Static Web Apps receives baseline security headers from
`public/staticwebapp.config.json`; configure equivalent headers and a
host-specific Content Security Policy on other providers.

## Related documentation

- [Project overview](../README.md)
- [API setup and provider deployment](../api/README.md)
- [Shared configuration contract](../shared/README.md)
- [Security policy](../SECURITY.md)
