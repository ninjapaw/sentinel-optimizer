# Security policy

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/ninjapaw/sentinel-optimizer/security/advisories/new)
for suspected vulnerabilities. Do not include secrets, customer exports, raw
logs, personal data, or exploit details in a public issue.

Include the affected component, reproduction steps, impact, and any suggested
mitigation. Security reports will be assessed against the current `main` branch.

## Data and credential boundaries

- Parsing, estimation, pricing, and deterministic recommendations run in the
  browser. Raw SIEM exports are not sent by application code.
- Optional AI requests contain bounded aggregate summaries or app-owned example
  templates. Review `web/src/lib/aiClient.ts` and `api/src/core/` when changing
  that contract.
- The browser does not collect or store model credentials. API keys and cloud
  identities belong in the API host's secret manager or managed identity.
- Files under `shared/` are bundled into public browser/server artifacts. Never
  put secrets or customer-specific values there.

## Deployment baseline

- Treat `/api/recommend` and `/api/example` as paid operations. Before exposing
  a configured API publicly, enforce authentication or gateway access control,
  per-client rate limits, request quotas, and provider spending limits. CORS is
  not authentication.
- Keep Azure API deployment opt-in with `AZURE_API_ENABLED`. For minimum Azure
  hosting cost, use Static Web Apps Free plus a separate Flex Consumption
  Function App with zero always-ready instances. A direct cross-origin API URL
  avoids upgrading the site solely to link the backend.
- Restrict cross-origin access to exact production origins. Do not use `*` for
  the paid API routes.
- Keep request-body logging disabled. Log status, latency, throttling, and
  invocation counts without aggregate request contents.
- Use managed/workload identity where supported and scope deployment identities
  to the target resource.
- The Azure Static Web Apps header policy is in
  `web/public/staticwebapp.config.json`. Configure equivalent headers on other
  hosts. Add a host-specific Content Security Policy after including the exact
  `PUBLIC_AI_API_BASE`, font, and asset origins used by that deployment.
- Run `npm run typecheck`, `npm test`, `npm run build`, dependency audits, and
  container scanning before release.

## Public repository hygiene

Example environment files contain placeholders only. Local secret files,
generated output, logs, and provider state are excluded by `.gitignore` and
package-specific ignore files. If a real credential is committed, revoke and
rotate it immediately; deleting it from the latest commit is not sufficient.

## Related documentation

- [Project overview](README.md)
- [API deployment and provider security](api/README.md)
- [Web deployment](web/README.md)
- [Shared configuration contract](shared/README.md)
