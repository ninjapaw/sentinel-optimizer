/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import type { AiProvider, ChatRequest, ChatResult } from "../core/contracts.js";
import { INTERNAL_CONFIG } from "../../../shared/index.js";

export interface WorkersAiBinding {
  run(model: string, input: unknown): Promise<{ response?: string }>;
}

class WorkersAiProvider implements AiProvider {
  constructor(
    private readonly ai: WorkersAiBinding,
    private readonly model: string,
  ) {}

  async complete(request: ChatRequest): Promise<ChatResult> {
    const output = await this.ai.run(this.model, {
      messages: request.messages,
      max_tokens: request.maxTokens,
      ...(request.temperature !== undefined
        ? { temperature: request.temperature }
        : {}),
    });
    const text = output.response?.trim();
    if (!text) throw new Error("Workers AI returned an empty response.");
    return { text, model: this.model };
  }
}

export function createWorkersAiProvider(
  ai: WorkersAiBinding | undefined,
  model: string = INTERNAL_CONFIG.api.cloudflare.model,
): AiProvider | undefined {
  return ai ? new WorkersAiProvider(ai, model) : undefined;
}
