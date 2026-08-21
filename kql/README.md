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

## File format

Each `.md` file has YAML frontmatter (`id`, `title`, `summary`, `tags`,
`docs`) followed by a `## Query` section containing one fenced code block
(` ```kql ` or ` ```powershell `). The loader extracts the first fenced code
block as the copyable query text and surfaces the frontmatter `docs` links in
the UI.
