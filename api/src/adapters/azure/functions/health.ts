import { app } from "@azure/functions";
import { INTERNAL_CONFIG } from "../../../../../shared/index.js";
import { createAzureHandler } from "../http.js";

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: createAzureHandler(INTERNAL_CONFIG.api.routes.health),
});
