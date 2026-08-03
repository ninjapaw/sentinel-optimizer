# Shared project code

This folder contains browser-safe TypeScript used by the engine, API, and web
packages.

- `config/user.config.ts` is the supported customization surface. It contains
  public branding, URLs, local ports, model defaults, and API limits. Never put
  secrets in it.
- `config/internal.config.ts` contains protocol and compatibility invariants.
  Treat it as application code; changes require coordinated migrations and
  tests.
- `utils/` contains pure, runtime-neutral helpers. Do not add Node.js, DOM, or
  cloud-provider dependencies to shared modules. Privacy helpers redact source
  identifiers before optional AI requests.

Environment variables and deployment secrets override operational values at
runtime where documented. Domain data such as pricing rates and estimator
catalog entries remains in its owning module rather than becoming global
configuration.

## Related documentation

- [Project overview](../README.md)
- [API package](../api/README.md)
- [Web application](../web/README.md)
- [Security policy](../SECURITY.md)
