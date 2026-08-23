# KQL query library

Canonical source of truth for the KQL (and supporting PowerShell) queries used
throughout Sentinel Optimizer — the "Copy query" buttons in the web app's cost
controls are generated from these files at build time (see
[`web/src/lib/kqlLibrary.ts`](../web/src/lib/kqlLibrary.ts)), so the query text
customers copy always matches what's documented here.

Each file is a self-contained reference: the exact query, why it's shaped the
way it is, and links to the official Microsoft docs it's derived from. Update
the query here first, then the web app picks it up automatically on next
build — there's no separate copy to keep in sync.

## Queries

| File | What it sizes |
| --- | --- |
| [defender-for-servers-p2-ingestion-benefit.md](./defender-for-servers-p2-ingestion-benefit.md) | Defender for Servers Plan 2 free ingestion benefit (500 MB/node/day, pooled per subscription) |
| [microsoft-365-e5-sentinel-benefit.md](./microsoft-365-e5-sentinel-benefit.md) | Microsoft Sentinel benefit for Microsoft 365 E5/A5/F5/G5 customers (up to 5 MB/user/day), plus the Graph PowerShell license-count helper |
| [always-free-sentinel-data-sources.md](./always-free-sentinel-data-sources.md) | Data sources Microsoft never bills for, regardless of plan |

## Standard report template

Start new reports from [`_TEMPLATE.md`](./_TEMPLATE.md). Every published query
document must include:

- Frontmatter: `id`, `title`, `status`, `lastReviewed`, `summary`, `tags`, and
  at least one official Microsoft source under `docs`.
- The standard unofficial-community disclaimer immediately after frontmatter.
- `Overview`, `Prerequisites`, `How to use it`, `Query`, `How the query works`,
  `Result fields`, `Known limits`, and `Sources` sections. Rich reports can add
  sections and can place limits next to the relevant evidence.
- A primary fenced `kql` block. Supplemental PowerShell or other supporting
  code can follow it.

The web loader extracts the first supported fenced block as the copyable query
and surfaces frontmatter `docs` links in the UI. Run `npm run validate:kql` to
check the contract; it is also part of `npm test`.

## Review rules

- Filter by time before aggregation and keep the lookback explicit.
- For calendar-day averages, divide the period total by the full lookback;
  do not average only bins that happened to contain rows.
- Never infer licensing, entitlement, protection state, or a free allowance
  from missing input. Return zero or require the user to provide the value.
- Keep calculations deterministic. AI can explain a result but must not alter
  query output, eligibility, or report totals.
- Record material assumptions and scope/RBAC/data-latency limits, and update
  `lastReviewed` whenever official sources or query behavior are rechecked.
