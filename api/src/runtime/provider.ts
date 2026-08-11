/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { AiProvider } from "../core/contracts.js";
import {
  createOpenAiProvider,
  type AiEnvironment,
} from "../providers/openai.js";

export function createConfiguredAiProvider(
  environment: AiEnvironment = process.env,
): AiProvider | undefined {
  return environment.AI_API_ENABLED === "true"
    ? createOpenAiProvider(environment)
    : undefined;
}
