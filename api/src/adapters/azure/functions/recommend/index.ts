/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { HttpHandler } from "@azure/functions";
import { RECOMMEND_MAX_BODY_BYTES } from "../../../../core/recommend.js";
import { INTERNAL_CONFIG } from "../../../../../../shared/index.js";
import { createAzureHandler } from "../../http.js";

const handler = createAzureHandler(
  INTERNAL_CONFIG.api.routes.recommend,
  RECOMMEND_MAX_BODY_BYTES,
);

export const recommend: HttpHandler = handler;

export default recommend;
