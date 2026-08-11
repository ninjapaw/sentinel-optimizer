/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { readdir } from "node:fs/promises";

const directory = new URL("../dist/api/src/adapters/azure/functions/", import.meta.url);
const files = (await readdir(directory)).filter((file) => file.endsWith(".js"));

if (files.length !== 3) {
  throw new Error(`Expected 3 compiled Azure functions, found ${files.length}.`);
}

await Promise.all(files.map((file) => import(new URL(file, directory).href)));
console.log(`Loaded ${files.length} Azure function entry points.`);
