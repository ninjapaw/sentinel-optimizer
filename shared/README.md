# Shared project code

This folder contains browser-safe TypeScript used by the engine, API, and web
packages.

- `config/user.config.ts` is the supported customization surface. It contains
  public branding, URLs, local ports, model defaults, and API limits. Never put
  secrets in it.
- `config/internal.config.ts` contains protocol and compatibility invariants.
  Treat it as application code; changes require coordinated migrations and
  tests.
- `contracts/` contains browser-safe API wire types and runtime guards used by
  both clients and handlers. Keep transport/runtime implementations in `api/`.
- `utils/` contains pure, runtime-neutral helpers. Do not add Node.js, DOM, or
  cloud-provider dependencies to shared modules. Privacy helpers redact source
  identifiers before optional AI requests.

Environment variables and deployment secrets override operational values at
runtime where documented. Domain data such as pricing rates and estimator
catalog entries remains in its owning module rather than becoming global
configuration.

Azure resource names, subscriptions, tenant IDs, regions, SKU capacity, and
GitHub deployment settings are not shared application configuration. Keep
those values in `infra/azure/*.bicepparam`, GitHub environment variables, or
Azure app settings as documented in `infra/azure/README.md`. Never add Azure
credentials, deployment tokens, model keys, connection strings, or private
endpoints under `shared/`; shared modules are included in public browser builds.

## Related documentation

- [Project overview](../README.md)
- [API package](../api/README.md)
- [Web application](../web/README.md)
- [Azure infrastructure](../infra/azure/README.md)
- [Security policy](../SECURITY.md)
