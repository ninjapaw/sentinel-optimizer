import { app } from "@azure/functions";
import { EXAMPLE_MAX_BODY_BYTES } from "../../../core/example.js";
import { INTERNAL_CONFIG } from "../../../../../shared/index.js";
import { createAzureHandler } from "../http.js";

app.http("example", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "example",
  handler: createAzureHandler(
    INTERNAL_CONFIG.api.routes.example,
    EXAMPLE_MAX_BODY_BYTES,
  ),
});
