/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

export { INTERNAL_CONFIG } from "./config/internal.config.js";
export { USER_CONFIG, type UserConfig } from "./config/user.config.js";
export {
  isAggregatedSummary,
  isAiTextResponse,
  isApiErrorResponse,
  isExampleRequest,
  isExplainKqlRequest,
  type AggregatedSummary,
  type AiTextResponse,
  type ApiErrorResponse,
  type ExampleRequest,
  type ExplainKqlRequest,
  type SummaryStyle,
} from "./contracts/ai.js";
export {
  ensureTrailingSlash,
  parseCommaSeparated,
  parsePort,
  trimTrailingSlashes,
  withoutHash,
} from "./utils/config.js";
export { isFiniteNumber, isRecord } from "./utils/guards.js";
export { apiResponseHeaders } from "./utils/http.js";
export { parseOptionalNumber, roundTo } from "./utils/number.js";
export {
  rankSourcesWithoutNames,
  redactSourceNames,
  type RankedSource,
} from "./utils/privacy.js";
export { utf8ByteLength } from "./utils/text.js";
export {
  type UserSession,
  type SessionListItem,
  type SessionSaveRequest,
  type SessionSaveResponse,
  type SessionLoadResponse,
  type AdminUserSession,
  isUserSession,
  isSessionListItem,
  isSessionSaveRequest,
  isAdminUserSession,
} from "./contracts/session.js";
export { getSessionStorage, NullSessionStorage } from "./utils/session-storage.js";
