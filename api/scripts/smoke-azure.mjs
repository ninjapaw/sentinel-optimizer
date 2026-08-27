/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { readdir } from "node:fs/promises";

const source = new URL("../src/adapters/azure/functions/", import.meta.url);
const compiled = new URL("../dist/api/src/adapters/azure/functions/", import.meta.url);

const expected = (await readdir(source, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (expected.length === 0) {
  throw new Error("No Azure function directories found under src/adapters/azure/functions.");
}

const actual = (await readdir(compiled, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const missing = expected.filter((name) => !actual.includes(name));
if (missing.length > 0) {
  throw new Error(`Missing compiled Azure functions: ${missing.join(", ")}.`);
}

await Promise.all(expected.map((name) => import(new URL(`${name}/index.js`, compiled).href)));
console.log(`Loaded ${expected.length} Azure function entry points: ${expected.join(", ")}.`);
