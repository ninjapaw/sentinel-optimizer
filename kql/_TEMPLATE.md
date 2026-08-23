---
id: replace-with-filename
title: "Customer-facing query title"
status: estimate
lastReviewed: "YYYY-MM-DD"
summary: >-
  State what the query measures, the unit returned, and the intended scope.
tags:
  - microsoft-sentinel
docs:
  - label: "Official Microsoft source"
    url: "https://learn.microsoft.com/"
---

> **Important: unofficial community guidance.** This independent Ninja Paws
> project is not affiliated with, sponsored by, endorsed by, or supported by
> Microsoft Corporation. This query is a best-effort estimate based on public
> documentation, not billing or licensing advice. Verify current Microsoft
> documentation and your own data before relying on the result. Use at your
> own risk. Microsoft trademarks and product names belong to Microsoft
> Corporation.

## Overview

Explain the customer question and what this report can and cannot establish.

## Prerequisites

- List required data, scope, permissions, and manual inputs.

## How to use it

1. Select the authorized scope.
2. Set required parameters.
3. Run the query and review the documented result fields.

## Query

```kql
let lookback = 7d;
// Filter early, aggregate server-side, and return only required columns.
Usage
| where TimeGenerated > ago(lookback)
| take 10
```

## How the query works

Describe each material filter, calculation, unit conversion, and assumption.

## Result fields

| Field | Meaning |
| --- | --- |
| `Example` | Define the unit and how the value should be used. |

## Known limits

- Identify data latency, RBAC, scope, licensing, and approximation limits.

## Sources

- [Official Microsoft source](https://learn.microsoft.com/)
