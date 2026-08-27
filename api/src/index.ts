/**
 * MIT License
 * Copyright (c) 2026 Microsoft Corporation
 * See LICENSE in the repository root.
 */

import { app } from "@azure/functions";
import { adminHealth } from "./adapters/azure/functions/admin-health/index.js";
import { adminSessions } from "./adapters/azure/functions/admin-sessions/index.js";
import { adminStats } from "./adapters/azure/functions/admin-stats/index.js";
import { example } from "./adapters/azure/functions/example/index.js";
import { explainKql } from "./adapters/azure/functions/explain-kql/index.js";
import { health } from "./adapters/azure/functions/health/index.js";
import { recommend } from "./adapters/azure/functions/recommend/index.js";
import { sessionList } from "./adapters/azure/functions/session-list/index.js";
import { sessionManage } from "./adapters/azure/functions/session-manage/index.js";
import { sessionSave } from "./adapters/azure/functions/session-save/index.js";

app.http("admin-health", { methods: ["GET"], authLevel: "anonymous", route: "admin/health", handler: adminHealth });
app.http("admin-sessions", { methods: ["GET", "DELETE"], authLevel: "anonymous", route: "admin/{*route}", handler: adminSessions });
app.http("admin-stats", { methods: ["GET"], authLevel: "anonymous", route: "admin/stats", handler: adminStats });
app.http("example", { methods: ["POST"], authLevel: "anonymous", route: "example", handler: example });
app.http("explain-kql", { methods: ["POST"], authLevel: "anonymous", route: "explain-kql", handler: explainKql });
app.http("health", { methods: ["GET"], authLevel: "anonymous", route: "health", handler: health });
app.http("recommend", { methods: ["POST"], authLevel: "anonymous", route: "recommend", handler: recommend });
app.http("session-list", { methods: ["GET"], authLevel: "anonymous", route: "session/list", handler: sessionList });
app.http("session-manage", { methods: ["GET", "DELETE"], authLevel: "anonymous", route: "session/{sessionId}", handler: sessionManage });
app.http("session-save", { methods: ["POST"], authLevel: "anonymous", route: "session/save", handler: sessionSave });
