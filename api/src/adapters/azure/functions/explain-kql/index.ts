/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { HttpHandler } from "@azure/functions";
import { EXPLAIN_KQL_MAX_BODY_BYTES } from "../../../../core/explainKql.js";
import { INTERNAL_CONFIG } from "../../../../../../shared/index.js";
import { createAzureHandler } from "../../http.js";

const handler = createAzureHandler(
  INTERNAL_CONFIG.api.routes.explainKql,
  EXPLAIN_KQL_MAX_BODY_BYTES,
);

export const explainKql: HttpHandler = handler;

export default explainKql;
