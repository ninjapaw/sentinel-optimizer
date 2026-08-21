/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

export interface ChatTextPart {
  type: "text";
  text: string;
}

export interface ChatImagePart {
  type: "image_url";
  image_url: { url: string };
}

export type ChatContent = string | Array<ChatTextPart | ChatImagePart>;

export interface ChatMessage {
  role: "system" | "user";
  content: ChatContent;
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
