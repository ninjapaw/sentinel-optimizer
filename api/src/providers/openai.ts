/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import OpenAI from "openai";
import type { AiProvider, ChatRequest, ChatResult } from "../core/contracts.js";
import {
  INTERNAL_CONFIG,
  trimTrailingSlashes,
} from "../../../shared/index.js";

export interface AiEnvironment {
  AI_API_ENABLED?: string;
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  AI_TOKEN_PARAMETER?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  AZURE_OPENAI_API_KEY?: string;
  AZURE_OPENAI_DEPLOYMENT?: string;
  AZURE_OPENAI_ENDPOINT?: string;
}

class OpenAiProvider implements AiProvider {
  readonly supportsImages = true;

  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
    private readonly tokenParameter: "max_tokens" | "max_completion_tokens",
  ) {}

  async complete(request: ChatRequest): Promise<ChatResult> {
    const tokenLimit =
      this.tokenParameter === "max_tokens"
        ? { max_tokens: request.maxTokens }
        : { max_completion_tokens: request.maxTokens };
    const completion = await this.client.chat.completions.create({
      model: this.model,
      // Cast: our ChatMessage union is structurally compatible with the SDK's
      // per-role param types (text-only system messages, text-or-image user
      // messages) but isn't discriminated by role the same way the SDK types it.
      messages: request.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      ...tokenLimit,
      ...(request.temperature !== undefined
        ? { temperature: request.temperature }
        : {}),
    });
    const text = completion.choices[0]?.message.content?.trim();
    if (!text) throw new Error("The AI provider returned an empty response.");
    return { text, model: completion.model || this.model };
  }
}

export function createOpenAiProvider(
  environment: AiEnvironment = process.env,
): AiProvider | undefined {
  const azureEndpoint = environment.AZURE_OPENAI_ENDPOINT?.trim();
  const azureDeployment = environment.AZURE_OPENAI_DEPLOYMENT?.trim();
  if (azureEndpoint && azureDeployment) {
    const apiKey =
      environment.AZURE_OPENAI_API_KEY?.trim() ||
      getBearerTokenProvider(
        new DefaultAzureCredential(),
        INTERNAL_CONFIG.api.azureTokenScope,
      );
    return new OpenAiProvider(
      new OpenAI({
        baseURL: `${trimTrailingSlashes(azureEndpoint)}/openai/v1/`,
        apiKey,
        timeout: INTERNAL_CONFIG.api.openai.requestTimeoutMs,
        maxRetries: INTERNAL_CONFIG.api.openai.maxRetries,
      }),
      azureDeployment,
      "max_completion_tokens",
    );
  }

  const apiKey = environment.AI_API_KEY?.trim() || environment.OPENAI_API_KEY?.trim();
  const model = environment.AI_MODEL?.trim() || environment.OPENAI_MODEL?.trim();
  if (!apiKey || !model) return undefined;

  const baseURL = environment.AI_BASE_URL?.trim() || environment.OPENAI_BASE_URL?.trim();
  const tokenParameter =
    environment.AI_TOKEN_PARAMETER === "max_completion_tokens"
      ? "max_completion_tokens"
      : "max_tokens";
  return new OpenAiProvider(
    new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL: trimTrailingSlashes(baseURL) } : {}),
      timeout: INTERNAL_CONFIG.api.openai.requestTimeoutMs,
      maxRetries: INTERNAL_CONFIG.api.openai.maxRetries,
    }),
    model,
    tokenParameter,
  );
}
