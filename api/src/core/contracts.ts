/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
}

export interface ChatResult {
  text: string;
  model: string;
}

export interface AiProvider {
  complete(request: ChatRequest): Promise<ChatResult>;
}

export interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}
